import re
from datetime import datetime
from typing import Any

MANDATORY_FIELDS = ["date", "shift", "employee_number", "work_order_number", "quantity_produced"]
VALID_SHIFTS = {"Morning", "Afternoon", "Night"}
MACHINE_NUMBER_PATTERN = re.compile(r"^[A-Z]{1,4}-?\d{1,6}$", re.IGNORECASE)
WORK_ORDER_PATTERN = re.compile(r"^WO-?\d{4,10}$", re.IGNORECASE)


def validate_record(data: dict) -> list[dict]:
    """
    Run all business validation rules on extracted data.
    Returns list of validation error objects: {field, message, severity}
    severity: "error" (must fix) | "warning" (should review)
    """
    errors = []

    # 1. Mandatory field check
    for field in MANDATORY_FIELDS:
        if not data.get(field):
            errors.append({
                "field": field,
                "message": f"'{field}' is a mandatory field and is missing.",
                "severity": "error"
            })

    # 2. Valid shift values
    shift = data.get("shift")
    if shift and shift not in VALID_SHIFTS:
        errors.append({
            "field": "shift",
            "message": f"Invalid shift '{shift}'. Expected: Morning, Afternoon, or Night.",
            "severity": "error"
        })

    # 3. Date format and range check
    date_str = data.get("date")
    if date_str:
        try:
            doc_date = datetime.strptime(date_str, "%Y-%m-%d")
            if doc_date.year < 2000 or doc_date > datetime.utcnow():
                errors.append({
                    "field": "date",
                    "message": f"Date '{date_str}' seems suspicious (out of expected range).",
                    "severity": "warning"
                })
        except ValueError:
            errors.append({
                "field": "date",
                "message": f"Date '{date_str}' is not in a valid format.",
                "severity": "error"
            })

    # 4. Machine number format
    machine = data.get("machine_number")
    if machine and not MACHINE_NUMBER_PATTERN.match(machine):
        errors.append({
            "field": "machine_number",
            "message": f"Machine number '{machine}' doesn't match expected format (e.g. MC-001, LATHE-12).",
            "severity": "warning"
        })

    # 5. Quantity check
    qty = data.get("quantity_produced")
    if qty is not None:
        if qty < 0:
            errors.append({
                "field": "quantity_produced",
                "message": "Quantity produced cannot be negative.",
                "severity": "error"
            })
        elif qty == 0:
            errors.append({
                "field": "quantity_produced",
                "message": "Quantity produced is zero — please verify.",
                "severity": "warning"
            })
        elif qty > 100000:
            errors.append({
                "field": "quantity_produced",
                "message": f"Quantity '{qty}' seems unusually high. Please verify.",
                "severity": "warning"
            })

    # 6. Time taken check
    time_h = data.get("time_taken_hours")
    if time_h is not None:
        if time_h <= 0:
            errors.append({
                "field": "time_taken_hours",
                "message": "Time taken must be greater than 0.",
                "severity": "error"
            })
        elif time_h > 24:
            errors.append({
                "field": "time_taken_hours",
                "message": f"Time taken '{time_h}h' exceeds 24 hours — suspicious.",
                "severity": "warning"
            })

    # 7. Employee number basic check
    emp = data.get("employee_number")
    if emp and len(emp) < 2:
        errors.append({
            "field": "employee_number",
            "message": "Employee number seems too short.",
            "severity": "warning"
        })

    return errors


def compute_overall_confidence(confidence_scores: dict) -> float:
    """Compute weighted average confidence across all fields."""
    weights = {
        "date": 1.5,
        "shift": 1.5,
        "employee_number": 1.2,
        "operation_code": 1.0,
        "machine_number": 1.0,
        "work_order_number": 1.5,
        "quantity_produced": 1.5,
        "time_taken_hours": 1.0,
        "supervisor_name": 0.8,
        "remarks": 0.5,
    }
    total_weight = 0
    weighted_sum = 0
    for field, weight in weights.items():
        score = confidence_scores.get(field)
        if score is not None:
            weighted_sum += score * weight
            total_weight += weight

    return round(weighted_sum / total_weight, 3) if total_weight > 0 else 0.0
