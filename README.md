# Village Media — Pitch page

Standalone copy of the sales Pitch page from the ad platform
(`D:\APPS\village-tuktuks-ads-main\src\pages\sales\Pitch.tsx`, with
`components/pitch/CityMapScene.tsx` and `ProjectionSection.tsx`).

The 3D town hero, GSAP scroll animations, reach figures, packages, projection
calculator, cost-per-play comparison, how it works, fine print and brochure
viewer are all as in the platform. "⛶ Present full screen" is for the tablet.

Stack: Vite + React + TypeScript + Tailwind CSS v4 + GSAP + three.js.

```bash
npm install
npm run dev
npm run build    # static site in dist/
```

## What's different from the platform version

- No router or staff login: it's a single public page.
- "Sign up" buttons go to `VITE_SIGNUP_URL` instead of the platform's `/admin/signup`.
  If that's blank they open a sign-up form, which `netlify/functions/enquiry.mts`
  emails to sales@vm-group.co.za through Resend (`RESEND_API_KEY` in Netlify's
  environment variables; see `.env.example`).
- The projection pre-fills from `?name=…&area=…` in the URL, not from a lead.
- Dark theme only.

## Live data (optional)

Copy `.env.example` to `.env.local` and fill in the platform's Supabase URL and
anon key. The anon role needs read access to `tuktuks`, `creatives` and
`sales_packages`; otherwise the page quietly uses the built-in figures.

When copying changes over from the platform, keep the constants in
`src/lib/site.ts` in step with `agreementText.ts`.
