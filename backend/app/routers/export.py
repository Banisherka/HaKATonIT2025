from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
import io
import json

from ..database import SessionLocal
from ..models import LogEntry
from datetime import datetime
from typing import Optional, Dict, Tuple


router = APIRouter(prefix="/export", tags=["export"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/jsonl")
def export_jsonl(run_id: int, db: Session = Depends(get_db)):
    q = (
        db.query(LogEntry)
        .filter(LogEntry.run_id == run_id)
        .order_by(LogEntry.timestamp.asc(), LogEntry.id.asc())
    )

    def gen():
        for e in q:
            row = {
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "level": e.level,
                "phase": e.phase,
                "tf_req_id": e.tf_req_id,
                "tf_resource_type": e.tf_resource_type,
                "tf_resource_name": e.tf_resource_name,
                "message": e.message,
                "is_error": e.is_error,
                "is_malformed": e.is_malformed,
            }
            yield json.dumps(row, ensure_ascii=False) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


def _build_timeline_items(db: Session, run_id: int, by: str = "tf_req_id", ts_from: Optional[datetime] = None, ts_to: Optional[datetime] = None):
    q = db.query(LogEntry).filter(LogEntry.run_id == run_id)
    if ts_from:
        q = q.filter(LogEntry.timestamp >= ts_from)
    if ts_to:
        q = q.filter(LogEntry.timestamp <= ts_to)

    def key_of(e: LogEntry) -> str:
        if by == "tf_req_id":
            if e.tf_req_id:
                return e.tf_req_id
            # If no tf_req_id, try to use resource type or phase as fallback
            if e.tf_resource_type:
                return f"resource:{e.tf_resource_type}"
            if e.phase:
                return f"phase:{e.phase}"
            if e.level:
                return f"level:{e.level}"
            return "general"
        if by == "resource":
            return f"{e.tf_resource_type or 'unknown_type'}:{e.tf_resource_name or 'unknown_name'}"
        return e.phase or "unknown_phase"

    buckets: Dict[str, Tuple[Optional[datetime], Optional[datetime], int, int, int]] = {}
    for e in q:
        key = key_of(e)
        start, end, count, errors, malformed = buckets.get(key, (None, None, 0, 0, 0))
        ts = e.timestamp
        if ts is not None:
            start = ts if start is None else min(start, ts)
            end = ts if end is None else max(end, ts)
        count += 1
        if e.is_error:
            errors += 1
        if e.is_malformed:
            malformed += 1
        buckets[key] = (start, end, count, errors, malformed)

    items = []
    for key, (start, end, count, errors, malformed) in buckets.items():
        if start is None:
            continue
        if end is None:
            end = start
        items.append({
            "key": key,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "count": count,
            "errors": errors,
            "malformed": malformed,
        })
    items.sort(key=lambda i: (i["start"], i["key"]))
    return items


@router.get("/timeline.json")
def export_timeline_json(run_id: int, by: str = "tf_req_id", ts_from: Optional[datetime] = None, ts_to: Optional[datetime] = None, db: Session = Depends(get_db)):
    items = _build_timeline_items(db, run_id, by, ts_from, ts_to)
    json_content = json.dumps({"items": items}, indent=2, ensure_ascii=False)
    headers = {"Content-Disposition": f"attachment; filename=timeline_{run_id}_{by}.json"}
    return StreamingResponse(iter([json_content]), media_type="application/json", headers=headers)


@router.get("/timeline.csv")
def export_timeline_csv(run_id: int, by: str = "tf_req_id", ts_from: Optional[datetime] = None, ts_to: Optional[datetime] = None, db: Session = Depends(get_db)):
    import csv
    buf = io.StringIO()
    # Use semicolon delimiter for better Excel compatibility
    writer = csv.writer(buf, delimiter=';')
    writer.writerow(["Key", "Start Time", "End Time", "Count", "Errors", "Malformed"])
    for row in _build_timeline_items(db, run_id, by, ts_from, ts_to):
        writer.writerow([row["key"], row["start"], row["end"], row["count"], row["errors"], row["malformed"]])
    buf.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=timeline_{run_id}_{by}.csv"}
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/jsonl_by_keys")
def export_jsonl_by_keys(
    run_id: int,
    pair_by: str = "tf_req_id",  # tf_req_id|resource|phase
    keys: str = "",
    db: Session = Depends(get_db),
):
    key_list = [k.strip() for k in keys.split(",") if k.strip()]
    if not key_list:
        return StreamingResponse(iter([""]), media_type="application/x-ndjson")

    q = db.query(LogEntry).filter(LogEntry.run_id == run_id)
    if pair_by == "tf_req_id":
        q = q.filter(LogEntry.tf_req_id.in_(key_list))
    elif pair_by == "phase":
        q = q.filter(LogEntry.phase.in_(key_list))
    else:  # resource
        # keys formatted as "type:name"
        types = set()
        names = set()
        pairs = set()
        for k in key_list:
            if ":" in k:
                t, n = k.split(":", 1)
            else:
                t, n = k, ""
            types.add(t or None)
            names.add(n or None)
            pairs.add((t or None, n or None))
        # prefilter on type/name then precise in generator
        q = q.filter(
            (LogEntry.tf_resource_type.in_([t for t in types if t is not None]))
            | (LogEntry.tf_resource_name.in_([n for n in names if n is not None]))
        )

    q = q.order_by(LogEntry.timestamp.asc(), LogEntry.id.asc())

    def gen():
        for e in q:
            if pair_by == "resource":
                k = f"{e.tf_resource_type or ''}:{e.tf_resource_name or ''}"
                if k not in key_list:
                    continue
            row = {
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "level": e.level,
                "phase": e.phase,
                "tf_req_id": e.tf_req_id,
                "tf_resource_type": e.tf_resource_type,
                "tf_resource_name": e.tf_resource_name,
                "message": e.message,
                "is_error": e.is_error,
                "is_malformed": e.is_malformed,
            }
            yield json.dumps(row, ensure_ascii=False) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


