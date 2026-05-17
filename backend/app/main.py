from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from app.models.database import init_db
from app.api.documents import router

app = FastAPI(title="DocFlow API", version="1.0.0")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

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


@app.get("/")
async def root():
    return {"status": "ok", "service": "DocFlow API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
