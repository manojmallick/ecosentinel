# EcoSentinel Deployment

This repo deploys as two services:

- `apps/web` on Vercel
- `apps/api` on Railway

## Vercel

1. Import the GitHub repository into Vercel.
2. Set the project Root Directory to `apps/web`.
3. Vercel will read [`apps/web/vercel.json`](apps/web/vercel.json) for the framework and build commands.
4. Configure these environment variables:
   - `NEXT_PUBLIC_API_URL=https://<your-railway-public-domain>`
   - `NEXT_PUBLIC_DRIFT_ALERT_THRESHOLD=20`
   - `NEXT_PUBLIC_MAP_LAT=52.3676`
   - `NEXT_PUBLIC_MAP_LNG=4.9041`

## Railway

1. Create a new Railway service from this repository.
2. Set the service Root Directory to `apps/api`.
3. Set the Railway config file path to `/apps/api/railway.json`.
4. Attach a PostgreSQL service and expose the API service publicly.
5. Railway will use [`apps/api/railway.json`](apps/api/railway.json) for the start command and health check.

Configure these environment variables on the Railway service:

- `PORT=3001`
- `DATABASE_URL=<railway-postgres-connection-string>`
- `ENABLE_COLLECTOR=true`
- `AQI_MAX_READING_AGE_MINUTES=90`
- `AQI_LIVE_CACHE_MINUTES=60`
- `AQI_PROVIDER_FAILURE_COOLDOWN_MINUTES=60`
- `OPENAQ_API_KEY=` (optional, used for secondary station validation)
- `LLM_PROVIDER=gemini`
- `GEMINI_API_KEY=<required for Gemini AI Studio chat>`
- `GEMINI_MODEL=gemini-2.5-flash`
- `SIGNING_PRIVATE_KEY=` (optional but recommended for signed forecasts)
- `SIGNING_PUBLIC_KEY=` (optional but recommended for verification output)
- `PREDICTION_INPUT_HOURS=48`
- `PREDICTION_OUTPUT_HOURS=24`
- `PREDICTION_MODEL_VERSION=lstm-v1.0.0`
- `TFJS_MODEL_PATH=../../../ml/model/tfjs/model.json`

## Deployment Notes

- The API health check path is `/api/health`.
- The health payload now reports whether the collector is enabled.
- The frontend should always point at the Railway public API URL through `NEXT_PUBLIC_API_URL`.
- `/api/aqi` first uses stored local data, then falls back to a live Open-Meteo read for the requested location when stored data is stale or missing.
- OpenAQ is used as a secondary station-validation source rather than the default live provider.
- `/api/predict` returns `historyResolution` so the frontend can show when the forecast used nearest-available history instead of a local history window.
- `/api/chat` uses the AQI route plus the forecast route, so setting the AQI and Gemini variables is enough to make the chatbot judge-ready.
- If the TFJS model artifact is not present in the deployment image, the prediction service will fall back to the deterministic forecast path instead of crashing.
- Vercel and Railway both build from subdirectories in this monorepo, so the configured root directories matter.
