import sys
import structlog
from structlog.types import EventDict
import logging


def add_service_context(logger: structlog.BoundLogger, method_name: str, event_dict: EventDict) -> EventDict:
    event_dict["service"] = "ai-service"
    return event_dict


def setup_logging(log_level: str = "INFO") -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        add_service_context,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    logging.getLogger("uvicorn").setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(level)
    logging.getLogger("inngest").setLevel(level)
    logging.getLogger("qdrant_client").setLevel(level)
    logging.getLogger("httpx").setLevel(level)
    logging.getLogger("openai").setLevel(level)
    logging.getLogger("llama_index").setLevel(level)


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)