# SH SEZAN Edit'z — AI Prompt Studio

A responsive bilingual (Bangla/English) prompt-builder website with a Gemini-powered image-analysis backend. The API key stays on the server in an environment variable and is never included in frontend JavaScript.

## Included
- Single-image scene analysis and two-image scene + target-identity prompt workflow
- Normal, short, negative, and detailed JSON prompt outputs
- Prompt history, favorites, copy, and TXT download (browser local storage)
- Automatic/manual scene-category selection
- Responsive black + premium-gold interface
- Express backend with request rate limiting, basic security headers, image type/size checks
- PWA manifest/service worker and Capacitor Android project configuration

## Run locally
Requires Node.js 20 or newer.

1. Extract this folder.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Create a Gemini API key in Google AI Studio and put it in `.env` as `GEMINI_API_KEY=...`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

Do not paste your API key into the HTML, publish `.env`, or commit it to source control. Gemini usage may have costs or quotas depending on your account and model. See Google's official image understanding docs: https://ai.google.dev/gemini-api/docs/image-understanding

## Deploy the website securely

A starter `render.yaml` is included for Render-style Node deployment. Review the host settings, set `GEMINI_API_KEY` as a secret environment variable, and enable HTTPS. Hosting free tiers and API quotas can change.
Deploy the Node app to a Node-compatible hosting provider. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` as server environment variables in the hosting dashboard. Enable HTTPS. Do not deploy the HTML as a standalone static file if you want AI analysis; the `/api/analyze` backend is required. Add authentication/abuse controls before a high-traffic public launch; rate limiting here is a basic starter, not a complete production security review.

## Android APK
This source includes Capacitor configuration, but it does not contain a built APK. To create the Android wrapper after the web backend is deployed:

1. Ensure `public/index.html` calls your deployed HTTPS API. For a production Capacitor app, edit `public/config.js` and set `window.SH_SEZAN_API_BASE_URL` to your deployed HTTPS backend origin (no trailing slash). The hosted website can leave it empty to use the same origin. Configure server CORS/allowlisting appropriately if the API is hosted on a separate origin. Never put the Gemini key in the app.
2. Run `npm install`.
3. Run `npx cap add android` (only once).
4. Run `npx cap sync android`.
5. Run `npx cap open android` and build an APK using Android Studio.

A real Android release needs the Android SDK/Gradle signing setup. This project is source code, not a Play Store-published app or ready-made APK.

## Privacy notes
- Images are sent to your app server and then to Google Gemini only when the user clicks Analyze.
- This starter does not intentionally save uploaded images on the server.
- Prompt history and favorites are stored in that browser's local storage.
- Before publishing, add a privacy policy, account/authentication if needed, monitoring, and stricter abuse protection.
