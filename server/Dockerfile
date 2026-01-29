FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client and curl for healthcheck
RUN apt-get update && apt-get install -y postgresql-client curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py db_config.py schema.sql ./
COPY templates templates/
COPY static static/

# Environment variables (can be overridden)
ENV DB_HOST=postgres \
    DB_PORT=5432 \
    DB_NAME=edgedevices \
    DB_USER=iot_user \
    DB_PASSWORD=iot_pass_2026 \
    MQTT_BROKER=mosquitto \
    MQTT_PORT=1883 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Startup script
CMD ["sh", "-c", "sleep 10 && python app.py"]
