// Constants the pitch needs from the ad platform (village-tuktuks-ads-main/src/lib/agreementText.ts
// and salesApi.ts). Keep in step with the signed-off agreement.

export const VILLAGE_MEDIA = {
  name: 'Village Connect Media (Pty) Ltd',
  footerName: 'Village Connect Media (PTY ltd.) t/a Village Media',
  businessAddress: 'Cnr Rooibok & Henley Drive, Highbury, Henley on Klip, 1961',
  email: 'sales@vm-group.co.za',
  website: 'vm-group.co.za',
}

export const ADVERTISING_AREAS = ['Meyerton', 'Vanderbijlpark', 'Heidelberg', 'Walkerville'] as const

/** A package price covers one area; each extra area adds this much a month (clause 9.1). */
export const EXTRA_AREA_FEE = 100

export const TERM_OPTIONS = [{ value: '12 months from Campaign Start Date', label: '12 months' }] as const

export const formatRand = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `R ${Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`

/**
 * Where "Sign up" links. In the platform this was its own /admin/signup page; here it's
 * VITE_SIGNUP_URL (e.g. https://<platform>/admin/signup). Unset, sign-up is the on-page form.
 */
const SIGNUP_BASE = import.meta.env.VITE_SIGNUP_URL?.trim()

export function signupUrl(params: Record<string, string> = {}) {
  if (!SIGNUP_BASE) return undefined
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
  return query ? `${SIGNUP_BASE}?${query}` : SIGNUP_BASE
}
