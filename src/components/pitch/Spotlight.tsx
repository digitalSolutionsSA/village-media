import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Ad } from '../../lib/live'
import { SignUpButton } from '../SignUp'

/**
 * "On screen right now": the customers whose ads are live on the tuk-tuk tablets, straight from the
 * ad platform's active creatives. Plays like a tablet does, one ad at a time, and pauses while the
 * pointer is on it or it's scrolled out of view. Renders nothing until there's a customer ad to show.
 */

const SLIDE_SECONDS = 6
/** Our own ads, not customers'. */
const HOUSE_ADS = /^village (media|tuks?)\b/i

/**
 * Supabase serves resized WebP copies of storage images (the uploads are 2–3 MB PNGs). It needs the
 * height too: given only a width it keeps the original height and crops. Ads are 16:9, like the tablets.
 */
const resized = (url: string, width: number) =>
  url.includes('/storage/v1/object/public/')
    ? `${url.replace('/object/public/', '/render/image/public/')}?width=${width}&height=${Math.round((width * 9) / 16)}&resize=cover&quality=70`
    : url
const srcSet = (url: string) => [640, 960, 1280].map((w) => `${resized(url, w)} ${w}w`).join(', ')

/** The advertiser name is usually blank, so fall back to the title without its "#2". */
const advertiserOf = (ad: Ad) => ad.advertiser_name?.trim() || ad.title.replace(/\s*#\d+$/, '').trim()

interface Customer {
  key: string
  name: string
  ads: Ad[]
}

export function Spotlight({ ads, heading }: { ads: Ad[]; heading: ReactNode }) {
  const customers = useMemo(() => {
    const byKey = new Map<string, Customer>()
    for (const ad of ads) {
      const name = advertiserOf(ad)
      if (HOUSE_ADS.test(name) || HOUSE_ADS.test(ad.title)) continue
      const key = ad.client_id ?? name.toLowerCase()
      const customer = byKey.get(key) ?? { key, name, ads: [] }
      customer.ads.push(ad)
      byKey.set(key, customer)
    }
    return [...byKey.values()]
  }, [ads])
  const slides = useMemo(() => customers.flatMap((customer) => customer.ads.map((ad) => ({ ad, customer }))), [customers])

  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [inView, setInView] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [slides.length])

  if (!slides.length) return null
  const current = slides[index % slides.length]
  const seconds = current.ad.media_type === 'video' ? current.ad.duration_seconds || SLIDE_SECONDS : SLIDE_SECONDS
  const next = () => setIndex((i) => (i + 1) % slides.length)
  const show = (customer: Customer) => setIndex(slides.findIndex((s) => s.customer === customer))

  return (
    <>
      {heading}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-10">
        <div data-reveal="scale">
          {/* The tablet, as mounted in the tuk-tuks. */}
          <div
            ref={stageRef}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            className="relative rounded-[1.5rem] border border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-2xl shadow-brand-500/25 sm:rounded-[2.25rem] sm:p-4"
          >
            <span className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-zinc-600 sm:top-1.5 sm:h-1.5 sm:w-1.5" aria-hidden />
            <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-950 sm:rounded-2xl">
              {slides.map(({ ad, customer }, i) => {
                const active = i === index
                if (ad.media_type === 'video')
                  return active ? (
                    <video
                      key={ad.id}
                      src={ad.media_url}
                      muted
                      autoPlay
                      loop
                      playsInline
                      aria-label={`${customer.name} advert`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null
                return (
                  <img
                    key={ad.id}
                    src={resized(ad.media_url, 960)}
                    srcSet={srcSet(ad.media_url)}
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    alt={active ? `${customer.name} advert` : ''}
                    aria-hidden={!active}
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                      active ? 'opacity-100 motion-safe:animate-[spotlight-zoom_7s_ease-out_both]' : 'opacity-0'
                    }`}
                  />
                )
              })}

              <span className="absolute left-2.5 top-2.5 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white backdrop-blur sm:left-4 sm:top-4 sm:text-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-logo-red" />
                On screen now
              </span>

              {/* One segment per ad, like stories. Tap one to jump to it. */}
              <div className="absolute inset-x-2.5 bottom-2.5 flex gap-1 sm:inset-x-4 sm:bottom-4 sm:gap-1.5">
                {slides.map(({ ad, customer }, i) => (
                  <button
                    key={ad.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show ${customer.name}`}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/25 py-0 sm:h-1.5"
                  >
                    {i < index && <span className="block h-full w-full bg-white" />}
                    {i === index && (
                      <span
                        key={index}
                        onAnimationEnd={next}
                        className="block h-full w-full origin-left bg-white"
                        style={{
                          animation: `spotlight-progress ${seconds}s linear both`,
                          animationPlayState: inView && !hovered ? 'running' : 'paused',
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 flex items-baseline justify-between gap-4" aria-live="polite">
            <span className="truncate text-2xl font-black uppercase italic text-white sm:text-3xl">{current.customer.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-zinc-500">
              {index + 1} / {slides.length}
            </span>
          </p>
        </div>

        <ul data-reveal-stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:gap-3">
          {customers.map((customer) => {
            const active = current.customer === customer
            return (
              <li key={customer.key}>
                <button
                  type="button"
                  onClick={() => show(customer)}
                  aria-current={active}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors lg:pr-4 ${
                    active ? 'border-logo-gold bg-logo-gold/10' : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-600'
                  }`}
                >
                  <img
                    src={resized(customer.ads[0].media_url, 320)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="hidden aspect-video w-24 shrink-0 rounded-lg object-cover sm:block"
                  />
                  <span className="min-w-0 flex-1 px-1 sm:px-0">
                    <span className="block truncate font-extrabold uppercase italic text-white sm:text-lg">{customer.name}</span>
                    <span className="text-xs text-zinc-400">{customer.ads.length > 1 ? `${customer.ads.length} ads` : '1 ad'} on rotation</span>
                  </span>
                  {active && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-logo-gold" aria-hidden />}
                </button>
              </li>
            )
          })}
          <li>
            <SignUpButton className="flex h-full w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-logo-green/60 p-3 text-center font-extrabold uppercase italic text-logo-green hover:border-logo-green hover:bg-logo-green/10 lg:py-5">
              ＋ Your business here
            </SignUpButton>
          </li>
        </ul>
      </div>
    </>
  )
}
