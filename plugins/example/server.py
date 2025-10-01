import grpc
from concurrent import futures
import time

import logviewer_pb2
import logviewer_pb2_grpc


class LogFilterServicer(logviewer_pb2_grpc.LogFilterServicer):
    # Пример: понижает уровень 'warn' до 'info', добавляет префикс в message
    def Process(self, request, context):
        items = []
        for it in request.items:
            level = it.level
            if level == 'warn':
                level = 'info'
            message = f"[plugin] {it.message}" if it.message else it.message
            items.append(
                logviewer_pb2.LogItem(
                    id=it.id,
                    run_id=it.run_id,
                    timestamp=it.timestamp,
                    level=level,
                    phase=it.phase,
                    tf_req_id=it.tf_req_id,
                    tf_resource_type=it.tf_resource_type,
                    tf_resource_name=it.tf_resource_name,
                    message=message,
                    is_error=it.is_error,
                    is_malformed=it.is_malformed,
                    raw_json=it.raw_json,
                )
            )
        return logviewer_pb2.FilterResponse(items=items)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    logviewer_pb2_grpc.add_LogFilterServicer_to_server(LogFilterServicer(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    try:
        while True:
            time.sleep(86400)
    except KeyboardInterrupt:
        server.stop(0)


if __name__ == '__main__':
    serve()


