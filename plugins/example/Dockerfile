FROM python:3.11-slim
WORKDIR /srv
RUN pip install --no-cache-dir grpcio==1.66.1 grpcio-tools==1.66.1
COPY plugins/proto /srv/proto
RUN python -m grpc_tools.protoc -I /srv/proto --python_out=/srv --grpc_python_out=/srv /srv/proto/logviewer.proto
COPY plugins/example/server.py /srv/server.py
EXPOSE 50051
CMD ["python", "/srv/server.py"]


