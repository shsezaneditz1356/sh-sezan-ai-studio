import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '22mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please wait a little and try again.' }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: "SH SEZAN Edit'z AI Prompt Studio" }));

app.post('/api/analyze', analyzeLimiter, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI analysis is not configured yet. The app owner must set GEMINI_API_KEY on the server.' });
  }
  const { images, options = {} } = req.body || {};
  if (!Array.isArray(images) || images.length < 1 || images.length > 2) {
    return res.status(400).json({ error: 'Upload one or two images.' });
  }
  for (const image of images) {
    if (!image || !ALLOWED_MIME.has(image.mimeType) || typeof image.data !== 'string' || !image.data.length) {
      return res.status(400).json({ error: 'Use a supported JPG, PNG, WEBP, or GIF image.' });
    }
    if (image.data.length > 11 * 1024 * 1024) {
      return res.status(413).json({ error: 'Each image must be about 8 MB or smaller.' });
    }
  }

  const features = Array.isArray(options.features)
    ? options.features.filter(x => ['pose', 'outfit', 'hair', 'lighting', 'background', 'camera'].includes(x))
    : ['pose', 'outfit', 'hair', 'lighting', 'background', 'camera'];
  const style = safeText(options.style, 80, 'photorealistic');
  const ratio = safeText(options.ratio, 10, '4:5');
  const language = safeText(options.language, 20, 'English');
  const extra = safeText(options.extra, 1200, 'none');
  const twoImages = images.length === 2;

  const parts = [];
  parts.push({ text: twoImages
    ? 'Image 1 is the SCENE reference: describe its pose, outfit, hair, background, lighting, camera angle, framing, composition, and photographic style. Image 2 is the TARGET IDENTITY reference: use it as the intended face/identity reference in the reusable prompt. Do not transfer image 1 subject identity.'
    : 'Analyze this reference image as a scene/style reference for a reusable image-generation prompt. Separate visual scene details from identity so another person’s authorized identity photo can be used later.'
  });
  for (const image of images) parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  parts.push({ text: `Return ONLY valid JSON with keys visual_analysis, normal_prompt, short_prompt, negative_prompt, detailed_json. detailed_json must be a JSON object, not a string. Image style: ${style}. Aspect ratio: ${ratio}. Prompt language: ${language}. Describe these categories: ${features.join(', ')}. Extra instructions: ${extra}. Make the prompt detailed and reusable. ${twoImages ? 'Explicitly say image 1 supplies scene/pose/outfit/composition and image 2 supplies target face identity.' : 'Make clear that another authorized identity photo can be supplied to the downstream image generator.'} Never claim a face can be guaranteed 100% identical; request faithful preservation of visible identity features. Avoid inventing details not visible in the image. Include a concise negative prompt. Return valid JSON only.` });

  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35 } }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini API request failed with status:', upstream.status);
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'AI service is busy or its quota was reached. Try again later.' : 'The AI analysis service could not complete the request. Check server configuration and try again.' });
    }
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
    if (!raw) return res.status(502).json({ error: 'The AI returned an empty response. Please try again.' });
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      try { parsed = JSON.parse(cleaned); }
      catch { return res.status(502).json({ error: 'The AI response was not valid JSON. Please try again.' }); }
    }
    if (!parsed.normal_prompt) return res.status(502).json({ error: 'The AI response was incomplete. Please try again.' });
    return res.json(parsed);
  } catch (error) {
    console.error('Gemini backend error:', error.name || 'Error');
    return res.status(504).json({ error: 'Could not reach the AI service. Check your internet connection and try again.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large. Use smaller images.' });
  console.error('Request error:', err?.name || 'Error');
  res.status(400).json({ error: 'Invalid request.' });
});

function safeText(value, max, fallback) {
  return typeof value === 'string' ? value.slice(0, max).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') : fallback;
}

app.listen(PORT, () => console.log(`SH SEZAN Edit'z AI Prompt Studio running on http://localhost:${PORT}`));
