from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..database import SessionLocal
from ..models import Run
from ..schemas import RunOut, RunsPage

router = APIRouter(prefix="/runs", tags=["runs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=RunsPage)
def list_runs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (1-100)"),
    db: Session = Depends(get_db)
):
    q = db.query(Run).order_by(Run.created_at.desc())
    total = q.count()
    
    items = (
        q.offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    return RunsPage(
        total=total,
        page=page,
        page_size=page_size,
        items=items
    )

@router.post("/clear")
def clear_runs(db: Session = Depends(get_db)):
    db.query(Run).delete()
    db.commit()
    return {"message": "All runs cleared"}
