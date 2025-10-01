from datetime import datetime
from typing import Optional, Dict, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import SessionLocal
from ..models import LogEntry
from ..schemas import TimelineOut, TimelineItem


router = APIRouter(prefix="/timeline", tags=["timeline"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=TimelineOut)
def build_timeline(run_id: int, by: str = "tf_req_id", ts_from: Optional[datetime] = None, ts_to: Optional[datetime] = None, db: Session = Depends(get_db)):
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
        items.append(TimelineItem(key=key, start=start, end=end, count=count, errors=errors, malformed=malformed))

    # Timeline data ready for return
    items.sort(key=lambda i: (i.start, i.key))
    return TimelineOut(items=items)
