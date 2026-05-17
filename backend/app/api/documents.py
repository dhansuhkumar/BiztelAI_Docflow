from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime
import shutil, os, uuid
from pathlib import Path

from app.models.database import get_db, Document, ExtractedRecord
from app.services.extraction import extract_from_document
from app.services.validation import validate_record, compute_overall_confidence

router = APIRouter(prefix="/api", tags=["documents"])
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".webp", ".gif"}
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", 20)) * 1024 * 1024


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not supported.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large.")

    unique_name = f"{uuid.uuid4()}{ext}"
    save_path = UPLOAD_DIR / unique_name
    with open(save_path, "wb") as f:
        f.write(contents)

    doc = Document(
        filename=unique_name,
        original_filename=file.filename,
        file_path=str(save_path),
        file_type="pdf" if ext == ".pdf" else "image",
        file_size_kb=round(len(contents) / 1024, 2),
        status="uploaded",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(process_document, doc.id, str(save_path))

    return {"document_id": doc.id, "status": "uploaded", "message": "Processing started."}


async def process_document(doc_id: int, file_path: str):
    """Background task: extract + validate, then save to DB."""
    from app.models.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        doc.status = "processing"
        await db.commit()

        try:
            extracted = await extract_from_document(file_path)
            confidence_scores = extracted.get("confidence_scores", {})
            validation_errors = validate_record(extracted)
            overall_conf = compute_overall_confidence(confidence_scores)

            record = ExtractedRecord(
                document_id=doc_id,
                date=extracted.get("date"),
                shift=extracted.get("shift"),
                employee_number=extracted.get("employee_number"),
                operation_code=extracted.get("operation_code"),
                machine_number=extracted.get("machine_number"),
                work_order_number=extracted.get("work_order_number"),
                quantity_produced=extracted.get("quantity_produced"),
                time_taken_hours=extracted.get("time_taken_hours"),
                supervisor_name=extracted.get("supervisor_name"),
                remarks=extracted.get("remarks"),
                confidence_scores=confidence_scores,
                validation_errors=validation_errors,
                has_validation_errors=len([e for e in validation_errors if e["severity"] == "error"]) > 0,
                overall_confidence=overall_conf,
                raw_extraction=extracted,
            )
            db.add(record)
            doc.status = "extracted"
            await db.commit()

        except Exception as e:
            doc.status = "failed"
            doc.error_message = str(e)
            await db.commit()


@router.get("/documents")
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    status: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Document).order_by(desc(Document.upload_time))
    if status:
        query = query.where(Document.status == status)
    if search:
        query = query.where(Document.original_filename.ilike(f"%{search}%"))

    result = await db.execute(query.offset(skip).limit(limit))
    docs = result.scalars().all()

    total_result = await db.execute(select(func.count(Document.id)))
    total = total_result.scalar()

    return {"documents": [doc_to_dict(d) for d in docs], "total": total}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    doc_result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found.")

    rec_result = await db.execute(select(ExtractedRecord).where(ExtractedRecord.document_id == doc_id))
    record = rec_result.scalar_one_or_none()

    return {
        "document": doc_to_dict(doc),
        "record": record_to_dict(record) if record else None,
    }


@router.patch("/records/{record_id}")
async def update_record(record_id: int, updates: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExtractedRecord).where(ExtractedRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(404, "Record not found.")

    editable_fields = [
        "date", "shift", "employee_number", "operation_code",
        "machine_number", "work_order_number", "quantity_produced",
        "time_taken_hours", "supervisor_name", "remarks"
    ]
    for field in editable_fields:
        if field in updates:
            setattr(record, field, updates[field])

    # Re-validate after edit
    current_data = {f: getattr(record, f) for f in editable_fields}
    record.validation_errors = validate_record(current_data)
    record.has_validation_errors = len([e for e in record.validation_errors if e["severity"] == "error"]) > 0

    if updates.get("mark_reviewed"):
        record.is_reviewed = True
        record.reviewed_at = datetime.utcnow()

        # Also update document status
        doc_result = await db.execute(select(Document).where(Document.id == record.document_id))
        doc = doc_result.scalar_one_or_none()
        if doc:
            doc.status = "reviewed"

    await db.commit()
    await db.refresh(record)
    return record_to_dict(record)


@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    # Total uploads
    total_docs = (await db.execute(select(func.count(Document.id)))).scalar()
    total_extracted = (await db.execute(
        select(func.count(Document.id)).where(Document.status == "extracted")
    )).scalar()
    total_failed = (await db.execute(
        select(func.count(Document.id)).where(Document.status == "failed")
    )).scalar()

    # Records
    records_result = await db.execute(select(ExtractedRecord))
    records = records_result.scalars().all()

    total_records = len(records)
    validation_failures = sum(1 for r in records if r.has_validation_errors)
    reviewed = sum(1 for r in records if r.is_reviewed)

    # Shift breakdown
    shift_counts = {}
    shift_quantity = {}
    for r in records:
        s = r.shift or "Unknown"
        shift_counts[s] = shift_counts.get(s, 0) + 1
        shift_quantity[s] = shift_quantity.get(s, 0) + (r.quantity_produced or 0)

    # Machine breakdown
    machine_counts = {}
    machine_quantity = {}
    for r in records:
        m = r.machine_number or "Unknown"
        machine_counts[m] = machine_counts.get(m, 0) + 1
        machine_quantity[m] = machine_quantity.get(m, 0) + (r.quantity_produced or 0)

    # Top 10 machines by quantity
    top_machines = sorted(machine_quantity.items(), key=lambda x: x[1], reverse=True)[:10]

    # Status breakdown for pie chart
    status_counts = {}
    docs_result = await db.execute(select(Document))
    all_docs = docs_result.scalars().all()
    for d in all_docs:
        status_counts[d.status] = status_counts.get(d.status, 0) + 1

    total_qty = sum(r.quantity_produced or 0 for r in records)
    avg_confidence = round(
        sum(r.overall_confidence for r in records) / total_records, 3
    ) if total_records > 0 else 0

    # Recent 5 uploads
    recent_result = await db.execute(
        select(Document).order_by(desc(Document.upload_time)).limit(5)
    )
    recent_docs = recent_result.scalars().all()

    return {
        "summary": {
            "total_uploads": total_docs,
            "total_extracted": total_extracted,
            "total_failed": total_failed,
            "total_records": total_records,
            "validation_failures": validation_failures,
            "reviewed_records": reviewed,
            "total_quantity_produced": total_qty,
            "average_confidence": avg_confidence,
        },
        "shift_breakdown": [
            {"shift": k, "count": v, "total_quantity": shift_quantity.get(k, 0)}
            for k, v in shift_counts.items()
        ],
        "top_machines": [
            {"machine": m, "total_quantity": q} for m, q in top_machines
        ],
        "status_breakdown": [
            {"status": k, "count": v} for k, v in status_counts.items()
        ],
        "recent_uploads": [doc_to_dict(d) for d in recent_docs],
    }


@router.get("/documents/{doc_id}/preview")
async def preview_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found.")
    return FileResponse(doc.file_path)


def doc_to_dict(d: Document) -> dict:
    return {
        "id": d.id,
        "filename": d.filename,
        "original_filename": d.original_filename,
        "file_type": d.file_type,
        "file_size_kb": d.file_size_kb,
        "upload_time": d.upload_time.isoformat() if d.upload_time else None,
        "status": d.status,
        "error_message": d.error_message,
    }


def record_to_dict(r: ExtractedRecord) -> dict:
    return {
        "id": r.id,
        "document_id": r.document_id,
        "date": r.date,
        "shift": r.shift,
        "employee_number": r.employee_number,
        "operation_code": r.operation_code,
        "machine_number": r.machine_number,
        "work_order_number": r.work_order_number,
        "quantity_produced": r.quantity_produced,
        "time_taken_hours": r.time_taken_hours,
        "supervisor_name": r.supervisor_name,
        "remarks": r.remarks,
        "confidence_scores": r.confidence_scores,
        "validation_errors": r.validation_errors,
        "has_validation_errors": r.has_validation_errors,
        "overall_confidence": r.overall_confidence,
        "is_reviewed": r.is_reviewed,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "extraction_time": r.extraction_time.isoformat() if r.extraction_time else None,
    }
