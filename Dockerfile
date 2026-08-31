FROM python:3.11-slim

WORKDIR /app

# Install system requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency list
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy application files
COPY backend/ ./backend/
COPY demo/ ./demo/
COPY .env.example ./.env

EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000
ENV LLM_PROVIDER=mock

CMD ["python", "-m", "backend.main"]
