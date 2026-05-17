# DocFlow — AI-Powered Manufacturing Document Digitization

A full-stack web app that digitizes handwritten operational manufacturing documents using Claude Vision AI.

## Features
- Upload images/PDFs of handwritten manufacturing records
- AI extraction of structured fields (date, shift, machine, quantity, etc.)
- Confidence scoring per field with color-coded indicators
- Business rule validation with error/warning severity
- Review and edit extracted data side-by-side with the document
- Dashboard with shift, machine, and status analytics

## Tech Stack
- **Frontend**: React 18 + Vite + TailwindCSS v4 + Recharts
- **Backend**: FastAPI + SQLAlchemy (async) + SQLite
- **AI**: Anthropic Claude (claude-sonnet-4-20250514) Vision API
- **Deployment**: Railway (backend) + Vercel (frontend)

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Anthropic API key (get one at https://console.anthropic.com)

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
# Edit .env and add your ANTHROPIC_API_KEY
python run.py
# → API running at http://localhost:8000
# → Swagger UI at http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env  # or just edit .env directly
# Set VITE_API_URL=http://localhost:8000/api for local dev
npm run dev
# → App running at http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload a document |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/:id` | Get document + extracted record |
| PATCH | `/api/records/:id` | Update a record field |
| GET | `/api/dashboard` | Aggregated analytics |
| GET | `/api/documents/:id/preview` | Serve the original file |
| GET | `/health` | Health check |

## Deployment

### Backend on Railway
```bash
# In backend/, the Procfile and railway.toml are already configured
# Push to GitHub → connect Railway → set root directory to backend
# Add env vars: ANTHROPIC_API_KEY, ALLOWED_ORIGINS
```

### Frontend on Vercel
```bash
# Push to GitHub → connect Vercel → set root directory to frontend
# Add env var: VITE_API_URL = https://your-railway-url.railway.app/api
```

## Known Limitations (Prototype)
- **File storage**: Railway has an ephemeral filesystem. Uploaded files reset on redeploy. Use S3 or a volume for production.
- **No authentication**: This is a prototype — add JWT/OAuth before production use.
- **SQLite**: Fine for prototyping. For production, switch `DATABASE_URL` to PostgreSQL.

## Architecture
See [AGENTS.md](./AGENTS.md) for AI workflow documentation.
