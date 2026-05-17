from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./docflow.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String)  # "image" or "pdf"
    file_size_kb = Column(Float)
    upload_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="uploaded")  # uploaded | processing | extracted | reviewed | failed
    error_message = Column(Text, nullable=True)


class ExtractedRecord(Base):
    __tablename__ = "extracted_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=False, index=True)

    # Core extracted fields
    date = Column(String, nullable=True)
    shift = Column(String, nullable=True)           # Morning / Afternoon / Night
    employee_number = Column(String, nullable=True)
    operation_code = Column(String, nullable=True)
    machine_number = Column(String, nullable=True)
    work_order_number = Column(String, nullable=True)
    quantity_produced = Column(Integer, nullable=True)
    time_taken_hours = Column(Float, nullable=True)
    supervisor_name = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)

    # Confidence scores per field (0.0 to 1.0)
    confidence_scores = Column(JSON, default={})

    # Validation results
    validation_errors = Column(JSON, default=[])  # list of {field, message, severity}
    has_validation_errors = Column(Boolean, default=False)
    overall_confidence = Column(Float, default=0.0)

    # State
    is_reviewed = Column(Boolean, default=False)
    reviewed_at = Column(DateTime, nullable=True)
    extraction_time = Column(DateTime, default=datetime.utcnow)
    raw_extraction = Column(JSON, default={})  # raw LLM output for debugging


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
