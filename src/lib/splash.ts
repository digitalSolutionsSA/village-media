/**
 * The loading screen lives in index.html so it paints before any script. It stays up long enough for
 * the logo animation to read (MIN_MS from when it first painted), lifts as soon as the page is ready,
 * and never holds the page back longer than MAX_MS.
 */

const MIN_MS = 1250
const MAX_MS = 3000
const LIFT_MS = 1050 // columns slide away (.8s + .21s stagger)

// The pitch always opens on the hero (behind the loading screen), not wherever the last visit left off.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/** When the loading screen first painted, in ms since navigation started. */
const shownAt = () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0

let liftedResolve!: () => void
/** Resolves as the loading screen starts to lift — the hero entrance plays from here. */
export const splashLifting = new Promise<void>((r) => (liftedResolve = r))

let dismissed = false

/** Lift the loading screen once `ready` settles (or MAX_MS passes), but not before MIN_MS. */
export function dismissSplashWhen(ready: Promise<unknown>) {
  if (dismissed) return
  dismissed = true
  const el = document.getElementById('splash')
  if (!el) return liftedResolve()

  const onScreen = performance.now() - shownAt()
  const capped = Promise.race([ready.catch(() => {}), wait(MAX_MS - onScreen)])
  Promise.all([capped, wait(MIN_MS - onScreen)]).then(async () => {
    el.classList.add('done')
    await wait(280)
    el.classList.add('out')
    liftedResolve()
    await wait(LIFT_MS)
    el.remove()
  })
}
