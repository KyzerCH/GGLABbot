import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Static + parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static('public'));

// --- TikTok Webhook (NEW) ---
// TikTok will POST events here. Also respond to GET so the "Test URL" button works.
app.get('/webhook/tiktok', (req, res) => res.status(200).send('OK'));
app.post('/webhook/tiktok', (req, res) => {
  console.log('TikTok Webhook Event:', req.body);
  // TODO: add signature verification when you’re ready
  res.status(200).send('OK');
});

// Simple storage for demo uploads (memory or disk)
const upload = multer({ dest: 'uploads/' });

// ---------- CONFIG ----------
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;   // App ID / Client Key
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI; // e.g. https://gglabbot.onrender.com/auth/callback
const SCOPES = (process.env.TIKTOK_SCOPES || 'video.upload,video.publish').split(',');

// TikTok endpoints (placeholders — confirm in official docs)
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_UPLOAD_URL = 'https://open.tiktokapis.com/v2/video/upload/';
const TIKTOK_PUBLISH_URL = 'https://open.tiktokapis.com/v2/video/publish/';

// In-memory token store for demo (replace with DB in production)
let oauthState = 'state_' + Math.random().toString(36).slice(2);
let accessToken = null;
let refreshToken = null;

// ---------- VIEWS ----------
app.get('/', (req, res) => {
  res.sendFile(path.resolve('views/index.html'));
});

// 1) Start OAuth
app.get('/auth', (req, res) => {
  const authUrl = new URL(TIKTOK_AUTH_URL);
  authUrl.searchParams.set('client_key', CLIENT_KEY);
  authUrl.searchParams.set('scope', SCOPES.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', oauthState);
  return res.redirect(authUrl.toString());
});

// 2) OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(`<h1>OAuth Error</h1><p>${error}: ${error_description}</p>`);
  if (!code || state !== oauthState) return res.status(400).send('<h1>Invalid OAuth state or missing code</h1>');
  try {
    const resp = await axios.post(TIKTOK_TOKEN_URL, {
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }, { headers: { 'Content-Type': 'application/json' } });

    accessToken = resp.data.access_token || null;
    refreshToken = resp.data.refresh_token || null;

    res.send(`
      <h1>Login successful</h1>
      <p>Access token received. You can now upload and publish.</p>
      <a href="/">Go back</a>
      <pre>${JSON.stringify(resp.data, null, 2)}</pre>
    `);
  } catch (e) {
    res.status(500).send(`<h1>Token exchange failed</h1><pre>${e?.response?.data ? JSON.stringify(e.response.data,null,2) : e.message}</pre>`);
  }
});

// 3) Upload endpoint (demo)
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!accessToken) return res.status(401).json({ ok: false, error: 'Not authorized. Go to /auth first.' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
  try {
    const filePath = req.file.path;
    // TODO: call TikTok upload API with multipart/form-data using accessToken
    const fakeUploadId = 'upload_' + Date.now();
    res.json({ ok: true, message: 'Demo upload stub — integrate TikTok upload here.', upload_id: fakeUploadId, local_file: filePath });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 4) Publish endpoint (demo)
app.post('/publish', async (req, res) => {
  if (!accessToken) return res.status(401).json({ ok: false, error: 'Not authorized. Go to /auth first.' });
  const { upload_id, caption = '' } = req.body;
  if (!upload_id) return res.status(400).json({ ok: false, error: 'upload_id is required' });
  try {
    // TODO: call TikTok publish API with accessToken + metadata
    const fakeVideoId = 'video_' + Date.now();
    res.json({ ok: true, message: 'Demo publish stub — integrate TikTok publish here.', video_id: fakeVideoId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

// Bind to all interfaces for Render
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

