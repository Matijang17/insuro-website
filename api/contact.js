/**
 * INSURO — Contact form endpoint (Vercel Serverless Function)
 *
 * Receives JSON from kontakt.html, validates input, checks consent,
 * filters spam (honeypot + rate limit), and forwards via e-mail.
 *
 * Required environment variables (configure in Vercel dashboard):
 *   CONTACT_TO_EMAIL   – inbox to receive submissions (e.g. info@insuro.si)
 *   CONTACT_FROM_EMAIL – verified sender (e.g. "INSURO <noreply@insuro.si>")
 *
 * One of the following providers must be configured:
 *   RESEND_API_KEY        – use Resend (https://resend.com)  ← recommended
 *   POSTMARK_TOKEN        – use Postmark (https://postmarkapp.com)
 *   GENERIC_WEBHOOK_URL   – POST raw payload to any URL (Zapier, Make, n8n, Discord, Slack)
 *
 * If none of the above is set, the function will log to stderr and
 * still respond 200 so the form gives the user a success state.
 */

const ALLOWED_ORIGINS = [
  'https://insuro.si',
  'https://www.insuro.si',
  'https://insuro.com',
  'https://www.insuro.com',
  'https://insuro-website.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500'
];

// Tiny in-memory rate limit per IP (resets on cold start — fine for low traffic)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQ   = 5;
const ipBuckets = new Map();

function ipKey(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) || [];
  const recent = bucket.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  ipBuckets.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX_REQ;
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmailHtml(d) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0A2540;max-width:600px">
      <h2 style="color:#0B6B4F;margin:0 0 12px">Novo povpraševanje &mdash; INSURO</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 18px">Poslano s strani <a href="${escapeHtml(d.page_url)}">${escapeHtml(d.page_url)}</a></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600;width:140px">Ime in priimek</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(d.ime)}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600">E-pošta</td><td style="padding:8px 12px;border-bottom:1px solid #eee"><a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a></td></tr>
        <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600">Telefon</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(d.telefon || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600">Vrsta zavarovanja</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(d.vrsta || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8f9fa;font-weight:600;vertical-align:top">Sporočilo</td><td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(d.sporocilo || '—')}</td></tr>
      </table>
      <p style="color:#9ca3af;font-size:11px;margin-top:18px">Soglasje za obdelavo podatkov: ${d.soglasje_zasebnost ? 'DA' : 'NE'} &middot; Strinjanje s pogoji: ${d.soglasje_pogoji ? 'DA' : 'NE'} &middot; Oddano: ${escapeHtml(d.submitted_at)}</p>
    </div>`;
}

async function sendViaResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.CONTACT_TO_EMAIL   || 'info@insuro.si';
  const from   = process.env.CONTACT_FROM_EMAIL || 'INSURO <noreply@insuro.si>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to:      [to],
      reply_to: payload.email,
      subject: `Novo povpraševanje – ${payload.ime} (${payload.vrsta || 'splošno'})`,
      html:    buildEmailHtml(payload)
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function sendViaPostmark(payload) {
  const token = process.env.POSTMARK_TOKEN;
  const to    = process.env.CONTACT_TO_EMAIL   || 'info@insuro.si';
  const from  = process.env.CONTACT_FROM_EMAIL || 'noreply@insuro.si';
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': token },
    body: JSON.stringify({
      From: from,
      To: to,
      ReplyTo: payload.email,
      Subject: `Novo povpraševanje – ${payload.ime} (${payload.vrsta || 'splošno'})`,
      HtmlBody: buildEmailHtml(payload),
      MessageStream: 'outbound'
    })
  });
  if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function sendViaWebhook(payload) {
  const url = process.env.GENERIC_WEBHOOK_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Webhook ${res.status}: ${await res.text()}`);
  return { ok: true };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Vercel auto-parses JSON, but be defensive
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }
  }
  if (!body || typeof body !== 'object') { res.status(400).json({ error: 'Empty body' }); return; }

  // Honeypot — if filled, silently accept (don't tip off the bot)
  if (body.website && String(body.website).trim() !== '') {
    res.status(200).json({ ok: true });
    return;
  }

  // Rate limit
  const ip = ipKey(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests. Poskusite čez minuto.' });
    return;
  }

  // Validate required fields
  const errors = [];
  if (!body.ime       || String(body.ime).trim().length < 2)   errors.push('ime');
  if (!isValidEmail(body.email))                                errors.push('email');
  if (!body.soglasje_zasebnost)                                 errors.push('soglasje_zasebnost');
  if (!body.soglasje_pogoji)                                    errors.push('soglasje_pogoji');
  if (String(body.sporocilo || '').length > 5000)               errors.push('sporocilo_too_long');
  if (errors.length) { res.status(400).json({ error: 'Validation failed', fields: errors }); return; }

  // Sanitize / shape payload
  const payload = {
    ime:       String(body.ime).trim().slice(0, 200),
    telefon:   String(body.telefon || '').trim().slice(0, 50),
    email:     String(body.email).trim().slice(0, 254),
    vrsta:     String(body.vrsta || '').trim().slice(0, 100),
    sporocilo: String(body.sporocilo || '').trim().slice(0, 5000),
    soglasje_zasebnost: true,
    soglasje_pogoji:    true,
    page_url:     String(body.page_url || '').slice(0, 500),
    submitted_at: body.submitted_at || new Date().toISOString(),
    ip
  };

  try {
    if (process.env.RESEND_API_KEY)            await sendViaResend(payload);
    else if (process.env.POSTMARK_TOKEN)       await sendViaPostmark(payload);
    else if (process.env.GENERIC_WEBHOOK_URL)  await sendViaWebhook(payload);
    else {
      console.warn('[contact] No provider configured — logging only:', JSON.stringify(payload));
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err);
    res.status(500).json({ error: 'Pošiljanje ni uspelo. Poskusite znova.' });
  }
}
