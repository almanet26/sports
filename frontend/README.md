# Cricket Analytics — Frontend

React 19 + Vite 7 single-page application for the Cricket Analytics platform. Deployed on Vercel; communicates with the FastAPI backend on GCP Cloud Run.

## Tech Stack

| Category | Library |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Routing | React Router DOM 7 |
| State | Zustand 5 |
| HTTP | Axios |
| Styling | Tailwind CSS 3.4 |
| UI Primitives | Radix UI |
| Charts | Chart.js, Recharts |
| Animations | Framer Motion |
| Video Upload | Mux Upchunk |
| Testing | Vitest + React Testing Library |

## Quick Start

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL
npm run dev            # http://localhost:5173
```

## Environment Variables

Create `frontend/.env` (or copy from `.env.example`):

```env
VITE_API_URL=http://localhost:8000
VITE_BACKEND_PORT=8001
```

For production, `VITE_API_URL` must point to the Cloud Run service URL (set as a Vercel environment variable).

## Scripts

```bash
npm run dev      # Vite dev server with HMR
npm run build    # Type-check + production build → dist/
npm run preview  # Serve the dist/ build locally
npm run lint     # ESLint
npm run test     # Vitest (single run)
```

## Source Layout

```
src/
├── pages/              # Full-page route components (one per route)
├── components/
│   ├── gates/          # Subscription gate components
│   │   ├── FeatureGate.tsx         # Blocks a feature if the plan doesn't include it
│   │   ├── QuotaGate.tsx           # Blocks an action when the usage quota is exhausted
│   │   ├── UpgradePrompt.tsx       # Inline CTA linking to BillingPage
│   │   └── SubscriptionExpiredPrompt.tsx
│   ├── features/       # Feature-specific composed components
│   ├── layout/         # DashboardLayout, PublicLayout
│   └── ui/             # Generic primitives: Button, Card, Input, Progress, ToastHost
├── store/              # Zustand stores
│   ├── authStore.ts    # User session (login, logout, token state)
│   ├── themeStore.ts   # Dark/light theme toggle
│   └── toastStore.ts   # Global toast notification queue
├── lib/
│   ├── api.ts          # Axios instance — base URL from VITE_API_URL, Bearer token interceptor
│   ├── matchesApi.ts   # Match-specific API helpers
│   └── utils.ts        # General helpers
├── services/           # Higher-level service wrappers (playerProfile, playerVideos)
├── types/              # TypeScript types (plans.ts, subscriptionPlans.ts)
├── routes.tsx          # Route definitions
└── main.tsx            # React entry point
```

## Subscription Gates

Subscription-aware components guard features and quota limits without scattering plan checks across pages.

```tsx
// Block a whole feature by plan
<FeatureGate feature="ocr_highlights" requiredPlan="coach_starter">
  <TriggerOCRButton />
</FeatureGate>

// Block an action when quota is exhausted
<QuotaGate quotaKey="biomech">
  <AnalyzeButton />
</QuotaGate>
```

Gate logic lives in `components/gates/featureGateLogic.ts`.

## Testing

```bash
npm run test                    # All tests (single run)
npm run test -- --watch         # Watch mode
npm run test -- --coverage      # Coverage report
```

Tests live alongside their components (`*.test.tsx`) and in `src/test/`. The test environment is `jsdom` (configured in `vite.config.ts`).

## Deployment (Vercel)

1. Connect the GitHub repository to Vercel.
2. Set the **Root Directory** to `frontend`.
3. Add environment variable: `VITE_API_URL` = Cloud Run service URL.
4. Vercel builds with `npm run build` and serves `dist/`.

Vercel Analytics and Speed Insights are already wired in via `@vercel/analytics` and `@vercel/speed-insights`.
