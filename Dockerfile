FROM python:3.12-slim

ARG PORT=5001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=${PORT} \
    EXAM_HOST=0.0.0.0 \
    EXAM_PORT=${PORT} \
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

EXPOSE ${PORT}

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
