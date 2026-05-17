import os
import json
import httpx
import base64
from pathlib import Path

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

EXTRACTION_PROMPT = """
You are an expert OCR and data extraction AI for manufacturing operational documents.
Extract ALL rows of data from this handwritten or semi-structured manufacturing document.

The document may contain a table with multiple rows. Extract EVERY data row — do not skip any.

Respond with ONLY a single valid JSON array. No markdown, no explanation, no backticks — just raw JSON.

Each element in the array represents one row and must follow this exact structure:
{
  "row_number": integer (1-based),
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
  "extraction_notes": "any notes about this specific row"
}

Rules:
- Return an array even if there is only one data row: [{ ... }]
- Skip completely empty rows (all cells blank).
- If a field is illegible or missing, set value to null and confidence to 0.0.
- Normalize shift: I or 1st -> "Morning", II or 2nd -> "Afternoon", III or 3rd -> "Night".
- Dates in the document are in DD/MM/YY or DD/MM/YYYY format (day first, then month, then year). Parse accordingly.
- Normalize all dates to YYYY-MM-DD. If only one date is written for the whole table, use it for all rows.
- For numeric fields extract only the number, no units.
- Never invent or guess values — use null if unsure.
- If a column value repeats across rows (e.g. same date, same shift), copy it to each row.
"""


def encode_image_base64(file_path: str) -> tuple[str, str]:
    ext = Path(file_path).suffix.lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }
    mime = mime_map.get(ext, "image/jpeg")
    with open(file_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return data, mime


async def extract_from_document(file_path: str) -> list[dict]:
    """
    Send document to OpenRouter vision model and extract ALL rows as a list of dicts.
    Returns a list — even single-row documents return a list of one.
    """
    # Read env vars at runtime (not import time) so deployment env vars are available
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-nano-12b-v2-vl:free")

    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable is not set")

    print(f"[DOCFLOW] extract_from_document called: file={file_path}, model={model}", flush=True)
    print(f"[DOCFLOW] API key present: {bool(api_key)} (length={len(api_key)})", flush=True)

    b64_data, mime_type = encode_image_base64(file_path)
    print(f"[DOCFLOW] Image encoded: mime={mime_type}, base64_len={len(b64_data)}", flush=True)
    data_uri = f"data:{mime_type};base64,{b64_data}"

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_uri}},
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
        "temperature": 0.1,
        "max_tokens": 3000,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    print(f"[DOCFLOW] Sending request to OpenRouter ({OPENROUTER_BASE}/chat/completions)...", flush=True)

    async with httpx.AsyncClient(base_url=OPENROUTER_BASE) as client:
        response = await client.post(
            "/chat/completions",
            json=payload,
            headers=headers,
            timeout=180.0,
        )
        print(f"[DOCFLOW] OpenRouter response status: {response.status_code}", flush=True)
        if response.status_code != 200:
            print(f"[DOCFLOW] OpenRouter error body: {response.text[:500]}", flush=True)
        response.raise_for_status()
        data = response.json()

    # Safely extract the response content
    choices = data.get("choices", [])
    if not choices:
        raise ValueError(f"OpenRouter returned no choices. Response: {json.dumps(data)[:500]}")

    raw_text = choices[0].get("message", {}).get("content", "").strip()

    if not raw_text:
        raise ValueError("OpenRouter returned empty content")

    print(f"[DOCFLOW] Raw AI response (first 300 chars): {raw_text[:300]}", flush=True)

    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw_text = "\n".join(lines).strip()

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse AI response as JSON: {e}\nRaw text: {raw_text[:500]}")

    if isinstance(parsed, dict):
        parsed = [parsed]

    if not isinstance(parsed, list):
        raise ValueError(f"Expected list from AI, got {type(parsed).__name__}")

    print(f"[DOCFLOW] Successfully extracted {len(parsed)} row(s)", flush=True)
    return parsed
