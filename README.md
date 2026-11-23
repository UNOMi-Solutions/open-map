# OpenMap

An interactive data visualization platform that maps US statistics across crime, health, environment, economics, politics, law enforcement, and social data sourced from government APIs and displayed on a live map.

**Live site:** [getopenmap.com](https://getopenmap.com)

---

## Architecture

This is a monorepo with two independently deployed services:

```
openmap/
├── frontend/          # React + Vite app → deployed to Vercel
│   ├── client/src/    # All React source code lives here
│   ├── vercel.json    # Vercel build config
│   └── .env           # Frontend environment variables (not committed)
│
├── backend/           # Express API → deployed to Google Cloud Run
│   ├── routes/        # One file per data category
│   ├── middleware/    # Auth, rate limiting, security, logging
│   ├── models/        # Mongoose schemas (User)
│   ├── db/            # MongoDB connection
│   ├── data/          # CSV files used at runtime
│   ├── Dockerfile     # Container definition for Cloud Run
│   └── .env           # Backend environment variables (not committed)
│
└── .github/workflows/
    ├── deploy-backend.yml   # Auto-deploys backend on changes to backend/**
    └── deploy-frontend.yml  # Auto-deploys frontend on changes to frontend/**
```

---

## How Deployments Work

Deployments are fully automatic via GitHub Actions:

- Push changes to `backend/**` → builds a Docker image, pushes to Google Artifact Registry, deploys to Cloud Run
- Push changes to `frontend/**` → runs `vite build`, deploys to Vercel

You do not need to manually deploy anything. Just push to `main`.

---

## Local Development

### Prerequisites

- Node.js v20+
- A `.env` file in both `backend/` and `frontend/` (see below)

### Backend

```bash
cd backend
npm install
npm run dev        # starts with nodemon on port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run web        # starts Vite dev server
```

---

## Environment Variables

**Never commit `.env` files.** Both are in `.gitignore`.

### `backend/.env`

```
PORT=8080
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=...
FBI_CRIME_KEY=...
CENSUS_API_KEY=...
BEA_API_KEY=...
ECONOMY_KEY=...                    # Census API key used for county income and county GEOIDs
BLS_API_KEY=...                    # Registered BLS API key used for county unemployment
API_DEV_KEY=...
EIA_API_KEY=...
AQICN_API_TOKEN=...
RESEND_API_KEY=...
EMAIL_FROM=noreply@getopenmap.com
FRONTEND_URL=https://getopenmap.com
DOMAIN=https://getopenmap.com
STRIPE_SECRET_KEY=sk_live_...        # Stripe API key (used for Checkout + webhook)
STRIPE_WEBHOOK_SECRET=whsec_...      # Signing secret for /api/v1/stripe/webhook
NODE_ENV=production
GOOGLE_CLIENT_ID=...                 # OAuth 2.0 Web client ID (Sign in with Google)
GOOGLE_CLIENT_SECRET=...             # OAuth 2.0 Web client secret
```

Stripe Checkout lives on the backend (`backend/routes/stripe.js` +
`backend/routes/stripeWebhook.js`). Point a Stripe webhook endpoint at
`https://api.getopenmap.com/api/v1/stripe/webhook` (events:
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_succeeded`) and copy its
signing secret into `STRIPE_WEBHOOK_SECRET`. Plan price IDs are defined in
`backend/stripePriceMap.js`.

**Sign in with Google.** Create an OAuth 2.0 **Web application** client in
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) (APIs
& Services → Credentials). Use the same client ID in `GOOGLE_CLIENT_ID` and
`VITE_GOOGLE_CLIENT_ID`, and put the client secret in `GOOGLE_CLIENT_SECRET`.

Authorized JavaScript origins:

- `http://localhost:5173` (Vite)
- `https://getopenmap.com`
- `https://www.getopenmap.com`

Authorized redirect URIs (GIS popup uses `postmessage` automatically, but the
origins above should still be listed as redirect URIs):

- `http://localhost:5173`
- `https://getopenmap.com`
- `https://www.getopenmap.com`

After adding production values, set them in Cloud Run (backend) and Vercel
(frontend `VITE_GOOGLE_CLIENT_ID`), then redeploy.

### `frontend/.env`

```
VITE_API_LINK=https://api.getopenmap.com
VITE_API_DEV_KEY=...
DOMAIN=https://getopenmap.com
FRONTEND_URL=https://getopenmap.com
VITE_STRIPE_PUBLISHABLE_KEY=...
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
VITE_EMAILJS_PAYMENT_TEMPLATE_ID=...
VITE_EMAILJS_WAITLIST_TEMPLATE_ID=...
VITE_MAILCHIMP_URL=...
VITE_GOOGLE_CLIENT_ID=...            # Same OAuth Web client ID as backend GOOGLE_CLIENT_ID

# Google AdSense (banner + video / in-feed ads)
VITE_ADSENSE_CLIENT=ca-pub-4397282403486242
VITE_ADSENSE_SLOT_BANNER=
VITE_ADSENSE_SLOT_VIDEO=
VITE_ADSENSE_SLOT_SIDEBAR=
VITE_ADSENSE_SLOT_INFEED=
```

The AdSense loader script is hard-wired in `frontend/client/index.html` with
`ca-pub-4397282403486242`. `frontend/client/public/ads.txt` is served at
`https://getopenmap.com/ads.txt` and authorizes Google to sell our inventory.

Banner and video ad components live in `frontend/client/src/components/ads/`.
They render nothing until the matching `VITE_ADSENSE_SLOT_*` env vars are
populated (after AdSense approves the site and you create ad units in the
"Ads → By ad unit" tab).

For local development, set `VITE_API_LINK=http://localhost:8080` in `frontend/.env`.

---

## API Routes

All data routes require an `x-api-key` header matching `API_DEV_KEY`.

| Route | Description |
|---|---|
| `GET /api/v1/crime/murderByState` | Murder data by state |
| `GET /api/v1/crime/arrestsByState` | Arrest data by state and offense |
| `GET /api/v1/crime/missingPersons` | NamUs open missing persons cases (`npm run seed:missing-persons` refreshes the bundled snapshot) |
| `GET /api/v1/environment/*` | Environmental data (disasters, emissions, air quality) |
| `GET /api/v1/environment/nasaLayers?ids=...` | NASA GIBS satellite layer metadata (tile template, available dates, legend) for the given GIBS identifiers |
| `GET /api/v1/lawEnforcement/*` | Law enforcement statistics |
| `GET /api/v1/census/*` | Census data |
| `GET /api/v1/economics/*` | Economic data |
| `GET /api/v1/economics/unemploymentByCounty` | Latest county unemployment rates from BLS LAUS; optional `start=YYYY-MM&end=YYYY-MM` returns each month in the inclusive range |
| `GET /api/v1/economics/highIncomeHouseholdsByCounty` | County share and count of households with income of $200,000 or more from ACS table B19001 |
| `GET /api/v1/health/*` | Health data |
| `GET /api/v1/politics/*` | Political data |
| `GET /api/v1/social/*` | Social data |

The county unemployment layer uses BLS Local Area Unemployment Statistics
(LAUS). Configure `BLS_API_KEY` from the [BLS Public Data API documentation
and registration page](https://www.bls.gov/developers/api_signature_v2.htm). Without
date parameters, the endpoint returns the latest month. Supplying both `start`
and `end` (for example, `?start=2024-01&end=2024-12`) returns a `months` array
with county rates for each available month in the inclusive range. Ranges must
be ordered, start in 1990 or later, end no later than the current year, and span
no more than 20 calendar years. The backend requests county series in batches
of 50 and caches successful results for 24 hours.

The high-income households layer uses the 2024 ACS 5-year estimates.
`B19001_017E` counts households with income of $200,000 or more, and
`B19001_001E` is the total-household denominator used to calculate each
county's percentage. It uses the existing `ECONOMY_KEY` Census API key.

Auth routes (no API key needed):

| Route | Description |
|---|---|
| `POST /api/v1/auth/register` | Register a new user |
| `GET /api/v1/auth/verify?token=...` | Verify email address |
| `POST /api/auth/login` | Login |
| `POST /api/v1/auth/google` | Sign in with Google |

---

## Making Changes Safely

**Adding a new data route:**
1. Create or edit a file in `backend/routes/`
2. Register it in `backend/index.js` with `app.use("/api/v1/yourRoute", auth, yourRoutes)`
3. Push to `main` — Cloud Run redeploys automatically

**Adding a new frontend page:**
1. Add your component under `frontend/client/src/pages/` or `frontend/client/src/components/`
2. Wire it up in `App.tsx`
3. Push to `main` — Vercel redeploys automatically

**Changing environment variables:**
- Backend: update the Variables & Secrets section in Google Cloud Run console, then redeploy
- Frontend: update the Environment Variables section in Vercel dashboard, then trigger a redeploy

**Do not:**
- Commit `.env` files
- Change `app.listen` port away from `8080` in the backend (Cloud Run requires it)
- Use string wildcards like `"*"` or `"(.*)"` in Express 5 route paths — use RegExp (`/.*/`) instead
- Call `process.exit()` during startup — it will crash the Cloud Run container before the health check passes

---

## Infrastructure

| Service | Provider | URL |
|---|---|---|
| Frontend | Vercel | getopenmap.com |
| Backend API | Google Cloud Run | api.getopenmap.com |
| Database | MongoDB Atlas | cluster0.qrmvrhr.mongodb.net |
| Container Registry | Google Artifact Registry | us-central1-docker.pkg.dev |
| Email | Resend (SMTP) | smtp.resend.com |
| DNS | GoDaddy | getopenmap.com |

---

## Key Things to Know

- **Express 5** is in use. Route wildcards must be RegExp: `app.options(/.*/, handler)` — string wildcards throw a `PathError` at startup.
- **MongoDB Atlas** network access is set to `0.0.0.0/0` because Cloud Run uses dynamic IPs. This is intentional.
- **API keys** should be rotated periodically. Priority: Stripe, OpenAI, MongoDB password, Mailchimp.
- The `frontend/server/` directory is legacy code from the original Replit setup and is not used in production. Do not delete it without auditing imports first.

---

## NASA Satellite Layers

The "Satellite (NASA)" sidebar section shows raster layers from NASA GIBS (Global Imagery Browse Services). No API key is needed; the browser loads tiles directly from `gibs.earthdata.nasa.gov`.

| File | Role |
|---|---|
| `frontend/client/src/lib/nasaLayers.ts` | The list of layers (data only) and the date rules |
| `frontend/client/src/components/ui/NasaLayers.tsx` | Renders every selected NASA layer and one shared legend with the date control |
| `backend/lib/nasaGibs.js` | Reads NASA's WMTS capabilities and returns tile template, native zoom, available dates and legend per layer (cached 6 h) |

**Adding a layer:** add one line to `NASA_LAYERS` with the exact GIBS identifier. Nothing else changes. If NASA retires an identifier the backend lists it under `missing` and the layer is skipped instead of drawing blank tiles.

**Modeling choices**
- Only layers that returned data over at least 95% of US land in the 2026-11-14 audit are listed (amphibian richness, 94%, is the one exception). Single-orbit swath products and event layers (daily AIRS L2, AMSR2, TEMPO, dust score, SO2 index) are left out because they render as scattered strips. Monthly gridded products are used in their place.
- GIBS returns a transparent tile, not an error, for a date it does not hold. Every requested date is therefore snapped to a value the layer declares (first of the month for monthly layers, the year for yearly ones).
- "Latest" is NASA's newest date stepped back one period (one day for daily layers, one month for monthly), because the newest period is often still being filled in.
- The date picker applies to all NASA layers at once; each layer shows its closest earlier data and the legend states the date actually shown. Layers without a time dimension are labelled "Fixed dataset".
- Data layers draw at 70% opacity; photo imagery is opaque and sits below them. Layers cover the whole globe and repeat across the date line like the base map; only tiles in view are requested.
- These are satellite retrievals and model estimates, not ground measurements; the legend says so.
