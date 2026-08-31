"""
PrivAgent Backend - Safe Logger
Never logs raw PII.
"""

import logging
import sys

from backend.privacy.validator import PII_PATTERNS


class PIISafeFilter(logging.Filter):
    """Logging filter that redacts PII from log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            msg = record.msg
            for pii_type, pattern in PII_PATTERNS.items():
                msg = pattern.sub(f"[REDACTED_{pii_type.upper()}]", msg)
            record.msg = msg
        return True


def setup_logging(level: str = "INFO") -> None:
    """Configure application logging with PII-safe filter."""
    root = logging.getLogger("privagent")
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        "%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    handler.addFilter(PIISafeFilter())

    root.addHandler(handler)
