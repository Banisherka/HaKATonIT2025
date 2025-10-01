import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional, Tuple


TIMESTAMP_REGEXES = [
    # 2025-09-30T12:34:56Z or with offset
    re.compile(r"(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))"),
    # 2025-09-30 12:34:56,123
    re.compile(r"(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[\.,]\d{1,6})?)"),
]

LEVEL_HINTS = {
    "error": ["error", "err", "failed", "failure", "fatal"],
    "warn": ["warn", "warning"],
    "info": ["info", "notice"],
    "debug": ["debug", "trace"],
}


def parse_datetime(ts: str) -> Optional[datetime]:
    # First try modern Python ISO 8601 parsing (supports +03:00 format)
    try:
        # Handle Z suffix (UTC)
        if ts.endswith('Z'):
            dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(ts)
        # unify to naive UTC if timezone aware
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        pass
    
    # Fallback to original strptime formats for compatibility
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S,%f",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(ts, fmt)
            # unify to naive UTC if timezone aware
            if dt.tzinfo:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            continue
    return None


def guess_timestamp(text: str) -> Optional[datetime]:
    for rx in TIMESTAMP_REGEXES:
        m = rx.search(text)
        if m:
            return parse_datetime(m.group("ts"))
    return None


def guess_level(text: str) -> Optional[str]:
    lowered = text.lower()
    for level, hints in LEVEL_HINTS.items():
        for h in hints:
            if h in lowered:
                return level
    return None


def detect_phase(json_obj: Dict[str, Any], message: str) -> Optional[str]:
    hay = json.dumps(json_obj, ensure_ascii=False).lower() + "\n" + (message or "").lower()
    
    # Plan phase detection
    plan_patterns = [
        "terraform plan", "plan:", "planning", "starting plan operation", 
        "plan operation", "operation type: plan", "cli command args: plan",
        "\"plan\"", "'plan'"
    ]
    for pattern in plan_patterns:
        if pattern in hay:
            return "plan"
    
    # Apply phase detection
    apply_patterns = [
        "terraform apply", "apply:", "applying", "starting apply operation",
        "apply operation", "operation type: apply", "cli command args: apply",
        "\"apply\"", "'apply'", "backend/local: starting apply"
    ]
    for pattern in apply_patterns:
        if pattern in hay:
            return "apply"
    
    # Destroy phase detection
    destroy_patterns = [
        "terraform destroy", "destroy:", "destroying", "starting destroy operation",
        "destroy operation", "operation type: destroy", "cli command args: destroy",
        "\"destroy\"", "'destroy'"
    ]
    for pattern in destroy_patterns:
        if pattern in hay:
            return "destroy"
    
    # Validate phase detection
    validate_patterns = [
        "terraform validate", "validate:", "validating", "starting validate operation",
        "validate operation", "operation type: validate", "cli command args: validate",
        "\"validate\"", "'validate'"
    ]
    for pattern in validate_patterns:
        if pattern in hay:
            return "validate"
    
    return None


def iter_parse_jsonl(lines: Iterable[str]) -> Iterable[Tuple[Dict[str, Any], str, bool]]:
    for raw in lines:
        raw = raw.rstrip("\n")
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
            yield obj, raw, False
        except Exception:
            # try to salvage: sometimes JSON is inside brackets elsewhere
            try:
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1 and end > start:
                    obj = json.loads(raw[start : end + 1])
                    yield obj, raw, True
                    continue
            except Exception:
                pass
            yield {}, raw, True


def normalize_entry(obj: Dict[str, Any], raw: str, malformed: bool) -> Dict[str, Any]:
    message = str(obj.get("msg") or obj.get("message") or obj.get("@message") or obj.get("log") or "")
    ts_val = obj.get("timestamp") or obj.get("@timestamp") or obj.get("time")
    ts: Optional[datetime] = None
    if isinstance(ts_val, (int, float)):
        # epoch seconds or ms
        if ts_val > 10_000_000_000:
            ts = datetime.utcfromtimestamp(ts_val / 1000)
        else:
            ts = datetime.utcfromtimestamp(ts_val)
    elif isinstance(ts_val, str):
        ts = parse_datetime(ts_val)
    if ts is None:
        ts = guess_timestamp(raw) or guess_timestamp(message or raw)

    level = (obj.get("level") or obj.get("loglevel") or obj.get("severity") or obj.get("@level"))
    if isinstance(level, str):
        level = level.lower()
    if not level:
        level = guess_level(raw + "\n" + message)

    tf_req_id = obj.get("tf_req_id") or obj.get("request_id") or obj.get("@request_id")
    tf_resource_type = obj.get("tf_resource_type") or obj.get("resource_type")
    tf_resource_name = obj.get("tf_resource_name") or obj.get("resource_name")

    phase = detect_phase(obj, message)

    is_error = False
    if (isinstance(level, str) and level in ("error", "fatal")) or "error" in (message or "").lower():
        is_error = True

    return {
        "raw": raw,
        "json_str": json.dumps(obj, ensure_ascii=False),
        "timestamp": ts,
        "level": level,
        "phase": phase,
        "tf_req_id": tf_req_id,
        "tf_resource_type": tf_resource_type,
        "tf_resource_name": tf_resource_name,
        "message": message or raw,
        "is_error": is_error,
        "is_malformed": bool(malformed),
    }


