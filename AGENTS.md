# AGENTS.md — AI Workflow Documentation

## AI Tools Used
- **Claude Sonnet** (claude.ai): Architecture planning, code generation, debugging assistance
- **Claude Vision API** (`claude-sonnet-4-20250514`): OCR and structured data extraction from manufacturing documents

---

## How AI Was Used

### Architecture Design
Claude was used to design the FastAPI + SQLite + Claude Vision pipeline. Prompted with the full assignment spec and asked to propose a lightweight, zero-setup-database architecture suitable for a 48-hour prototype.

Key architectural decisions made with AI assistance:
- **Background tasks** for non-blocking upload responses
- **SQLite + aiosqlite** for zero-config async persistence
- **Weighted confidence scoring** for multi-field extraction quality assessment
- **Separation of extraction vs. validation** into distinct service modules

### Code Generation
- All FastAPI routes scaffolded via Claude Code prompts
- Validation rules (`validation.py`) defined iteratively with AI
- React components generated with detailed style specifications
- Zustand store pattern recommended by Claude for minimal re-renders

### Prompt Engineering for Extraction

The extraction system prompt in `backend/app/services/extraction.py` was iterated multiple times. Key improvements:

1. **v1**: Simple "extract these fields" → inconsistent formats
2. **v2**: Added JSON schema → consistent structure, but guessed missing values
3. **v3**: Added "use null if unsure" rule → better null handling, honest confidence
4. **v4**: Added shift normalization rules (1st/2nd/3rd → Morning/Afternoon/Night)
5. **v5**: Added extraction_notes field → model documents its own uncertainty

**Critical insight**: Explicitly showing the model the JSON schema it must produce reduced post-processing by ~80% compared to free-form extraction.

### Debugging
- Used Claude to debug SQLAlchemy async session scoping issues (background tasks need their own session)
- Claude identified that `expire_on_commit=False` is required for async sessions
- Confidence score weighting formula designed with Claude's help

---

## Extraction Pipeline

```
Upload → Save file → Create Document (status=uploaded)
  ↓
Background Task starts
  ↓
Claude Vision API (base64 image or PDF document)
  ↓
JSON parse extracted fields + confidence scores
  ↓
Business validation rules (validation.py)
  ↓
Weighted confidence aggregation
  ↓
Save ExtractedRecord → Update Document (status=extracted)
```

---

## Validation Rules

| Rule | Severity |
|------|----------|
| Missing mandatory fields (date, shift, employee_number, work_order_number, quantity_produced) | Error |
| Invalid shift value | Error |
| Invalid date format | Error |
| Date out of expected range (< 2000 or future) | Warning |
| Machine number format mismatch | Warning |
| Quantity = 0 | Warning |
| Quantity > 100,000 | Warning |
| Time taken ≤ 0 | Error |
| Time taken > 24 hours | Warning |
| Employee number < 2 chars | Warning |

---

## Confidence Scoring

Weighted average across all fields:

| Field | Weight |
|-------|--------|
| date | 1.5 |
| shift | 1.5 |
| work_order_number | 1.5 |
| quantity_produced | 1.5 |
| employee_number | 1.2 |
| operation_code | 1.0 |
| machine_number | 1.0 |
| time_taken_hours | 1.0 |
| supervisor_name | 0.8 |
| remarks | 0.5 |

**UI color coding:**
- 🟢 Green: ≥ 80% confidence
- 🟡 Yellow: 50–79% confidence
- 🔴 Red: < 50% confidence

---

## Areas Requiring Manual Work
- CSS/layout fine-tuning for responsive breakpoints
- Railway deployment environment variable configuration
- Testing with real-world handwritten document images
- Confidence threshold calibration based on actual document quality

## Key Decisions
- **SQLite chosen** for zero-config local storage (can migrate to Postgres by changing DATABASE_URL)
- **Background tasks** used to avoid blocking upload responses (user gets doc_id immediately)
- **Polling-based updates** in frontend (every 3–5s) rather than WebSockets for simplicity
- **No auth** — prototype scope; add OAuth2 before any production use
- **Ephemeral file storage** acceptable for prototype; S3 recommended for production
