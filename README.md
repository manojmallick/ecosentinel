# EcoSentinel

[![CI](https://github.com/manojmallick/ecosentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/manojmallick/ecosentinel/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Express](https://img.shields.io/badge/Express-4-1f2937)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Railway](https://img.shields.io/badge/API-Railway-7c3aed)
![Vercel](https://img.shields.io/badge/Web-Vercel-000000)

AI-powered, hyper-local air quality intelligence for Amsterdam. EcoSentinel combines scheduled AQI collection, requested-location live fallback reads, EPA normalisation, predictive air-quality modeling, policy-ready reporting, and a resident-facing dashboard into one open-source hackathon project.

## One-line pitch

EcoSentinel helps residents, planners, and NGOs understand what the air is like now, what it may look like next, and what practical action to take when pollution risk rises.

## Why this matters

Air quality data is often available but fragmented, delayed, or difficult for non-specialists to use. EcoSentinel turns that raw data into:

- a live Amsterdam AQI dashboard
- a forecast view with confidence bands
- a drift alert when reality diverges from the model
- a citizen advisor chat experience backed by Gemini with graceful fallback
- a downloadable PDF policy report
- a gamified impact tracker for car-free trips

## What’s in the repo today

### Frontend experience

- Interactive AQI dashboard with Leaflet-based location cards and hotspot view
- Forecast chart UI with confidence band rendering and preview fallback
- Citizen advisor chat page and widget
- Drift detection banner when live AQI outpaces forecast by 20+ AQI points
- Impact score widget for logging car-free trips and avoided CO2

### Backend capabilities

- `DataCollectorAgent` for multi-source AQI ingestion
- `AQINormaliser` for EPA breakpoint conversion
- `PredictionAgent` for forecast generation with deterministic fallback if a TFJS model is absent
- `CitizenAdvisorAgent` for AQI-aware Gemini responses with deterministic fallback
- `AuditLogger` hooks for signed forecast payloads
- `/api/report` PDF generation for policy stakeholders
- requested-location live AQI fallback when stored data is stale or missing
- explicit `resolution`, `freshness`, and forecast-history labels so the UI shows when data is local versus nearest-available

### Routes exposed today

- `GET /api/aqi`
- `GET /api/predict`
- `POST /api/chat`
- `GET /api/history`
- `GET /api/health`
- `GET /api/report`

### Important implementation note

The app is intentionally honest about data provenance. AQI cards, map popups, and the forecast panel show whether each response came from:

- the requested location via a live provider call
- stored local AQI history
- the nearest available AQI history window
- a frontend preview fallback when the backend is unavailable

## Demo flow

The strongest judge demo sequence is:

1. Open the dashboard and show live Amsterdam AQI hotspots.
2. Point out the requested-location / nearest-available label on the primary AQI card.
3. Highlight the forecast curve, confidence band, and history-resolution label.
4. Show the drift alert banner as the model-monitoring story.
5. Open the citizen advisor chat page and ask a resident-style question.
6. Generate the PDF policy report from `/api/report`.
7. Log a car-free trip and show the impact score update.

## Architecture

```text
Open-Meteo / OpenAQ
      |
      v
DataCollectorAgent ---> AQINormaliser ---> PostgreSQL / Timescale-style schema
      |                                         |
      |                                         +--> /api/aqi
      |                                         +--> /api/history
      |
      +--> requested-location live AQI fallback (Open-Meteo / OpenAQ)
      |
      +--> PredictionAgent ---> signed forecast payloads / deterministic fallback
      |
      +--> CitizenAdvisorAgent ---> Gemini chat UX / fallback
      |
      +--> Policy report service ---> /api/report PDF

Next.js frontend
  - AQI dashboard
  - Forecast chart
  - Drift alert
  - Chat widget
  - Impact score
```

## Stack

- Frontend: Next.js 14, React 18, Tailwind CSS, Leaflet, Recharts
- Backend: Express 4, Node.js 20, PostgreSQL, PDFKit
- Data and intelligence: Open-Meteo, OpenAQ, EPA AQI normalisation, TFJS-compatible forecast agent, Gemini citizen advisor agent
- Deployment target: Vercel for `apps/web`, Railway for `apps/api`

## Quick start

### Prerequisites

- Node.js 20+
- npm
- Docker Desktop or compatible Docker runtime

### 1. Clone and install

```bash
git clone https://github.com/manojmallick/ecosentinel.git
cd ecosentinel
npm install --prefix apps/api
npm install --prefix apps/web
```

### 2. Start PostgreSQL locally

```bash
docker-compose up -d
```

### 3. Configure environment variables

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

At minimum for local development:

- `DATABASE_URL`
- `NEXT_PUBLIC_API_URL`

Optional but recommended:

- `LLM_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `SIGNING_PRIVATE_KEY`
- `SIGNING_PUBLIC_KEY`

### 4. Run the apps

API:

```bash
cd apps/api
npm run dev
```

Web:

```bash
cd apps/web
npm run dev
```

Then open:

- web: `http://localhost:3000`
- api: `http://localhost:3001/api/health`

## Validation commands

API:

```bash
cd apps/api
npm test
npm run lint
```

Web:

```bash
cd apps/web
npm test
npm run lint
npm run build
```

## Deployment

Deployment is split by app:

- `apps/web` -> Vercel
- `apps/api` -> Railway

Full setup instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).

## API reference

### `GET /api/aqi`

Returns the current AQI reading for a location. The payload labels whether it used the requested location, stored local data, or nearest-available fallback.

Example:

```bash
curl "http://localhost:3001/api/aqi?lat=52.3676&lng=4.9041&radius_km=5"
```

### `GET /api/history`

Returns recent AQI history for a location.

Example:

```bash
curl "http://localhost:3001/api/history?lat=52.3676&lng=4.9041&hours=24"
```

### `GET /api/report`

Returns a PDF policy report.

Example:

```bash
curl "http://localhost:3001/api/report?lat=52.3676&lng=4.9041&hours=24" --output ecosentinel-report.pdf
```

### `GET /api/health`

Returns service health status.

### `GET /api/predict`

Returns a 24-hour forecast with confidence bands, forecast strategy, signature metadata, and a `historyResolution` label so the UI can show whether the history window was local or nearest-available.

### `POST /api/chat`

Returns a Gemini-backed AQI advisor answer with live fallback. The response includes `provider`, `strategy`, and AQI context metadata used to answer the question.

## Project structure

```text
ecosentinel/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── db/
│   │   └── tests/
│   └── web/
│       ├── src/app/
│       ├── src/components/
│       └── src/lib/
├── .github/workflows/ci.yml
├── DEPLOYMENT.md
└── docker-compose.yml
```

## Judging fit

- Environmental impact: turns air-quality data into actions for residents and policy stakeholders
- Innovation: combines ingestion, normalisation, prediction, reporting, drift monitoring, and citizen UX
- Feasibility: deploys as a simple two-service monorepo on Vercel + Railway
- Presentation: demo-friendly UI with map, chart, chat, report, and gamification moments

## Roadmap after submission

- add persistent user accounts and cloud-synced impact scores
- ship a stronger trained TFJS model artifact for richer location-specific forecasting
- add scheduled policy report delivery and stakeholder alerts
- expand collection coverage beyond the initial Amsterdam-focused deployment

## Sponsor note

Built for an EcoHack-style submission and prepared to acknowledge MeDo as a sponsor/platform dependency where required in the final submission materials.
