import anthropic
import base64
import json
import os
from pathlib import Path

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

EXTRACTION_SYSTEM_PROMPT = """
You are an expert OCR and data extraction AI for manufacturing operational documents.
Your job is to extract structured data from handwritten or semi-structured manufacturing documents.

Always respond with a single valid JSON object. No markdown, no explanation, just the JSON.

The JSON must have this exact structure:
{
  "date": "YYYY-MM-DD or null",
  "shift": "Morning | Afternoon | Night | null",
  "employee_number": "string or null",
  "operation_code": "string or null",
  "machine_number": "string or null",
  "work_order_number": "string or null",
  "quantity_produced": integer or null,
  "time_taken_hours": float or null,
  "supervisor_name": "string or null",
  "remarks": "string or null",
  "confidence_scores": {
    "date": 0.0-1.0,
    "shift": 0.0-1.0,
    "employee_number": 0.0-1.0,
    "operation_code": 0.0-1.0,
    "machine_number": 0.0-1.0,
    "work_order_number": 0.0-1.0,
    "quantity_produced": 0.0-1.0,
    "time_taken_hours": 0.0-1.0,
    "supervisor_name": 0.0-1.0,
    "remarks": 0.0-1.0
  },
  "extraction_notes": "any observations about document quality, ambiguous fields, etc."
}

Rules:
- If a field is not visible or illegible, return null for the value and 0.0 for its confidence.
- confidence_scores must reflect how certain you are (0.0 = cannot read, 1.0 = very clear).
- For shift, normalize to exactly "Morning", "Afternoon", or "Night". If it says "1st shift" interpret as "Morning", "2nd" as "Afternoon", "3rd" as "Night".
- For dates, convert any format (DD/MM/YY, MM-DD-YYYY, etc.) to YYYY-MM-DD.
- For numeric fields (quantity, time), extract only the number.
- Do not invent or guess field values — use null if unsure.
"""


def encode_image(file_path: str) -> tuple[str, str]:
    """Encode image to base64 and detect media type."""
    ext = Path(file_path).suffix.lower()
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }
    media_type = media_type_map.get(ext, "image/jpeg")

    with open(file_path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")

    return data, media_type


async def extract_from_document(file_path: str) -> dict:
    """
    Send document to Claude Vision and extract structured operational data.
    Returns the parsed JSON dict with extracted fields + confidence scores.
    """
    image_data, media_type = encode_image(file_path)

    if media_type == "application/pdf":
        # Claude supports PDF as document type
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": image_data,
                },
            },
            {
                "type": "text",
                "text": "Extract all operational data from this manufacturing document. Return only the JSON.",
            },
        ]
    else:
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_data,
                },
            },
            {
                "type": "text",
                "text": "Extract all operational data from this manufacturing document. Return only the JSON.",
            },
        ]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    raw_text = response.content[0].text.strip()

    # Strip markdown fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    extracted = json.loads(raw_text)
    return extracted
