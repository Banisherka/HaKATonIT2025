from typing import List
import os

from .client import GrpcLogFilterClient


def get_registered_plugins() -> List[GrpcLogFilterClient]:
    # Читаем список адресов плагинов из переменной окружения, через запятую
    # Например: PLUGINS=plugin1:50051,plugin2:50052
    env = os.getenv("PLUGINS", "").strip()
    if not env:
        return []
    return [GrpcLogFilterClient(addr.strip()) for addr in env.split(",") if addr.strip()]


