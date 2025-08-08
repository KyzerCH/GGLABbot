# TikTok Demo Backend (Express)

This is a minimal Node.js backend to demonstrate TikTok Content Posting API flow.

## Quick start on Replit (recommended)
1. Create a new **Node.js** Repl.
2. Upload these files to the Repl or connect this folder as a project.
3. In the Replit **Secrets** (Environment variables), set:
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - `TIKTOK_REDIRECT_URI` (e.g. `https://<your-repl>.repl.co/auth/callback`)
   - `TIKTOK_SCOPES` = `video.upload,video.publish`
4. Run `npm install` then `npm start`.
5. Visit the live URL Replit gives you and click **Sign in with TikTok**.

> NOTE: TikTok endpoints in `server.js` are placeholders. Open TikTok's official docs and update `TIKTOK_AUTH_URL`, `TIKTOK_TOKEN_URL`, `TIKTOK_UPLOAD_URL`, and `TIKTOK_PUBLISH_URL` to the current values.

## Endpoints
- `GET /` – demo UI (login, upload, publish)
- `GET /auth` – starts OAuth
- `GET /auth/callback` – handles TikTok callback
- `POST /upload` – stub for uploading (replace with real API call)
- `POST /publish` – stub for publishing (replace with real API call)
