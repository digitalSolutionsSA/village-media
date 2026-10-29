import { Suspense, lazy, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { getSupabase, isSupabaseConfigured, listPackages, type Ad, type SalesPackage, type Tuktuk } from './lib/live'
import { EXTRA_AREA_FEE, TERM_OPTIONS, VILLAGE_MEDIA, formatRand } from './lib/site'
import { dismissSplashWhen, splashLifting } from './lib/splash'
import { ProjectionSection } from './components/pitch/ProjectionSection'
import { SignUpButton, SignUpDialog } from './components/SignUp'

// three.js is most of the bundle, so it is its own chunk. Start fetching it straight away;
// the loading screen waits for it so the map is already there when the screen lifts.
const mapModule = import('./components/pitch/CityMapScene')
const CityMapScene = lazy(() => mapModule.then((m) => ({ default: m.CityMapScene })))

gsap.registerPlugin(ScrollTrigger, useGSAP)

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000

const HEADLINE = 'Put your business in front of thousands of local customers every month.'
const STATEMENT = 'Your ad. On every route. In front of every passenger. Every single day.'

/** `count` makes the number tick up when it scrolls into view; text-only values just reveal. */
const REACH = [
  { icon: '👥', value: '10,000+', count: 10000, suffix: '+', label: 'Rides per month', note: '(October projection)' },
  { icon: '🛺', value: '10', count: 10, label: 'Active tuk-tuks with tablets' },
  { icon: '📍', value: 'Multiple', label: 'Midvaal communities and routes' },
  { icon: '🙌', value: '12,000+', count: 12000, suffix: '+', label: 'Local passengers every month' },
]

/** Floor for the "live right now" strip, so the pitch never shows fewer than this. */
const MIN_SCREENS_ONLINE = 10
const MIN_ADS_RUNNING = 48

/** Shown if no packages are set up under Packages (and in demo mode). */
const BROCHURE_PACKAGES: SalesPackage[] = [
  {
    id: '',
    name: 'Standard Package',
    description: 'Static image · 5 seconds per play',
    monthly_fee: 950,
    areas: [],
    features: ['One static image advert', '5 seconds per play', 'Displayed across all 10 tuk-tuks', 'Continuous daily exposure', 'Affordable and effective'],
    sort_order: 1,
    active: true,
    created_at: '',
  },
  {
    id: '',
    name: 'Premium Package',
    description: 'Video or image · 10 seconds per play',
    monthly_fee: 1450,
    areas: [],
    features: [
      'Video advert or static image',
      '10 seconds per play',
      'Displayed across all 10 tuk-tuks',
      'Continuous daily exposure',
      'More time to showcase your products or services',
      'Maximum local impact',
    ],
    sort_order: 2,
    active: true,
    created_at: '',
  },
]

const PACKAGE_THEMES = [
  { head: 'bg-brand-600', ring: 'border-brand-500/70', price: 'text-brand-300', glow: 'shadow-brand-500/25', icon: '🖼️' },
  { head: 'bg-logo-red', ring: 'border-logo-red/70', price: 'text-red-300', glow: 'shadow-red-500/25', icon: '▶️' },
]

// One area, as in the projection calculator: 5 screens × 12 h a day, ad every 500 s, 30 days.
const PLAYS_PER_MONTH = 12960
const PLAYS = [
  { name: 'Standard', seconds: 5, fee: 950, head: 'bg-brand-600', ring: 'border-brand-500/50', price: 'text-brand-300' },
  { name: 'Premium', seconds: 10, fee: 1450, head: 'bg-logo-red', ring: 'border-logo-red/50', price: 'text-red-300' },
]

/** `max` is the top of the typical monthly range, used for "save up to". */
const COMPARE = [
  { icon: '📰', medium: 'Community newspaper', max: 3000 },
  { icon: '📘', medium: 'Facebook boosted posts', max: 2000 },
  { icon: '📻', medium: 'Local radio advertising', max: 20000 },
  { icon: '🪧', medium: 'Outdoor billboards', max: 20000 },
  { icon: '🛒', medium: 'Shopping centre screens', max: 2000 },
  { icon: '🚕', medium: 'Taxi rank advertising', max: 3000 },
]

const rand = (n: number) => `R${n.toLocaleString('en-US')}`
const BIGGEST_SAVING = Math.max(...COMPARE.map((c) => c.max))

const WHY = [
  { icon: '👥', text: 'Reaches local customers where they travel' },
  { icon: '🎯', text: 'Captive, engaged audience' },
  { icon: '🏪', text: 'More affordable than traditional media' },
  { icon: '📈', text: 'Supports local businesses and builds a stronger Midvaal' },
]

const PILLARS = [
  { icon: '👥', label: 'Captive audience', bg: 'bg-logo-blue' },
  { icon: '📍', label: 'Local routes', bg: 'bg-logo-red' },
  { icon: '📊', label: 'Mobile advertising', bg: 'bg-logo-green' },
  { icon: '❤️', label: 'Stronger communities', bg: 'bg-logo-gold' },
]

const STEPS = [
  { title: 'Pick your package', body: 'Standard (5-second image) or Premium (10-second video or image), on a 12-month term. One area included, R100 a month for each extra area.' },
  { title: 'Send your artwork', body: 'Logo, photos, video, prices, QR code. Need a design? We can make it for you.' },
  { title: 'You approve it', body: 'Nothing goes live until you have approved the final ad.' },
  { title: 'Live on the screens', body: 'Your ad plays in rotation on the 10-inch HD tablets inside Village Tuk vehicles.' },
]

const STEP_COLORS = ['bg-logo-red', 'bg-logo-gold', 'bg-logo-green', 'bg-logo-blue']

// Plain-language summary of the agreement (lib/agreementText.ts) — keep in step with the contract.
const TERMS = [
  'Standard: one static image, 5 seconds per play. Premium: video or image, 10 seconds per play.',
  'A 12-month term from your campaign start date. After that it carries on month-to-month until either side gives 30 days’ notice.',
  'Cancelling before your term ends costs 50% of the fees left for the rest of that term.',
  'Monthly fee paid in advance by the 25th for the following month, by EFT.',
  'Design and video production quoted separately, only if you need it.',
  'Plays and audience figures are estimates — not guaranteed results.',
]

const TICKER = ['Real people', 'Real routes', 'Real results', 'Local businesses on the move']
const TICKER_DOTS = ['text-logo-red', 'text-logo-gold', 'text-logo-green', 'text-logo-blue']

/** Words wrapped for word-by-word reveals. The screen-reader text stays the plain sentence. */
function SplitWords({ text, wordAttr }: { text: string; wordAttr: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden>
          <span {...{ [wordAttr]: '' }} className="inline-block will-change-transform">
            {word}
          </span>
        </span>
      ))}
    </>
  )
}

/** Small brochure-style tab above a big section headline. */
function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="mb-10 max-w-4xl sm:mb-14">
      <p
        data-tab
        className="mb-5 inline-flex items-center rounded-full bg-brand-600 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.18em] text-on-accent shadow-lg shadow-brand-500/20"
      >
        {eyebrow}
      </p>
      <h2 data-split-heading className="text-[clamp(2.25rem,6vw,5rem)] font-black uppercase italic leading-[0.92] tracking-tight" aria-label={title}>
        <SplitWords text={title} wordAttr="data-split-word" />
      </h2>
      {intro && (
        <p data-reveal className="mt-5 max-w-2xl text-lg text-zinc-400 sm:text-xl">
          {intro}
        </p>
      )}
    </div>
  )
}

/** A full-width band of the pitch with generous breathing room and slow-moving colour glows. */
function Band({ children, glow, className = '', id }: { children: ReactNode; glow?: [string, string]; className?: string; id?: string }) {
  return (
    <section id={id} className={`relative isolate overflow-hidden px-5 py-20 sm:px-8 sm:py-32 lg:px-12 lg:py-40 ${className}`}>
      {glow && (
        <>
          <div data-glow className={`pointer-events-none absolute -left-40 top-10 -z-10 h-96 w-96 rounded-full opacity-25 blur-3xl ${glow[0]}`} aria-hidden />
          <div data-glow className={`pointer-events-none absolute -right-40 bottom-0 -z-10 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl ${glow[1]}`} aria-hidden />
        </>
      )}
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  )
}

/** A number that GSAP counts up from zero when it scrolls into view. Shows the final value without JS. */
function Count({ value, decimals = 0, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const text = `${prefix}${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
  return (
    <span data-count={value} data-decimals={decimals} data-prefix={prefix} data-suffix={suffix} className="tabular-nums">
      {text}
    </span>
  )
}

/** Card that leans towards the pointer. */
function TiltCard({ className, children, side }: { className: string; children: ReactNode; side: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    gsap.to(el, { rotateY: x * 10, rotateX: -y * 10, transformPerspective: 900, duration: 0.4, ease: 'power2.out' })
  }
  const leave = () => ref.current && gsap.to(ref.current, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'power3.out' })
  return (
    <div ref={ref} data-package={side} onPointerMove={move} onPointerLeave={leave} className={className}>
      {children}
    </div>
  )
}

/** Customer-facing presentation for reps to walk through on the tablet, or to share as a link. */
export function Pitch() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [tuktuks, setTuktuks] = useState<Tuktuk[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [packages, setPackages] = useState<SalesPackage[]>([])
  // The map is downloaded behind the loading screen but only built as it lifts, so building the
  // 3D scene never stutters the logo animation, and the map's zoom-in plays in view.
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    const logo = document.querySelector<HTMLImageElement>('[data-hero="logo"]')
    dismissSplashWhen(Promise.all([mapModule, logo?.decode()]))
    splashLifting.then(() => setShowMap(true))
  }, [])

  useEffect(() => {
    // Without Supabase the page uses the brochure figures and packages below.
    if (!isSupabaseConfigured) return
    getSupabase().then((supabase) => {
      supabase.from('tuktuks').select('*').then(({ data }) => setTuktuks((data as Tuktuk[]) ?? []))
      supabase
        .from('creatives')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(({ data }) => setAds((data as Ad[]) ?? []))
    })
    listPackages().then(setPackages).catch(() => {})
  }, [])

  const scrollToProjection = () => document.getElementById('projection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Links to /#projection land on the projection, once the loading screen is out of the way.
  useEffect(() => {
    if (window.location.hash !== '#projection') return
    let t = 0
    splashLifting.then(() => (t = window.setTimeout(scrollToProjection, 400)))
    return () => window.clearTimeout(t)
  }, [])

  const onlineNow = Math.max(
    MIN_SCREENS_ONLINE,
    tuktuks.filter(
      (t) => t.active && t.last_seen_at && Date.now() - new Date(t.last_seen_at).getTime() < ONLINE_THRESHOLD_MS,
    ).length,
  )
  const adsRunning = Math.max(MIN_ADS_RUNNING, ads.length)
  const shownPackages = packages.length ? packages : BROCHURE_PACKAGES

  // Hero entrance — once, as the loading screen lifts.
  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
        splashLifting.then(() => gsap.delayedCall(0.25, () => intro.play()))
        intro
          .from('[data-hero="logo"]', { scale: 0.2, rotate: -20, opacity: 0, duration: 1.2, ease: 'back.out(1.8)' })
          .from('[data-hero-word]', { yPercent: 120, rotateX: -80, opacity: 0, transformPerspective: 800, duration: 1.2, stagger: 0.05 }, '-=0.7')
          .from('[data-hero="sub"]', { y: 30, opacity: 0, filter: 'blur(10px)', duration: 1 }, '-=0.8')
          .from('[data-hero="move"]', { x: -60, opacity: 0, duration: 0.9 }, '-=0.7')
          .from('[data-hero="cta"] > *', { y: 30, opacity: 0, duration: 0.8, stagger: 0.1 }, '-=0.6')
          .from('[data-hero="cue"]', { y: 20, opacity: 0, duration: 0.8 }, '-=0.6')
        gsap.to('[data-ticker-track]', { xPercent: -50, duration: 32, ease: 'none', repeat: -1 })
        gsap.to('[data-hero="cue-dot"]', { y: 18, opacity: 0, duration: 1.4, ease: 'power2.in', repeat: -1 })
      })
    },
    { scope: rootRef },
  )

  // Scroll choreography. Re-built when content changes (packages and ads load after first paint).
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const scroller = window
      // The portal header is sticky, so pinned sections stop just below it.
      const headerOffset = document.querySelector('header')?.offsetHeight ?? 0
      const once = (trigger: gsap.DOMTarget, start = 'top 82%') => ({ trigger, scroller, start, once: true })
      const all = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, root)
      const mm = gsap.matchMedia()

      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          wide: '(min-width: 1024px)',
        },
        (ctx) => {
          const { motion, wide } = ctx.conditions as { motion: boolean; wide: boolean }
          if (!motion) return

          // Hero: pinned while it peels away once it sits side by side (lg); stacked layouts just fade out as they scroll.
          const heroOut = gsap.timeline({
            scrollTrigger: {
              trigger: '[data-hero-section]',
              scroller,
              start: `top top+=${headerOffset}`,
              end: wide ? '+=80%' : 'bottom top',
              scrub: 1,
              pin: wide,
              anticipatePin: 1,
            },
          })
          heroOut
            .to('[data-hero="content"]', { yPercent: -18, scale: 0.9, opacity: 0, filter: 'blur(8px)', ease: 'none' }, 0)
            .to('[data-hero="scene"]', { scale: 1.5, opacity: 0.25, ease: 'none' }, 0)
            .to('[data-hero="cue-out"]', { opacity: 0, ease: 'none' }, 0)

          // Statement: words light up one by one as you scroll through it.
          gsap.fromTo(
            '[data-statement-word]',
            { opacity: 0.12 },
            {
              opacity: 1,
              stagger: 0.1,
              ease: 'none',
              scrollTrigger: { trigger: '[data-statement]', scroller, start: 'top 70%', end: 'bottom 55%', scrub: 1 },
            },
          )

          // Section headlines flip up word by word.
          all('[data-split-heading]').forEach((h) =>
            gsap.from(h.querySelectorAll('[data-split-word]'), {
              yPercent: 120,
              rotateX: -85,
              opacity: 0,
              transformPerspective: 800,
              transformOrigin: '50% 100%',
              duration: 1.2,
              stagger: 0.06,
              ease: 'expo.out',
              scrollTrigger: once(h, h.dataset.revealStart ?? 'top 82%'),
            }),
          )
          all('[data-tab]').forEach((el) =>
            gsap.from(el, { x: -80, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: once(el, 'top 88%') }),
          )
          all('[data-reveal]').forEach((el) =>
            gsap.from(el, {
              y: el.dataset.reveal === 'scale' ? 0 : 90,
              scale: el.dataset.reveal === 'scale' ? 0.85 : 1,
              opacity: 0,
              filter: 'blur(14px)',
              duration: 1.3,
              ease: 'expo.out',
              // Things near the very bottom of the page start as soon as they peek in, or short screens never reach them.
              scrollTrigger: once(el, el.dataset.revealStart ?? 'top 82%'),
            }),
          )
          all('[data-reveal-stagger]').forEach((el) =>
            gsap.from(el.children, {
              y: 100,
              scale: 0.88,
              opacity: 0,
              filter: 'blur(12px)',
              duration: 1.2,
              stagger: 0.12,
              ease: 'expo.out',
              scrollTrigger: once(el),
            }),
          )

          // Packages swing in from either side.
          all('[data-package]').forEach((el) =>
            gsap.from(el, {
              x: el.dataset.package === 'left' ? -220 : 220,
              rotateY: el.dataset.package === 'left' ? 40 : -40,
              rotateX: -10,
              opacity: 0,
              transformPerspective: 1200,
              duration: 1.5,
              ease: 'expo.out',
              scrollTrigger: once('[data-packages]', 'top 78%'),
            }),
          )

          // Savings rows wipe in (cards on phones, the table from md up).
          all('[data-compare]').forEach((el) =>
            gsap.fromTo(
              el.querySelectorAll('[data-compare-row]'),
              { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
              { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.9, stagger: 0.09, ease: 'power3.out', scrollTrigger: once(el) },
            ),
          )

          gsap.from('[data-pillar]', { scale: 0, rotate: -60, duration: 1.1, stagger: 0.14, ease: 'back.out(2.4)', scrollTrigger: once('[data-pillars]') })

          // Colour glows drift against the scroll for depth.
          all('[data-glow]').forEach((el) =>
            gsap.to(el, {
              yPercent: -60,
              ease: 'none',
              scrollTrigger: { trigger: el.parentElement, scroller, start: 'top bottom', end: 'bottom top', scrub: true },
            }),
          )

          // Final call to action opens out from a card to full width.
          gsap.fromTo(
            '[data-finale]',
            { clipPath: 'inset(12% 8% round 48px)' },
            {
              clipPath: 'inset(0% 0% round 0px)',
              ease: 'none',
              scrollTrigger: { trigger: '[data-finale]', scroller, start: 'top 90%', end: 'top 30%', scrub: 1 },
            },
          )

          // Numbers tick up from zero.
          const counters = all('[data-count]').map((el) => {
            const final = el.textContent
            const target = Number(el.dataset.count)
            const decimals = Number(el.dataset.decimals || 0)
            const format = (v: number) =>
              `${el.dataset.prefix ?? ''}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${el.dataset.suffix ?? ''}`
            const state = { v: 0 }
            el.textContent = format(0)
            gsap.to(state, {
              v: target,
              duration: 2.2,
              ease: 'expo.out',
              scrollTrigger: once(el, 'top 92%'),
              onUpdate: () => (el.textContent = format(state.v)),
              onComplete: () => (el.textContent = final),
            })
            return { el, final }
          })
          // Put the real numbers back when these animations are torn down.
          return () => counters.forEach(({ el, final }) => (el.textContent = final))
        },
      )
      ScrollTrigger.refresh()
    },
    { scope: rootRef, dependencies: [shownPackages.length], revertOnUpdate: true },
  )

  return (
    <div ref={rootRef} className="overflow-x-clip text-white">
      {/* ───────── Hero ───────── */}
      <section data-hero-section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-zinc-950">
        <div className="brand-stripe absolute inset-x-0 top-0 z-20" aria-hidden />
        <div data-hero="scene" className="absolute inset-0 -z-10">
          {showMap && (
            <Suspense fallback={null}>
              <CityMapScene theme="dark" className="h-full w-full" />
            </Suspense>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950/85 via-zinc-950/30 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-zinc-950 to-transparent" aria-hidden />

        <div
          data-hero="content"
          className="mx-auto flex w-full max-w-[96rem] flex-1 items-center px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-20 lg:px-12 lg:py-16 lg:[@media(max-height:820px)]:py-8 short:py-5!"
        >
          <div className="max-w-5xl">
            <div className="mb-4 flex flex-wrap items-center gap-5 sm:mb-6 sm:gap-7 short:mb-2!">
              <img
                data-hero="logo"
                src="/logo.webp"
                width={384}
                height={384}
                fetchPriority="high"
                alt="Village Media — a Village Tuk advertising network"
                className="h-16 w-auto drop-shadow-2xl sm:h-28 lg:h-32 lg:[@media(max-height:820px)]:h-20 short:h-12!"
              />
            </div>
            <h1
              className="mb-4 text-[clamp(2rem,4vw+1.1rem,5.75rem)] font-black italic leading-[0.95] tracking-tight text-balance sm:mb-5 short:mb-2! short:text-[clamp(1.6rem,4.2vw,2.4rem)]!"
              aria-label={HEADLINE}
            >
              <SplitWords text={HEADLINE} wordAttr="data-hero-word" />
            </h1>
            <p data-hero="sub" className="max-w-2xl text-base text-zinc-300 sm:text-xl short:text-sm!">
              Village Media gives your business continuous, mobile exposure throughout Midvaal — at a price local businesses
              can afford.
            </p>
            <p data-hero="move" className="mt-4 text-lg font-black uppercase italic sm:mt-5 sm:text-2xl short:mt-2! short:text-base!">
              Local businesses{' '}
              <span className="text-logo-gold underline decoration-logo-red decoration-4 underline-offset-4">on the move</span>
            </p>
            <div data-hero="cta" className="mt-6 flex flex-wrap gap-3 sm:mt-8 short:mt-3!">
              <button
                onClick={scrollToProjection}
                className="rounded-full bg-brand-500 px-6 py-3.5 text-base font-semibold text-on-accent shadow-xl shadow-brand-500/30 hover:bg-brand-400 sm:px-7 sm:py-4"
              >
                📈 See what your ad gets
              </button>
              <SignUpButton className="rounded-full bg-logo-green px-6 py-3.5 text-base font-semibold text-on-accent shadow-xl shadow-green-500/25 hover:brightness-110 sm:px-7 sm:py-4">
                ✎ Sign up now
              </SignUpButton>
            </div>
          </div>
        </div>

        <div data-hero="cue-out" className="absolute inset-x-0 bottom-4 z-10 hidden justify-center [@media(min-height:760px)]:flex" aria-hidden>
        <div data-hero="cue" className="flex flex-col items-center gap-2 text-xs uppercase tracking-[0.3em] text-zinc-500">
          Scroll
          <span className="relative h-10 w-6 rounded-full border border-zinc-600">
            <span data-hero="cue-dot" className="absolute left-1/2 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-logo-gold" />
          </span>
        </div>
        </div>
      </section>

      {/* ───────── Ticker ───────── */}
      <div className="overflow-hidden border-y border-zinc-800 bg-zinc-950 py-5" aria-hidden>
        <div data-ticker-track className="flex w-max whitespace-nowrap text-[clamp(1.25rem,3vw,2.25rem)] font-black uppercase italic text-zinc-300">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-10 pr-10">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-10">
                  {t}
                  <span className={TICKER_DOTS[i % TICKER_DOTS.length]}>●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ───────── Statement ───────── */}
      <section data-statement className="flex min-h-[80svh] items-center px-5 py-24 sm:px-8 lg:px-12">
        <p className="mx-auto max-w-6xl text-center text-[clamp(2.25rem,6.5vw,6rem)] font-black uppercase italic leading-[1] tracking-tight" aria-label={STATEMENT}>
          {STATEMENT.split(' ').map((word, i) => (
            <span key={i} data-statement-word className="mr-[0.22em] inline-block" aria-hidden>
              {word}
            </span>
          ))}
        </p>
      </section>

      {/* ───────── Reach ───────── */}
      <Band glow={['bg-logo-blue', 'bg-logo-gold']}>
        <SectionHeading eyebrow="Reach" title="Thousands of eyes. Every month." intro="Seated passengers, facing the screen, for the whole trip." />
        <div data-reveal-stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {REACH.map((r) => (
            <div key={r.label} className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 text-center backdrop-blur sm:p-8">
              <p className="text-4xl sm:text-5xl" aria-hidden>
                {r.icon}
              </p>
              <p className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-black leading-none">
                {r.count ? <Count value={r.count} suffix={r.suffix} /> : r.value}
              </p>
              <p className="mt-2 text-sm text-zinc-400 sm:text-base">{r.label}</p>
              {r.note && <p className="text-xs text-zinc-500">{r.note}</p>}
            </div>
          ))}
        </div>
        <p data-reveal className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${onlineNow ? 'animate-pulse bg-green-500' : 'bg-zinc-600'}`} />
            Live right now: <b className="text-zinc-200">{onlineNow}</b> screens online
          </span>
          <span>
            <b className="text-zinc-200">{adsRunning}</b> ads running today
          </span>
        </p>
      </Band>

      {/* ───────── Packages ───────── */}
      <Band glow={['bg-logo-red', 'bg-logo-blue']} className="bg-zinc-900/30">
        <SectionHeading eyebrow="Packages" title="Two ways to get on screen." intro="Simple monthly pricing on a 12-month term." />
        <div data-packages className="grid gap-6 md:grid-cols-2 lg:gap-10 [perspective:1400px]">
          {shownPackages.map((p, i) => {
            const theme = PACKAGE_THEMES[i % PACKAGE_THEMES.length]
            return (
              <TiltCard
                key={p.id || p.name}
                side={i % 2 === 0 ? 'left' : 'right'}
                className={`flex flex-col overflow-hidden rounded-3xl border-2 ${theme.ring} bg-zinc-900 shadow-2xl ${theme.glow} will-change-transform`}
              >
                <div className={`${theme.head} px-6 py-4 text-center text-on-accent`}>
                  <p className="text-xl font-extrabold uppercase sm:text-2xl">{p.name}</p>
                  {p.description && <p className="text-sm font-semibold uppercase opacity-90">{p.description.split('·')[0]}</p>}
                </div>
                <div className="flex flex-1 flex-col p-6 sm:p-8">
                  <p className="mb-4 flex flex-wrap items-baseline justify-center gap-2">
                    <span className="text-3xl" aria-hidden>
                      {theme.icon}
                    </span>
                    <span className={`text-[clamp(3rem,7vw,4.5rem)] font-black leading-none ${theme.price}`}>
                      {formatRand(p.monthly_fee).replace(/[.,]00$/, '')}
                    </span>
                    <span className="text-sm font-semibold text-zinc-400">per month</span>
                  </p>
                  {p.description?.includes('·') && (
                    <p className="mx-auto mb-4 rounded-xl bg-yellow-300 px-5 py-1.5 text-center font-extrabold uppercase text-on-light">
                      {p.description.split('·')[1].trim()}
                    </p>
                  )}
                  <div className="mb-6 flex flex-wrap justify-center gap-2 text-xs font-semibold sm:text-sm">
                    {TERM_OPTIONS.map((t) => (
                      <span key={t.value} className="whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1 text-zinc-300">
                        📅 {t.label}
                      </span>
                    ))}
                    <span className="whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1 text-zinc-300">
                      📍 +R{EXTRA_AREA_FEE} per extra area
                    </span>
                  </div>
                  <ul className="mb-8 space-y-2.5 text-zinc-300 sm:text-lg">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <span className="text-green-400">✔</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <SignUpButton
                    prefill={{ package: p.name }}
                    params={{ package: p.id }}
                    className="mt-auto rounded-full bg-logo-green py-4 text-center text-lg font-semibold text-on-accent hover:brightness-110"
                  >
                    ✎ Sign up with {p.name.replace(/ package$/i, '')}
                  </SignUpButton>
                </div>
              </TiltCard>
            )
          })}
        </div>
      </Band>

      {/* ───────── Projection (was its own page) ───────── */}
      <Band glow={['bg-logo-green', 'bg-logo-blue']}>
        <ProjectionSection
          heading={<SectionHeading eyebrow="Your projection" title="What would your ad get?" intro="Standard and Premium side by side. Pick the areas you want to be seen in." />}
        />
      </Band>

      {/* ───────── Cost per ad ───────── */}
      <Band className="bg-zinc-900/30">
        <SectionHeading
          eyebrow="Cost per ad"
          title="Cents per play. Not thousands."
          intro="What each play of your ad costs, and how much you keep in your pocket compared with other ways to advertise."
        />
        <div data-reveal-stagger className="mb-8 grid gap-6 md:grid-cols-2">
          {PLAYS.map((p) => (
            <div key={p.name} className={`overflow-hidden rounded-3xl border bg-zinc-900 text-center ${p.ring}`}>
              <p className={`px-5 py-3 font-bold uppercase text-on-accent ${p.head}`}>
                {p.name} ({p.seconds} seconds)
              </p>
              <div className="p-6 sm:p-8">
                <p className={`text-[clamp(3rem,7vw,4.5rem)] font-black leading-none ${p.price}`}>
                  <Count value={p.fee / PLAYS_PER_MONTH} decimals={2} prefix="±R" />
                </p>
                <p className="mt-2 text-zinc-300">per play</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {rand(p.fee)} a month ÷ {PLAYS_PER_MONTH.toLocaleString('en-US')} plays in one area
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Phones: one card per medium, so the savings are never scrolled out of sight. */}
        <div data-compare className="grid gap-3 md:hidden">
          {COMPARE.map((c) => (
            <div key={c.medium} data-compare-row className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="flex items-baseline justify-between gap-3 font-semibold">
                <span>
                  <span className="mr-2" aria-hidden>
                    {c.icon}
                  </span>
                  {c.medium}
                </span>
                <span className="shrink-0 text-sm text-red-400">up to {rand(c.max)}</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {PLAYS.map((p) => (
                  <p key={p.name} className="rounded-xl bg-green-500/10 px-3 py-2">
                    <span className="block text-xs text-zinc-400">Save with {p.name}</span>
                    <b className="text-green-300">{rand(c.max - p.fee)} / month</b>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div data-compare className="hidden overflow-hidden rounded-3xl border border-zinc-800 md:block">
          <table className="w-full text-left lg:text-lg">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500 sm:text-sm">
              <tr>
                <th className="px-5 py-4">Instead of</th>
                <th className="px-5 py-4">They charge up to</th>
                {PLAYS.map((p) => (
                  <th key={p.name} className="px-5 py-4">
                    You save with {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {COMPARE.map((c) => (
                <tr key={c.medium} data-compare-row>
                  <td className="px-5 py-4 font-semibold">
                    <span className="mr-2" aria-hidden>
                      {c.icon}
                    </span>
                    {c.medium}
                  </td>
                  <td className="px-5 py-4 font-semibold text-red-400">{rand(c.max)} / month</td>
                  {PLAYS.map((p) => (
                    <td key={p.name} className="px-5 py-4 font-bold text-green-300">
                      {rand(c.max - p.fee)} / month
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p data-reveal className="mt-6 rounded-2xl bg-green-500/15 px-5 py-4 text-center text-lg font-bold text-green-200 sm:text-xl">
          Save up to {rand((BIGGEST_SAVING - PLAYS[0].fee) * 12)} a year compared with radio or billboard advertising.
        </p>
        <p data-reveal className="mt-4 text-center text-xs italic text-zinc-500">
          Savings compare our monthly price with the top of each medium's typical monthly cost. Plays are estimates for one
          area; actual results may vary with operating hours and other factors.
        </p>
      </Band>

      {/* ───────── Why choose ───────── */}
      <Band glow={['bg-logo-green', 'bg-logo-red']} className="bg-zinc-900/30">
        <SectionHeading eyebrow="Why Village Media" title="Built for local business." />
        <div data-reveal-stagger className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w) => (
            <div key={w.text} className="flex items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-7">
              <span className="text-4xl" aria-hidden>
                {w.icon}
              </span>
              <span className="text-zinc-300 sm:text-lg">{w.text}</span>
            </div>
          ))}
        </div>
        <div data-pillars className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.label} className="text-center">
              <span
                data-pillar
                className={`mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-xl sm:h-24 sm:w-24 sm:text-5xl ${p.bg}`}
                aria-hidden
              >
                {p.icon}
              </span>
              <p className="font-extrabold uppercase sm:text-lg">{p.label}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* ───────── How it works ───────── */}
      <Band glow={['bg-logo-blue', 'bg-logo-gold']}>
        <SectionHeading eyebrow="How it works" title="Live in four steps." />
        <div data-reveal-stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
              <div className={`absolute inset-x-0 top-0 h-1.5 ${STEP_COLORS[i]}`} aria-hidden />
              <p className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-on-accent ${STEP_COLORS[i]}`}>
                {i + 1}
              </p>
              <p className="mb-2 text-lg font-bold">{s.title}</p>
              <p className="text-zinc-400">{s.body}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* ───────── Fine print ───────── */}
      <Band>
        <div data-reveal className="mx-auto max-w-4xl rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-10">
          <h2 className="mb-4 text-2xl font-bold">The fine print, in plain language</h2>
          <ul className="space-y-3 text-zinc-300">
            {TERMS.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        </div>
      </Band>

      {/* ───────── Finale ───────── */}
      <section
        data-finale
        className="relative flex min-h-[80svh] items-center justify-center overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-5 py-24 text-center text-on-accent sm:px-8"
      >
        <div className="brand-stripe absolute inset-x-0 top-0" aria-hidden />
        <div className="max-w-4xl">
          <h2 data-split-heading data-reveal-start="top bottom" className="mb-5 text-[clamp(2.75rem,8vw,7rem)] font-black uppercase italic leading-[0.9] tracking-tight" aria-label="Ready to get on screen?">
            <SplitWords text="Ready to get on screen?" wordAttr="data-split-word" />
          </h2>
          <p data-reveal data-reveal-start="top bottom" className="mx-auto mb-10 max-w-2xl text-lg text-on-accent/85 sm:text-xl">
            Sign up in a minute and our sales team will get your ad on screen.
          </p>
          <div data-reveal data-reveal-start="top bottom">
            <SignUpButton className="inline-block rounded-full bg-logo-green px-12 py-5 text-xl font-semibold text-on-accent shadow-2xl hover:brightness-110">
              ✎ Sign up now
            </SignUpButton>
          </div>
          <p data-reveal data-reveal-start="top bottom" className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-base font-semibold sm:text-lg">
            <a href={`mailto:${VILLAGE_MEDIA.email}`} className="underline decoration-on-accent/40 underline-offset-4 hover:decoration-on-accent">
              ✉ {VILLAGE_MEDIA.email}
            </a>
            <a href={`https://${VILLAGE_MEDIA.website}`} target="_blank" rel="noopener" className="underline decoration-on-accent/40 underline-offset-4 hover:decoration-on-accent">
              ↗ {VILLAGE_MEDIA.website}
            </a>
          </p>
        </div>
      </section>

      <footer className="bg-zinc-950 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <img
          src="/digital-solutions-banner.png"
          alt="Site proudly built by Digital Solutions SA"
          width={1000}
          height={50}
          loading="lazy"
          className="mx-auto hidden h-auto w-full max-w-[1000px] sm:block"
        />
        <p className="flex items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-300 sm:hidden">
          Site proudly built by
          <img src="/digital-solutions-logo.png" alt="Digital Solutions SA" width={110} height={50} loading="lazy" className="h-10 w-auto" />
        </p>
      </footer>

      <SignUpDialog />
    </div>
  )
}
