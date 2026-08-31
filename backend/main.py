"""
PrivAgent Backend - FastAPI Application Entry Point
"""

from __future__ import annotations

import os
import logging

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles
# pyrefly: ignore [missing-import]
from backend.api.routes import router       
from backend.utils.logger import setup_logging

# Load .env file
load_dotenv()

# Setup PII-safe logging
setup_logging(os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("privagent.main")

# Create FastAPI app
app = FastAPI(
    title="PrivAgent API",
    description="Privacy-first AI browser agent backend. Raw PII is never processed.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)

# Serve demo pages if the demo directory exists
demo_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "demo")
if os.path.isdir(demo_dir):
    app.mount("/demo", StaticFiles(directory=demo_dir, html=True), name="demo")

logger.info("PrivAgent API started (LLM_PROVIDER=%s)", os.getenv("LLM_PROVIDER", "mock"))


def main():
    """Run with: python -m backend.main"""
    # pyrefly: ignore [missing-import]
    import uvicorn 
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        reload=debug,
    )


if __name__ == "__main__":
    main()
