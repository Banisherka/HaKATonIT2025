from datetime import datetime
from typing import Optional, Any, List
from pydantic import BaseModel, Field


class RunOut(BaseModel):
    id: int
    filename: str
    created_at: datetime
    status: str
    summary: str

    class Config:
        orm_mode = True


class LogEntryOut(BaseModel):
    id: int
    run_id: int
    timestamp: Optional[datetime]
    level: Optional[str]
    phase: Optional[str]
    tf_req_id: Optional[str]
    tf_resource_type: Optional[str]
    tf_resource_name: Optional[str]
    message: str
    is_error: bool
    is_malformed: bool
    data_json: Optional[Any] = Field(None, alias="json")
    is_extra: Optional[bool] = False

    class Config:
        orm_mode = True


class LogsPage(BaseModel):
    total: int
    items: List[LogEntryOut]
    extras: int = 0


class TimelineItem(BaseModel):
    key: str  # tf_req_id или resource_name/type
    start: datetime
    end: datetime
    count: int
    errors: int
    malformed: int

class TimelineOut(BaseModel):
    items: List[TimelineItem]


class RunsPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[RunOut]


