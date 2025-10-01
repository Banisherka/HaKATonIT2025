from pathlib import Path
from typing import Optional, Dict, Any, Iterable
from sqlalchemy.orm import Session

from .models import Run, LogEntry
from .parser import iter_parse_jsonl, normalize_entry
from ..plugins.registry import get_registered_plugins


def process_uploaded_file(db: Session, run: Run) -> None:
    path = Path(run.stored_path)
    if not path.exists():
        run.status = "error"
        run.summary = "stored file missing"
        db.add(run)
        db.commit()
        return

    total = 0
    errors = 0
    phases = set()

    plugins = get_registered_plugins()
    batch = []
    BATCH_SIZE = 500

    def flush_batch():
        nonlocal batch, errors, phases
        if not batch:
            return
        # прогон через плагины (последовательно)
        for p in plugins:
            try:
                batch = p.process_batch(batch)
            except Exception:
                # плагины не должны ломать парсинг
                pass
        # запись в БД
        for data in batch:
            if data.get("phase"):
                phases.add(data["phase"])
            if data.get("is_malformed"):
                errors += 1
            entry = LogEntry(run_id=run.id, **data)
            db.add(entry)
        db.flush()
        batch = []

    with path.open("r", encoding="utf-8", errors="replace") as fh:
        print(f"Opening file for reading: {path}")
        for obj, raw, malformed in iter_parse_jsonl(fh):
            print(f"Processing line: {raw}")
            total += 1
            data = normalize_entry(obj, raw, malformed)
            batch.append(data)
            if len(batch) >= BATCH_SIZE:
                flush_batch()
        flush_batch()

    run.status = "parsed"
    print(f"Parsing completed for run_id: {run.id}, total: {total}, errors: {errors}, phases: {','.join(sorted(phases)) or 'n/a'}")
    run.summary = f"lines={total}; malformed={errors}; phases={','.join(sorted(phases)) or 'n/a'}"
    db.add(run)
    db.commit()
