/**
 * The sign-up form, emailed to sales through Resend (https://resend.com). Hosted as POST /api/enquiry
 * by netlify/functions/enquiry.mts and functions/api/enquiry.ts (Cloudflare Pages); `npm run dev`
 * serves it too (vite.config.ts). Set in the host's environment variables:
 *   RESEND_API_KEY  required
 *   RESEND_FROM     sender on a domain verified in Resend (default: Village Media <website@vm-group.co.za>)
 *   RESEND_TO       where enquiries go (default: sales@vm-group.co.za)
 * The browser never sees the key.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface EnquiryEnv {
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  RESEND_TO?: string
}

export async function handleEnquiry(req: Request, env: EnquiryEnv) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = env.RESEND_API_KEY
  if (!apiKey) return json({ error: "Online sign-up isn't switched on yet." }, 503)

  let form: Record<string, unknown>
  try {
    form = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }

  // Hidden field only bots fill in. Pretend it worked.
  if (form.website) return json({ ok: true })

  const field = (key: string, max = 200) => (typeof form[key] === 'string' ? (form[key] as string).trim().slice(0, max) : '')
  const company = field('company')
  const address = field('address', 300)
  const name = [field('firstName'), field('surname')].filter(Boolean).join(' ')
  const email = field('email')
  const phone = field('phone', 40)
  const pkg = field('package')
  const areas = Array.isArray(form.areas)
    ? form.areas.filter((a): a is string => typeof a === 'string').slice(0, 10).map((a) => a.slice(0, 60))
    : []

  if (!company || !address || !field('firstName') || !field('surname'))
    return json({ error: 'Please fill in your company, address, name and surname.' }, 400)
  if (!EMAIL_RE.test(email)) return json({ error: 'Please check your email address.' }, 400)
  if ((phone.match(/\d/g) ?? []).length < 9) return json({ error: 'Please check your contact number.' }, 400)

  const rows: [string, string][] = [
    ['Company', company],
    ['Address', address],
    ['Name', name],
    ['Email', email],
    ['Contact number', phone],
    ['Package', pkg || 'Not sure yet'],
    ['Areas', areas.join(', ') || 'Not chosen'],
  ]
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  const html = `<h2 style="font-family:sans-serif">New sign-up from the website</h2>
<table style="font-family:sans-serif;border-collapse:collapse">${rows
    .map(
      ([k, v]) =>
        `<tr><th align="left" style="padding:6px 16px 6px 0;vertical-align:top">${k}</th><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join('')}</table>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Village Media <website@vm-group.co.za>',
      to: [env.RESEND_TO || 'sales@vm-group.co.za'],
      reply_to: email,
      subject: `New sign-up: ${company}`,
      text,
      html,
    }),
  })
  if (!res.ok) {
    console.error('Resend', res.status, await res.text())
    return json({ error: "We couldn't send that just now. Please try again in a minute." }, 502)
  }
  return json({ ok: true })
}
