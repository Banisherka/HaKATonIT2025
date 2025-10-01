import grpc
from typing import List, Dict
import sys
import os
import importlib.util

# Добавляем каталог со сгенерированными gRPC-стабами в PYTHONPATH внутри контейнера
GEN_PATH = os.getenv("GEN_PY_PATH", os.path.join(os.path.dirname(__file__), "gen_py"))

def _load_module(module_name: str, file_path: str):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = mod
        spec.loader.exec_module(mod)  # type: ignore
        return mod
    raise ImportError(f"Cannot load module {module_name} from {file_path}")

LOGVIEWER_PB2 = _load_module("logviewer_pb2", os.path.join(GEN_PATH, "logviewer_pb2.py"))
LOGVIEWER_PB2_GRPC = _load_module("logviewer_pb2_grpc", os.path.join(GEN_PATH, "logviewer_pb2_grpc.py"))

LogItem = getattr(LOGVIEWER_PB2, "LogItem")
FilterRequest = getattr(LOGVIEWER_PB2, "FilterRequest")
LogFilterStub = getattr(LOGVIEWER_PB2_GRPC, "LogFilterStub")


class GrpcLogFilterClient:
    def __init__(self, address: str) -> None:
        self.address = address

    def process_batch(self, items: List[Dict]) -> List[Dict]:
        if not items:
            return items
        with grpc.insecure_channel(self.address) as channel:
            stub = LogFilterStub(channel)
            req = FilterRequest(
                items=[
                    LogItem(
                        id=i.get("id", 0),
                        run_id=i.get("run_id", 0),
                        timestamp=(i.get("timestamp") or ""),
                        level=i.get("level") or "",
                        phase=i.get("phase") or "",
                        tf_req_id=i.get("tf_req_id") or "",
                        tf_resource_type=i.get("tf_resource_type") or "",
                        tf_resource_name=i.get("tf_resource_name") or "",
                        message=i.get("message") or "",
                        is_error=bool(i.get("is_error")),
                        is_malformed=bool(i.get("is_malformed")),
                        raw_json=i.get("json_str") or "",
                    )
                    for i in items
                ]
            )
            resp = stub.Process(req, timeout=20)
            out: List[Dict] = []
            for it in resp.items:
                out.append(
                    {
                        "id": it.id,
                        "run_id": it.run_id,
                        "timestamp": it.timestamp,
                        "level": it.level or None,
                        "phase": it.phase or None,
                        "tf_req_id": it.tf_req_id or None,
                        "tf_resource_type": it.tf_resource_type or None,
                        "tf_resource_name": it.tf_resource_name or None,
                        "message": it.message,
                        "is_error": it.is_error,
                        "is_malformed": it.is_malformed,
                        "json_str": it.raw_json,
                    }
                )
            return out


