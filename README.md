# DocFlow — AI-Powered Manufacturing Document Digitization

A full-stack web app that digitizes handwritten operational manufacturing documents using a vision AI model via OpenRouter.

**Live Demo:** [Frontend URL] ← Replace after Vercel deploy
**API:** [Backend URL] ← Replace after Railway deploy

## Features

- Upload images/PDFs of handwritten manufacturing records
- AI extraction of structured fields (date, shift, machine, quantity, etc.)
- Supports **multi-row table extraction** — all rows from a tabular document
- Confidence scoring per field with color-coded indicators
- Business rule validation with error/warning severity
- Review and edit extracted data side-by-side with the document
- Dashboard with shift, machine, and status analytics
- Row selector for navigating between extracted rows

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS v4 + Recharts
- **Backend**: FastAPI + SQLAlchemy (async) + SQLite
- **AI**: OpenRouter API (`nvidia/nemotron-nano-12b-v2-vl:free` — free open-source vision model)
- **Deployment**: Railway (backend) + Vercel (frontend)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser   │────▶│  Vercel      │────▶│  Railway     │
│  React App  │     │  (Frontend)  │     │  (Backend)   │
│ :5173/:443  │◀────│  SPA + Vite  │◀────│  FastAPI     │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                     ┌──────────────────────────┼──────────┐
                     │                          │          │
                     ▼                          ▼          ▼
              ┌──────────────┐          ┌──────────────┐
              │  OpenRouter  │          │   SQLite     │
              │ Vision Model │          │   (aiosqlite)│
              │ (Cloud API)  │          │   (ephemeral)│
              └──────────────┘          └──────────────┘
```

### Data Flow

```
User Upload ──▶ FastAPI saves file + creates Document ──▶ Background Task starts
                                                              │
                                                              ▼
                                                    Send image to OpenRouter
                                                    (vision LLM via API)
                                                              │
                                                              ▼
                                                    Parse JSON array of rows
                                                              │
                                                              ▼
                                                    Validate each row
                                                              │
                                                              ▼
                                                    Save all ExtractedRecords
                                                              │
                                                              ▼
                                                    Frontend polls → Review page
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenRouter API key (free at https://openrouter.ai/keys)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
python run.py
# → API running at http://localhost:8000
# → Swagger UI at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env .env.local  # or edit .env directly
# VITE_API_URL is already set for local dev
npm run dev
# → App running at http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload a document |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/:id` | Get document + all extracted records |
| PATCH | `/api/records/:id` | Update a record field |
| GET | `/api/dashboard` | Aggregated analytics |
| GET | `/api/documents/:id/preview` | Serve the original file |
| GET | `/health` | Health check |

## Deployment

### Backend on Railway

1. Push repo to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub repo
3. Set **Root Directory** to `backend`
4. Add environment variables:

| Variable | Value |
|----------|-------|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` (your key) |
| `OPENROUTER_MODEL` | `nvidia/nemotron-nano-12b-v2-vl:free` |
| `ALLOWED_ORIGINS` | `http://localhost:5173,https://your-frontend.vercel.app` |
| `DATABASE_URL` | `sqlite+aiosqlite:///./docflow.db` |
| `UPLOAD_DIR` | `./uploads` |
| `MAX_FILE_SIZE_MB` | `20` |

5. Deploy — Railway auto-detects `railway.toml` and `Procfile`
6. Verify: hit `https://your-app.railway.app/health` → `{"status":"ok"}`

### Frontend on Vercel

1. Go to https://vercel.com → Add New Project → Import GitHub repo
2. Set **Root Directory** to `frontend`
3. Add environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-app.railway.app/api` |

4. Deploy — `vercel.json` handles SPA routing (`/*` → `/index.html`)
5. Update Railway `ALLOWED_ORIGINS` to include your Vercel domain

## Assumptions

- This is a **prototype** — not production-ready
- **SQLite** is used for zero-config local dev; switch to PostgreSQL for production
- **Uploaded files are ephemeral** on Railway — files disappear on redeploy; use S3/Cloudinary for persistence
- **No authentication** — add JWT/OAuth before any public deployment
- The free OpenRouter model (`nemotron-nano-12b-v2-vl`) works well for OCR but has **rate limits** (~20 req/min, ~200 req/day)
- For higher accuracy, switch `OPENROUTER_MODEL` to a paid model like `google/gemini-2.5-flash` or `anthropic/claude-sonnet-4`
- Dates in documents are assumed to be in **DD/MM/YY** format (day first)

## Known Limitations (Prototype)

- File storage resets on Railway redeploy
- No authentication
- SQLite is not suitable for concurrent production workloads
- Free-tier OpenRouter has rate limits
- Large PDFs may exceed free-tier context limits

## License

MIT

## AI Workflow

See [AGENTS.md](./AGENTS.md) for detailed AI workflow documentation and prompt engineering history.
