from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from app.models.database import init_db
from app.api.documents import router

app = FastAPI(title="DocFlow API", version="1.0.0")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
print(f"[DOCFLOW] CORS origins: {origins}", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup():
    await init_db()
    print("[DOCFLOW] Database initialized", flush=True)

    # Recover documents stuck in 'processing' (killed by server restart)
    try:
        from sqlalchemy import select, update
        from app.models.database import AsyncSessionLocal, Document
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Document).where(Document.status.in_(["processing", "uploaded"]))
            )
            stuck_docs = result.scalars().all()
            if stuck_docs:
                print(f"[DOCFLOW] Found {len(stuck_docs)} stuck document(s), resetting to 'failed'...", flush=True)
                for doc in stuck_docs:
                    doc.status = "failed"
                    doc.error_message = "Server restarted during processing. Please re-upload or retry."
                    print(f"[DOCFLOW]   - Doc {doc.id}: '{doc.original_filename}' -> failed", flush=True)
                await db.commit()
            else:
                print("[DOCFLOW] No stuck documents found", flush=True)
    except Exception as e:
        print(f"[DOCFLOW] Error recovering stuck docs: {e}", flush=True)

    # Log env var status
    print(f"[DOCFLOW] OPENROUTER_API_KEY set: {bool(os.getenv('OPENROUTER_API_KEY'))}", flush=True)
    print(f"[DOCFLOW] OPENROUTER_MODEL: {os.getenv('OPENROUTER_MODEL', 'nvidia/nemotron-nano-12b-v2-vl:free')}", flush=True)


@app.get("/", include_in_schema=False)
@app.head("/", include_in_schema=False)
async def root():
    return {"status": "ok", "service": "DocFlow API"}


@app.get("/health")
async def health():
    return {"status": "ok"}

