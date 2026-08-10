# Simulator ESP32 (data realistis + event kondisi) sebagai service Railway.
# Hanya butuh Python stdlib (tanpa pip install), build cepat.
#
# Setup service di Railway:
#   - Root directory        = "/" (repo root)
#   - Variable build        = RAILWAY_DOCKERFILE_PATH=/simulator/Dockerfile
#   - Variables service     = URL, API_TOKEN, INTERVAL, EVENT_MIN, EVENT_MAX (SELF_URL setelah generate domain)
FROM python:3.12-slim

WORKDIR /app

COPY scripts/simulate_live.py ./simulate_live.py

ENV PORT=8080

CMD ["python", "-u", "simulate_live.py"]
