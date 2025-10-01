FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY plugins/proto /app/plugins/proto
RUN mkdir -p /app/plugins/gen_py \
    && python -m grpc_tools.protoc -I /app/plugins/proto \
       --python_out=/app/plugins/gen_py \
       --grpc_python_out=/app/plugins/gen_py \
       /app/plugins/proto/logviewer.proto

EXPOSE 8000
ENV PYTHONPATH="/app/backend:/app/plugins/gen_py"
ENV GEN_PY_PATH="/app/plugins/gen_py"
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]


