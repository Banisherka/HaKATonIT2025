from pathlib import Path
import os
import fnmatch
from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from sqlalchemy.orm import Session
from fastapi import Depends
import shutil

from ..database import SessionLocal
from ..models import Run
from ..services import process_uploaded_file

router = APIRouter(prefix="/uploads", tags=["uploads"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/file")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    print("upload_file function called")
    storage_dir = Path(__file__).resolve().parent.parent.parent / "storage" / "uploads"
    storage_dir.mkdir(parents=True, exist_ok=True)
    dest = storage_dir / file.filename

    # Save the file to the destination path
    with dest.open("wb") as buffer:
        buffer.write(await file.read())

    # Debug: Log the file path
    print(f"File saved to: {dest}")

    run = Run(filename=file.filename, stored_path=str(dest))
    db.add(run)
    db.commit()
    db.refresh(run)

    # parse immediately (synchronous to meet 2-3 min constraint and simplicity)
    process_uploaded_file(db, run)

    return {"run_id": run.id, "filename": run.filename, "status": run.status, "summary": run.summary}

@router.post("/import")
async def import_directory(
    files: list[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    storage_dir = Path(__file__).resolve().parent.parent.parent / "storage" / "imports"
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    exts = {".log", ".txt", ".jsonl", ".json"}
    results = []
    ok_count = 0
    err_count = 0
    
    for uploaded_file in files:
        try:
            # Проверяем расширение файла
            file_ext = Path(uploaded_file.filename).suffix.lower()
            if file_ext not in exts:
                results.append({
                    "filename": uploaded_file.filename,
                    "run_id": None,
                    "status": "error",
                    "summary": "",
                    "error": f"Неподдерживаемое расширение файла: {file_ext}",
                })
                err_count += 1
                continue
            
            # Сохраняем файл
            dest = storage_dir / uploaded_file.filename
            with dest.open("wb") as buffer:
                content = await uploaded_file.read()
                buffer.write(content)
            
            # Создаем запись в базе данных
            run = Run(filename=uploaded_file.filename, stored_path=str(dest))
            db.add(run)
            db.commit()
            db.refresh(run)
            
            # Обрабатываем файл
            process_uploaded_file(db, run)
            
            results.append({
                "filename": run.filename,
                "run_id": run.id,
                "status": run.status,
                "summary": run.summary,
                "error": None,
            })
            ok_count += 1
            
        except Exception as exc:
            db.rollback()
            results.append({
                "filename": uploaded_file.filename,
                "run_id": None,
                "status": "error",
                "summary": "",
                "error": str(exc),
            })
            err_count += 1

    return {
        "import_dir": str(storage_dir),
        "count": len(results),
        "ok": ok_count,
        "errors": err_count,
        "runs": results,
    }