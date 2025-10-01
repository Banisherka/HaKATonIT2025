from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from .database import Base

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512), nullable=False)
    stored_path = Column(String(1024), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    status = Column(String(64), default="uploaded", index=True)
    summary = Column(Text, default="")

    logs = relationship("LogEntry", back_populates="run", cascade="all, delete-orphan")

class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id", ondelete="CASCADE"), index=True, nullable=False)

    raw = Column(Text, nullable=False)
    json_str = Column(Text, default="")

    # parsed fields
    timestamp = Column(DateTime, index=True, nullable=True)
    level = Column(String(32), index=True, nullable=True)
    phase = Column(String(32), index=True, nullable=True)  # plan/apply/other
    tf_req_id = Column(String(128), index=True, nullable=True)
    tf_resource_type = Column(String(128), index=True, nullable=True)
    tf_resource_name = Column(String(256), index=True, nullable=True)
    message = Column(Text, default="")
    is_error = Column(Boolean, default=False, index=True)
    is_malformed = Column(Boolean, default=False, index=True)

    run = relationship("Run", back_populates="logs")
