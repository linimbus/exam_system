FROM python:3.12-slim

ARG FRONTEND_PORT=8000
ARG BACKEND_PORT=5001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_PORT=${FRONTEND_PORT} \
    BACKEND_PORT=${BACKEND_PORT} \
    EXAM_HOST=0.0.0.0 \
    EXAM_PORT=${BACKEND_PORT} \
    EXAM_DATABASE=/app/data/exam.db \
    FLASK_DEBUG=0

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend
COPY run.py ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE ${FRONTEND_PORT} ${BACKEND_PORT}

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
