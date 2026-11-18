require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const http = require('http');

const HOST = '127.0.0.1';
const PORT = 3838;
const REDIRECT_URI = `http://${HOST}:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

async function authorizeGmail() {
  const { GMAIL_CLIENT_ID: clientId, GMAIL_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) {
    throw new Error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in server/.env first.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  let resolveAuthorization;
  let rejectAuthorization;
  const authorization = new Promise((resolve, reject) => {
    resolveAuthorization = resolve;
    rejectAuthorization = reject;
  });
  const server = http.createServer(async (req, res) => {
    const callbackUrl = new URL(req.url, REDIRECT_URI);
    if (callbackUrl.pathname !== '/oauth2callback') {
      res.writeHead(404).end('Not found.');
      return;
    }
    if (callbackUrl.searchParams.get('state') !== state) {
      res.writeHead(400).end('OAuth state did not match. Close this tab and retry.');
      rejectAuthorization(new Error('Google OAuth state validation failed.'));
      return;
    }
    if (callbackUrl.searchParams.has('error')) {
      res.writeHead(400).end('Google authorization was not completed. You may close this tab.');
      rejectAuthorization(new Error('Google authorization was denied or cancelled.'));
      return;
    }

    const code = callbackUrl.searchParams.get('code');
    if (!code) {
      res.writeHead(400).end('Authorization code is missing. Close this tab and retry.');
      rejectAuthorization(new Error('Google did not return an authorization code.'));
      return;
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!tokenResponse.ok) {
        res.writeHead(502).end('Google token exchange failed. Check the local terminal.');
        rejectAuthorization(new Error(`Google token exchange failed (${tokenResponse.status}).`));
        return;
      }

      const token = await tokenResponse.json();
      if (typeof token.refresh_token !== 'string' || !token.refresh_token) {
        res.writeHead(400).end('No refresh token was returned. Close this tab and retry authorization.');
        rejectAuthorization(new Error('Google did not return a refresh token.'));
        return;
      }

      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Gmail authorization complete. You may close this tab and return to the local terminal.');
      resolveAuthorization(token.refresh_token);
    } catch (error) {
      res.writeHead(502).end('Google token exchange failed. Check the local terminal.');
      rejectAuthorization(error);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });
  console.log('Open this URL in your browser and authorize the Gmail account that will send OTPs:');
  console.log(authorizationUrl.toString());

  try {
    const refreshToken = await authorization;
    console.log('\nGMAIL_REFRESH_TOKEN (keep private; add it directly to Render):');
    console.log(refreshToken);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

authorizeGmail().catch(error => {
  console.error(`Gmail authorization failed: ${error.message}`);
  process.exitCode = 1;
});
