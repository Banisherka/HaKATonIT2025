from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..database import SessionLocal
from ..models import LogEntry
from ..schemas import LogsPage, LogEntryOut


router = APIRouter(prefix="/logs", tags=["logs"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=LogsPage)
def list_logs(
    run_id: int,
    page: int = 1,
    page_size: int = 100,
    include_pairs: bool = False,
    pair_by: str = "tf_req_id",  # tf_req_id|resource|phase
    tf_req_id: Optional[str] = None,
    tf_resource_type: Optional[str] = None,
    tf_resource_name: Optional[str] = None,
    phase: Optional[str] = None,
    level: Optional[str] = None,
    status: Optional[str] = Query(None, description="error|ok|malformed"),
    search: Optional[str] = None,
    ts_from: Optional[datetime] = None,
    ts_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(LogEntry).filter(LogEntry.run_id == run_id)

    if tf_req_id:
        # Support partial matching for tf_req_id (e.g., '77' matches '778', '779', '776')
        q = q.filter(LogEntry.tf_req_id.like(f"%{tf_req_id}%"))
    if tf_resource_type:
        # Support partial matching for tf_resource_type
        q = q.filter(LogEntry.tf_resource_type.like(f"%{tf_resource_type}%"))
    if tf_resource_name:
        q = q.filter(LogEntry.tf_resource_name == tf_resource_name)
    if phase:
        q = q.filter(LogEntry.phase == phase)
    if level:
        q = q.filter(LogEntry.level == level)
    if status == "error":
        q = q.filter(LogEntry.is_error.is_(True))
    elif status == "malformed":
        q = q.filter(LogEntry.is_malformed.is_(True))
    elif status == "ok":
        q = q.filter(LogEntry.is_error.is_(False), LogEntry.is_malformed.is_(False))
    if ts_from:
        q = q.filter(LogEntry.timestamp >= ts_from)
    if ts_to:
        q = q.filter(LogEntry.timestamp <= ts_to)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(LogEntry.message.like(like), LogEntry.json_str.like(like)))

    total = q.count()
    base_items = (
        q.order_by(LogEntry.timestamp.asc(), LogEntry.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    extras_count = 0
    items: list[LogEntryOut] = []

    def to_out(e: LogEntry, is_extra: bool = False) -> LogEntryOut:
        return LogEntryOut(
            id=e.id,
            run_id=e.run_id,
            timestamp=e.timestamp,
            level=e.level,
            phase=e.phase,
            tf_req_id=e.tf_req_id,
            tf_resource_type=e.tf_resource_type,
            tf_resource_name=e.tf_resource_name,
            message=e.message,
            is_error=e.is_error,
            is_malformed=e.is_malformed,
            data_json=e.json_str,
            is_extra=is_extra,
        )

    if not include_pairs:
        return LogsPage(total=total, items=[to_out(i) for i in base_items], extras=0)

    # Включаем пары по ключу (tf_req_id|resource|phase), чтобы показать запрос/ответ вместе
    items.extend(to_out(i) for i in base_items)
    base_ids = {e.id for e in base_items}

    if pair_by == "tf_req_id":
        keys = {e.tf_req_id for e in base_items if e.tf_req_id}
        if keys:
            extra_q = (
                db.query(LogEntry)
                .filter(LogEntry.run_id == run_id)
                .filter(LogEntry.tf_req_id.in_(keys))
            )
            extra_rows = extra_q.order_by(LogEntry.timestamp.asc(), LogEntry.id.asc()).limit(3000).all()
    elif pair_by == "phase":
        keys = {e.phase for e in base_items if e.phase}
        if keys:
            extra_q = (
                db.query(LogEntry)
                .filter(LogEntry.run_id == run_id)
                .filter(LogEntry.phase.in_(keys))
            )
            extra_rows = extra_q.order_by(LogEntry.timestamp.asc(), LogEntry.id.asc()).limit(3000).all()
    else:  # resource
        res_keys = {(e.tf_resource_type or None, e.tf_resource_name or None) for e in base_items if (e.tf_resource_type or e.tf_resource_name)}
        extra_rows = []
        if res_keys:
            # Грубая предфильтрация по типу/имени, затем точная в памяти
            types = {t for t, _ in res_keys if t}
            names = {n for _, n in res_keys if n}
            extra_q = db.query(LogEntry).filter(LogEntry.run_id == run_id)
            if types:
                extra_q = extra_q.filter(LogEntry.tf_resource_type.in_(list(types)))
            if names:
                extra_q = extra_q.filter(LogEntry.tf_resource_name.in_(list(names)))
            maybe_rows = extra_q.order_by(LogEntry.timestamp.asc(), LogEntry.id.asc()).limit(5000).all()
            for e in maybe_rows:
                key = (e.tf_resource_type or None, e.tf_resource_name or None)
                if key in res_keys:
                    extra_rows.append(e)

    if 'extra_rows' in locals():
        for e in extra_rows:
            if e.id in base_ids:
                continue
            items.append(to_out(e, is_extra=True))
            extras_count += 1
        items.sort(key=lambda x: (x.timestamp or datetime.min, x.id))

    return LogsPage(total=total, items=items, extras=extras_count)


@router.get("/groups")
def get_groups(
    run_id: int,
    pair_by: str = "tf_req_id",  # tf_req_id|resource|phase
    db: Session = Depends(get_db),
):
    """
    Получить все уникальные группы для файла запуска
    """
    q = db.query(LogEntry).filter(LogEntry.run_id == run_id)
    
    if pair_by == "tf_req_id":
        # Получаем все уникальные tf_req_id
        results = q.filter(LogEntry.tf_req_id.isnot(None)).with_entities(LogEntry.tf_req_id).distinct().all()
        groups = [{
            "key": r.tf_req_id,
            "display_name": r.tf_req_id,
            "type": "tf_req_id"
        } for r in results if r.tf_req_id]
        
        # Проверяем, есть ли записи с null tf_req_id
        null_count = q.filter(LogEntry.tf_req_id.is_(None)).count()
        if null_count > 0:
            groups.append({
                "key": "(без tf_req_id)",
                "display_name": "(без tf_req_id)",
                "type": "tf_req_id",
                "count": null_count
            })
        
    elif pair_by == "phase":
        # Получаем все уникальные фазы
        results = q.filter(LogEntry.phase.isnot(None)).with_entities(LogEntry.phase).distinct().all()
        groups = [{
            "key": r.phase,
            "display_name": r.phase,
            "type": "phase"
        } for r in results if r.phase]
        
        # Проверяем, есть ли записи с null phase
        null_count = q.filter(LogEntry.phase.is_(None)).count()
        if null_count > 0:
            groups.append({
                "key": "(без phase)",
                "display_name": "(без phase)",
                "type": "phase",
                "count": null_count
            })
        
    else:  # resource
        # Получаем все уникальные комбинации ресурсов
        results = q.filter(
            or_(LogEntry.tf_resource_type.isnot(None), LogEntry.tf_resource_name.isnot(None))
        ).with_entities(LogEntry.tf_resource_type, LogEntry.tf_resource_name).distinct().all()
        
        groups = []
        for r in results:
            key = f"{r.tf_resource_type or ''}:{r.tf_resource_name or ''}"
            display_name = f"{r.tf_resource_type or '(нет типа)'} : {r.tf_resource_name or '(нет имени)'}"
            groups.append({
                "key": key,
                "display_name": display_name,
                "type": "resource"
            })
            
        # Проверяем, есть ли записи без resource информации
        null_count = q.filter(
            and_(LogEntry.tf_resource_type.is_(None), LogEntry.tf_resource_name.is_(None))
        ).count()
        if null_count > 0:
            groups.append({
                "key": "(без resource)",
                "display_name": "(без resource)",
                "type": "resource",
                "count": null_count
            })
    
    # Подсчитываем количество записей для каждой группы
    for group in groups:
        # Пропускаем, если count уже установлен (для специальных групп)
        if "count" in group:
            continue
            
        if pair_by == "tf_req_id":
            count = q.filter(LogEntry.tf_req_id == group["key"]).count()
        elif pair_by == "phase":
            count = q.filter(LogEntry.phase == group["key"]).count()
        else:  # resource
            parts = group["key"].split(":", 1)
            res_type = parts[0] if parts[0] else None
            res_name = parts[1] if len(parts) > 1 and parts[1] else None
            count = q.filter(
                LogEntry.tf_resource_type == res_type,
                LogEntry.tf_resource_name == res_name
            ).count()
        group["count"] = count
    
    # Сортируем по количеству записей (убывание)
    groups.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "run_id": run_id,
        "pair_by": pair_by,
        "total_groups": len(groups),
        "groups": groups
    }


