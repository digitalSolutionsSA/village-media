import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ADVERTISING_AREAS, VILLAGE_MEDIA, signupUrl } from '../lib/site'

/**
 * Sign-up. With VITE_SIGNUP_URL set, "Sign up" buttons link to the ad platform as before.
 * Otherwise they open this form, which netlify/functions/enquiry.mts emails to sales via Resend.
 */

export interface SignUpPrefill {
  package?: string
  business?: string
  areas?: readonly string[]
}

let open: ((p: SignUpPrefill) => void) | undefined

/** A "Sign up" button: a link to the platform if one is configured, otherwise opens the form. */
export function SignUpButton({
  prefill = {},
  params,
  className,
  children,
}: {
  prefill?: SignUpPrefill
  params?: Record<string, string>
  className?: string
  children: ReactNode
}) {
  const href = signupUrl(params)
  if (href)
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  return (
    <button type="button" onClick={() => open?.(prefill)} className={className}>
      {children}
    </button>
  )
}

const PACKAGES = ['Standard', 'Premium', 'Not sure yet']

const input =
  'mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base sm:py-2.5 text-white outline-none placeholder:text-zinc-600 focus:border-brand-400 short:py-1.5'

/** Mount once. The form every SignUpButton opens. */
export function SignUpDialog() {
  const ref = useRef<HTMLDialogElement>(null)
  const [prefill, setPrefill] = useState<SignUpPrefill>({})
  const [opened, setOpened] = useState(0) // remounts the form, so it starts fresh each time
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  useEffect(() => {
    open = (p) => {
      setPrefill(p)
      setStatus('idle')
      setOpened((n) => n + 1)
      ref.current?.showModal()
    }
    return () => (open = undefined)
  }, [])

  const close = () => ref.current?.close()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const body = Object.fromEntries(['company', 'address', 'firstName', 'surname', 'email', 'phone', 'package', 'website'].map((k) => [k, data.get(k) ?? '']))
    setStatus('sending')
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, areas: data.getAll('areas') }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.')
      setSentTo(String(body.email))
      setStatus('sent')
    } catch (err) {
      // fetch() itself throws a TypeError (Safari: "Load failed") when the server can't be reached at all.
      setError(
        err instanceof TypeError
          ? "We couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : String(err),
      )
      setStatus('error')
    }
  }

  const pkg = PACKAGES.find((p) => prefill.package?.toLowerCase().startsWith(p.toLowerCase())) ?? 'Not sure yet'

  return (
    <dialog
      ref={ref}
      onClick={(e) => e.target === ref.current && close()}
      aria-labelledby="signup-title"
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(100%-1.5rem,40rem)] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-300 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm sm:p-7 short:p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-4 short:mb-2">
        <div>
          <h2 id="signup-title" className="text-2xl font-black uppercase italic text-white sm:text-3xl short:text-xl">
            Sign up
          </h2>
          {status !== 'sent' && (
            <p className="mt-1 text-sm text-zinc-400 max-sm:hidden short:hidden">Tell us about your business and our sales team will get your ad on screen.</p>
          )}
        </div>
        <button type="button" onClick={close} aria-label="Close" className="-mr-2 -mt-1 rounded-full px-3 py-1 text-2xl leading-none text-zinc-400 hover:text-white">
          ×
        </button>
      </div>

      {status === 'sent' ? (
        <div className="py-6 text-center">
          <p className="mb-2 text-5xl">🎉</p>
          <p className="mb-2 text-xl font-bold text-white">Thanks, we've got it.</p>
          <p className="mb-6">
            Our sales team will reply to <span className="font-semibold text-white">{sentTo}</span> shortly.
          </p>
          <button type="button" onClick={close} className="rounded-full bg-brand-500 px-8 py-3 font-semibold text-on-accent hover:bg-brand-400">
            Done
          </button>
        </div>
      ) : (
        <form key={opened} onSubmit={submit} className="grid grid-flow-row-dense grid-cols-2 gap-3 short:grid-cols-4 short:gap-2">
          <label className="text-sm">
            Company name
            <input name="company" required autoComplete="organization" defaultValue={prefill.business} className={input} />
          </label>
          <label className="col-span-2 text-sm">
            Company address
            <input name="address" required autoComplete="street-address" className={input} />
          </label>
          <label className="text-sm">
            Package
            <select name="package" defaultValue={pkg} className={input}>
              {PACKAGES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Name
            <input name="firstName" required autoComplete="given-name" className={input} />
          </label>
          <label className="text-sm">
            Surname
            <input name="surname" required autoComplete="family-name" className={input} />
          </label>
          <label className="text-sm">
            Email
            <input name="email" type="email" required autoComplete="email" className={input} />
          </label>
          <label className="text-sm">
            Contact number
            <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className={input} />
          </label>
          <fieldset className="col-span-2 short:col-span-4 text-sm">
            <legend>Areas</legend>
            <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 short:grid-cols-4">
              {ADVERTISING_AREAS.map((a) => (
                <label
                  key={a}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 has-checked:border-logo-gold has-checked:bg-logo-gold/20 has-checked:text-white short:py-1"
                >
                  <input type="checkbox" name="areas" value={a} defaultChecked={prefill.areas?.includes(a)} className="accent-logo-gold" />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          {/* Bots fill this in; people never see it. */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

          {status === 'error' && (
            <p role="alert" className="rounded-lg border border-logo-red/50 bg-logo-red/10 px-3 py-2 text-sm text-red-200 col-span-2 short:col-span-4">
              {error} Or email us at{' '}
              <a href={`mailto:${VILLAGE_MEDIA.email}`} className="font-semibold underline">
                {VILLAGE_MEDIA.email}
              </a>
              .
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="mt-1 rounded-full bg-logo-green py-3.5 text-lg font-semibold text-on-accent hover:brightness-110 disabled:opacity-60 col-span-2 short:col-span-4 short:py-2"
          >
            {status === 'sending' ? 'Sending…' : '✎ Send'}
          </button>
        </form>
      )}
    </dialog>
  )
}
