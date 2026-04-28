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
API_DEV_KEY=...
EIA_API_KEY=...
AQICN_API_TOKEN=...
RESEND_API_KEY=...
EMAIL_FROM=noreply@getopenmap.com
FRONTEND_URL=https://getopenmap.com
NODE_ENV=production
```

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
| `GET /api/v1/crime/missingPersons` | FBI missing persons data |
| `GET /api/v1/environment/*` | Environmental data (disasters, emissions, air quality) |
| `GET /api/v1/lawEnforcement/*` | Law enforcement statistics |
| `GET /api/v1/census/*` | Census data |
| `GET /api/v1/economics/*` | Economic data |
| `GET /api/v1/health/*` | Health data |
| `GET /api/v1/politics/*` | Political data |
| `GET /api/v1/social/*` | Social data |

Auth routes (no API key needed):

| Route | Description |
|---|---|
| `POST /api/v1/auth/register` | Register a new user |
| `GET /api/v1/auth/verify?token=...` | Verify email address |
| `POST /api/auth/login` | Login |

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
