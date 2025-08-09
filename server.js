// server.js
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// -------------------- Middleware / static --------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static('public'));

// -------------------- Webhook (OK for Test URL) --------------------
app.all('/webhook/tiktok', (req, res) => {
  console.log('TikTok Webhook Hit:', req.method, req.headers['content-type'], req.body);
  res.status(200).send('OK');
});

// -------------------- Upload helper --------------------
const upload = multer({ dest: 'uploads/' });

// -------------------- Config --------------------
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI; // e.g. https://gglabbot.onrender.com/auth/callback
const SCOPES = (process.env.TIKTOK_SCOPES || 'video.upload,video.publish').split(',');

// TikTok endpoints (check docs for changes)
const TIKTOK_AUTH_URL    = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL   = 'https://open.tiktokapis.com/v2/oauth/token/';

// NOTE: These endpoints are representative. If your app docs show different paths,
// use those instead. The “upload” call is multipart/form-data and returns an upload_id.
const TIKTOK_UPLOAD_URL  = 'https://open.tiktokapis.com/v2/video/upload/';
const TIKTOK_PUBLISH_URL = 'https://open.tiktokapis.com/v2/video/publish/';

// In-memory tokens (replace with DB in production)
let oauthState   = 'state_' + Math.random().toString(36).slice(2);
let accessToken  = null;
let refreshToken = null;

// -------------------- Views --------------------
app.get('/', (req, res) => {
  // Serve your root index.html (no /views folder needed)
  res.sendFile(path.resolve('index.html'));
});

// -------------------- 1) Start OAuth --------------------
app.get('/auth', (req, res) => {
  const authUrl = new URL(TIKTOK_AUTH_URL);
  authUrl.searchParams.set('client_key', CLIENT_KEY);
  authUrl.searchParams.set('scope', SCOPES.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', oauthState);
  return res.redirect(authUrl.toString());
});

// -------------------- 2) OAuth callback (EXCHANGE CODE → TOKEN) --------------------
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`<h1>OAuth Error</h1><p>${error}: ${error_description}</p>`);
  }
  if (!code || state !== oauthState) {
    return res.status(400).send('Invalid OAuth state or missing code');
  }

  try {
    // TikTok requires x-www-form-urlencoded (NOT JSON)
    const form = new URLSearchParams();
    form.append('client_key',    CLIENT_KEY);
    form.append('client_secret', CLIENT_SECRET);
    form.append('code',          code);
    form.append('grant_type',    'authorization_code');
    form.append('redirect_uri',  REDIRECT_URI);

    const resp = await axios.post(
      TIKTOK_TOKEN_URL,
      form.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    accessToken  = resp.data.access_token || null;
    refreshToken = resp.data.refresh_token || null;

    res.send(`
      <h1>Login successful</h1>
      <p>Access token received. You can now upload and publish.</p>
      <a href="/">Go back</a>
      <pre>${JSON.stringify(resp.data, null, 2)}</pre>
    `);
  } catch (e) {
    res.status(500).send(
      `<h1>Token exchange failed</h1><pre>${
        e?.response?.data ? JSON.stringify(e.response.data, null, 2) : e.message
      }</pre>`
    );
  }
});

// -------------------- 3) Upload (real multipart/form-data) --------------------
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!accessToken) return res.status(401).json({ ok: false, error: 'Not authorized. Go to /auth first.' });
  if (!req.file)     return res.status(400).json({ ok: false, error: 'No file uploaded' });

  const filePath = req.file.path;

  try {
    const form = new FormData();
    // Field name must match what TikTok expects for the binary.
    // Most examples use "video" or "file"; check your API docs.
    form.append('video', fs.createReadStream(filePath));

    const uploadResp = await axios.post(TIKTOK_UPLOAD_URL, form, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    // Clean up local temp file
    try { fs.unlinkSync(filePath); } catch {}

    return res.json({
      ok: true,
      message: 'Upload success',
      tiktok_response: uploadResp.data,
    });
  } catch (e) {
    try { fs.unlinkSync(filePath); } catch {}
    return res.status(500).json({
      ok: false,
      error: e?.response?.data || e.message,
    });
  }
});

// -------------------- 4) Publish (uses upload_id from /upload) --------------------
app.post('/publish', async (req, res) => {
  if (!accessToken) return res.status(401).json({ ok: false, error: 'Not authorized. Go to /auth first.' });

  const { upload_id, caption = '' } = req.body;
  if (!upload_id) return res.status(400).json({ ok: false, error: 'upload_id is required' });

  try {
    // A typical publish body—adjust fields to match TikTok’s current API.
    const body = {
      upload_id,
      caption,
      // privacy_level: 'PUBLIC', // example; include if your app requires
    };

    const publishResp = await axios.post(TIKTOK_PUBLISH_URL, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return res.json({
      ok: true,
      message: 'Publish success',
      tiktok_response: publishResp.data,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.response?.data || e.message,
    });
  }
});

// -------------------- Health --------------------
app.get('/health', (_, res) => res.json({ ok: true }));

// -------------------- Token refresh (optional) --------------------
app.get('/auth/refresh', async (req, res) => {
  try {
    if (!refreshToken) return res.status(400).send('No refresh token yet');

    const form = new URLSearchParams();
    form.append('client_key',    CLIENT_KEY);
    form.append('client_secret', CLIENT_SECRET);
    form.append('grant_type',    'refresh_token');
    form.append('refresh_token', refreshToken);

    const resp = await axios.post(
      TIKTOK_TOKEN_URL,
      form.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    accessToken  = resp.data.access_token || accessToken;
    refreshToken = resp.data.refresh_token || refreshToken;

    res.json({ ok: true, tokens: resp.data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// -------------------- Start --------------------
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
