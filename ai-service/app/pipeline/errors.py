"""Error taxonomy for the staged resume pipeline.

The backend queue decides what to do from two facts carried on every error: ``retryable`` (try again
later with backoff) and ``needs_review`` (park it for a recruiter instead of failing it).
"""


class PipelineError(Exception):
    code = "PIPELINE_ERROR"
    retryable = False
    needs_review = False

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
            "needsReview": self.needs_review,
            "details": self.details,
        }


class PermanentDocumentError(PipelineError):
    """The file itself is unusable (corrupt, encrypted, wrong type, too large). Retrying cannot help."""

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message, details)
        self.code = code


class NeedsReviewError(PipelineError):
    """The file is valid but yielded nothing reliable (for example a scan with no OCR available)."""

    needs_review = True

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message, details)
        self.code = code


class TransientDependencyError(PipelineError):
    """A dependency (Ollama, Qdrant, embedding server) is down or timed out. Safe to retry later."""

    retryable = True

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message, details)
        self.code = code
