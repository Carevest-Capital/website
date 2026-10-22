// Vercel serverless function: receives the website contact form, stores the message in Supabase and
// emails it to the address the dashboard routes that kind of message to (Contact page, Contact Form section).
//
// Environment (Vercel project carevest-blue / carevest-preview):
//   SUPABASE_URL, SUPABASE_ANON_KEY   already set for the build; also used here
//   RESEND_API_KEY                    Resend API key (resend.com); without it messages are stored but not emailed
//   CONTACT_FROM                      sender address on a verified Resend domain, e.g. "CareVest Website <website@mail.carevest.com>"
//   CONTACT_FALLBACK_TO               optional address used when the dashboard has no route for a kind

const KINDS = { new_investor: 'New Investor', borrower: 'Borrower', general: 'General Inquiries' };
const ROUTE_FIELD = { new_investor: 'route_new_investor', borrower: 'route_borrower', general: 'route_general' };
const DEFAULT_ROUTES = { new_investor: 'invest@carevest.com', borrower: 'dnguyen@carevest.com', general: 'investor@carevest.com' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, message: 'Method not allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: real visitors never fill the hidden "website" field.
  if (body.website) { res.status(200).json({ ok: true, sent: false }); return; }

  const kind = KINDS[body.kind] ? body.kind : null;
  const email = String(body.email || '').trim();
  const first = clean(body.first_name, 80);
  const last = clean(body.last_name, 80);
  const province = clean(body.province, 60);
  const message = clean(body.message, 4000);
  if (!kind || !first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !province) {
    res.status(400).json({ ok: false, message: 'Please fill in the required fields.' });
    return;
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = process.env.SUPABASE_ANON_KEY || '';
  const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  // 1. Where does this kind of message go? Read the published Contact page from the database.
  let to = DEFAULT_ROUTES[kind];
  try {
    if (SUPABASE_URL && KEY) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/published_content?key=eq.page:contact&select=value`, { headers: sbHeaders });
      if (r.ok) {
        const rows = await r.json();
        const form = rows?.[0]?.value?.form || {};
        const configured = String(form[ROUTE_FIELD[kind]] || '').trim();
        if (configured) to = configured;
      }
    }
  } catch { /* keep the default route */ }
  if (!to) to = process.env.CONTACT_FALLBACK_TO || DEFAULT_ROUTES.general;
  const recipients = to.split(/[,;\s]+/).filter(Boolean);

  // 2. Email it.
  let sent = false; let sendError = '';
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM || 'CareVest Website <onboarding@resend.dev>';
  if (apiKey) {
    try {
      const subject = `Website contact: ${KINDS[kind]} from ${first} ${last}`;
      const text = [
        `Type: ${KINDS[kind]}`, `Name: ${first} ${last}`, `Email: ${email}`, `Province: ${province}`, '', 'Message:', message || '(no message)', '',
        `Sent from the carevest.com contact form${body.page ? ` (${body.page})` : ''}.`,
      ].join('\n');
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: recipients, reply_to: email, subject, text }),
      });
      if (r.ok) sent = true; else sendError = `Resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
    } catch (e) { sendError = e.message; }
  } else {
    sendError = 'RESEND_API_KEY is not configured';
  }

  // 3. Store the message with its delivery status (never lose one, even if email failed).
  // The anon key may insert but not read back, so the id is generated here and nothing is returned.
  let stored = false;
  try {
    if (SUPABASE_URL && KEY) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
        method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ id: crypto.randomUUID(), kind, first_name: first, last_name: last, email, province, message, routed_to: recipients.join(', '), sent, send_error: sent ? null : sendError, user_agent: clean(req.headers['user-agent'], 300) }),
      });
      stored = r.ok;
    }
  } catch { /* storage is best effort */ }

  // The visitor sees success when the message was either emailed or safely stored for the team.
  if (sent || stored) { res.status(200).json({ ok: true, sent }); return; }
  res.status(502).json({ ok: false, message: 'Sorry, your message could not be sent right now. Please email us directly.' });
}

function clean(v, max) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
