import crypto from 'node:crypto';

const SITE_ORIGIN = process.env.PAYWALL_SITE_ORIGIN || 'https://propbetedge.ai';
const COOKIE_NAME = 'pbe_reader';
const PASS_TTL_MS = 30 * 60 * 1000;
const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  setNoStore(res);
  const action = String(req.query?.action || '').toLowerCase();
  const enabled = isEnabled();

  if (req.method === 'GET' && action === 'status') {
    if (!enabled) return res.status(200).json({ enabled: false, unlocked: true });
    const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
    const payload = verifyToken(token, process.env.PAYWALL_SIGNING_SECRET, 'reader_cookie');
    return res.status(200).json({ enabled: true, unlocked: Boolean(payload) });
  }

  if (req.method === 'POST' && action === 'request') {
    if (!enabled) return res.status(503).json({ error: 'Reader Pass is not configured yet.' });
    const body = await readJsonBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    const returnTo = safeReturnPath(body?.returnTo);

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

    const token = createToken({
      purpose: 'email_pass',
      email,
      returnTo,
      exp: Date.now() + PASS_TTL_MS,
      nonce: crypto.randomBytes(12).toString('hex'),
    }, process.env.PAYWALL_SIGNING_SECRET);

    const verifyUrl = new URL('/api/paywall', SITE_ORIGIN);
    verifyUrl.searchParams.set('action', 'verify');
    verifyUrl.searchParams.set('token', token);

    try {
      await sendReaderPass(email, verifyUrl.toString());
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[paywall] Resend error:', error?.message || error);
      return res.status(502).json({ error: 'We could not send the Reader Pass right now. Please try again.' });
    }
  }

  if (req.method === 'GET' && action === 'verify') {
    if (!enabled) return redirect(res, '/');
    const token = String(req.query?.token || '');
    const payload = verifyToken(token, process.env.PAYWALL_SIGNING_SECRET, 'email_pass');
    if (!payload) return renderInvalidPass(res);

    const cookieToken = createToken({
      purpose: 'reader_cookie',
      emailHash: sha256(payload.email || ''),
      exp: Date.now() + COOKIE_TTL_MS,
    }, process.env.PAYWALL_SIGNING_SECRET);

    res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, cookieToken, Math.floor(COOKIE_TTL_MS / 1000)));
    return redirect(res, safeReturnPath(payload.returnTo));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed.' });
}

function isEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.PAYWALL_SIGNING_SECRET);
}

async function sendReaderPass(email, verifyUrl) {
  const from = process.env.PAYWALL_FROM_EMAIL || 'PropBetEdge <news@propbetedge.ai>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your PropBetEdge Reader Pass',
      html: readerPassEmail(verifyUrl),
      text: `Your PropBetEdge Reader Pass: ${verifyUrl}\n\nThis secure link expires in 30 minutes.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
  }
}

function readerPassEmail(verifyUrl) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#08101e;font-family:Arial,sans-serif;color:#f8fafc">
  <div style="max-width:620px;margin:0 auto;padding:34px 20px">
    <div style="background:#101b30;border:1px solid rgba(255,210,74,.32);border-radius:16px;padding:30px">
      <img src="https://propbetedge.ai/logo/pbe-full-400.png" width="190" alt="PropBetEdge" style="display:block;max-width:190px;height:auto;margin-bottom:26px" />
      <div style="font-size:12px;font-weight:800;letter-spacing:1.6px;color:#ffd24a;text-transform:uppercase;margin-bottom:10px">Reader Pass</div>
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 12px;color:#fff">Your story is ready.</h1>
      <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px">Use the secure button below to unlock the full PropBetEdge story. This link expires in 30 minutes; once verified, your browser stays unlocked for 30 days.</p>
      <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:#ffd24a;color:#111827;text-decoration:none;font-weight:900;font-size:14px;padding:13px 19px;border-radius:8px">Unlock PropBetEdge →</a>
      <p style="font-size:11px;line-height:1.5;color:#7f8ca3;margin:24px 0 0">If you did not request this Reader Pass, you can ignore this email.</p>
    </div>
  </div>
</body></html>`;
}

function createToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token, secret, purpose) {
  if (!token || !secret) return null;
  const [body, signature] = String(token).split('.');
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.purpose !== purpose) return null;
    if (!Number.isFinite(payload?.exp) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index < 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function serializeCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function safeReturnPath(value) {
  const path = String(value || '/').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  if (/\r|\n/.test(path)) return '/';
  return path.slice(0, 1200);
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function redirect(res, path) {
  const destination = new URL(path, SITE_ORIGIN).toString();
  res.statusCode = 302;
  res.setHeader('Location', destination);
  return res.end();
}

function renderInvalidPass(res) {
  res.statusCode = 400;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#08101e;color:#fff;padding:40px"><img src="https://propbetedge.ai/logo/pbe-full-400.png" alt="PropBetEdge" width="180"><h1>That Reader Pass has expired.</h1><p><a href="https://propbetedge.ai/news" style="color:#ffd24a">Return to PropBetEdge and request a new pass →</a></p></body></html>`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
