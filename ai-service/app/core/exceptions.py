class AIServiceError(Exception):
    def __init__(self, message: str, code: str = "AI_SERVICE_ERROR", details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class ConfigurationError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "CONFIGURATION_ERROR", details)


class ModelUnavailableError(AIServiceError):
    def __init__(self, message: str, model_name: str, details: dict | None = None):
        super().__init__(message, "MODEL_UNAVAILABLE", {"model": model_name, **(details or {})})


class EmbeddingError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "EMBEDDING_ERROR", details)


class QdrantError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "QDRANT_ERROR", details)


class InngestError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "INNGEST_ERROR", details)


class ValidationError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "VALIDATION_ERROR", details)


class PDFProcessingError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "PDF_PROCESSING_ERROR", details)


class CandidateExtractionError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "CANDIDATE_EXTRACTION_ERROR", details)


class ScoringError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "SCORING_ERROR", details)


class RAGError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "RAG_ERROR", details)


class RankingError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "RANKING_ERROR", details)

class LLMError(AIServiceError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message, "LLM_ERROR", details)
