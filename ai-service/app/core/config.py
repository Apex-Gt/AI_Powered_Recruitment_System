from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class _EnvSettings(BaseSettings):
    """Base for every config section so each one reads `.env` (not just AppConfig)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


class ModelConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="MODEL_")

    foundation_model: str = "Qwen3-Embedding-8B"
    embedding_model: str = "BGE-M3"
    embedding_dimensions: int = 1024


class QdrantConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="QDRANT_")

    host: str = "localhost"
    port: int = 6333
    location: str | None = None  # e.g. ":memory:" for tests; overrides path and host/port
    # Embedded, on-disk Qdrant inside the AI service process: no server or Docker needed, data survives restarts.
    # Single process only (the folder is locked), so keep API_WORKERS=1. Overrides host/port.
    path: str | None = None
    collection_name: str = "resume_chunks"
    distance_metric: Literal["cosine", "euclidean", "dot"] = "cosine"
    batch_size: int = 100
    timeout: float = 30.0


class InngestConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="INNGEST_")

    signing_key: str = ""
    event_key: str = ""
    base_url: str = "http://localhost:8288"
    dev_mode: bool = True
    enabled: bool = True  # INNGEST_ENABLED=false when only the staged /api/v1/pipeline endpoints are used


class OpenAIConfig(_EnvSettings):
    """Only used when EMBEDDING_PROVIDER / RERANKER_PROVIDER is `openai`."""

    model_config = SettingsConfigDict(env_prefix="OPENAI_")

    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    organization: str | None = None


class LLMConfig(_EnvSettings):
    """Chat model for resume profile extraction and RAG summaries.

    Defaults to a locally hosted open-weight model served by Ollama's OpenAI-compatible endpoint, so
    no metered API is called. Any other OpenAI-compatible endpoint still works by overriding
    LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
    """

    model_config = SettingsConfigDict(env_prefix="LLM_")

    api_key: str = ""
    base_url: str = "http://localhost:11434/v1"
    model: str = "qwen3:4b"
    temperature: float = 0.1
    max_tokens: int = 4096
    timeout: float = 180.0  # local CPU/GPU inference is slower than a hosted API
    max_retries: int = 0  # SDK-level retries; the pipeline queue owns the real retry policy (a retried timeout doubles the wait)
    json_mode: bool = True  # send response_format=json_object (auto-disabled if the model rejects it)
    json_schema: bool = False  # response_format=json_schema when a schema is supplied. Off: small local models (qwen3:4b) stop after the first few fields under it; the prompt already spells the schema out and Pydantic validates the result
    concurrency: int = 1  # simultaneous in-flight LLM requests in this process (the model is shared)
    no_think: bool = True  # append /no_think for Qwen3-family models so they skip the reasoning preamble

    @property
    def is_configured(self) -> bool:
        """A key is required for hosted providers; local servers (Ollama, LM Studio) need none."""
        if self.api_key:
            return True
        return any(h in self.base_url for h in ("localhost", "127.0.0.1", "host.docker.internal"))


class EmbeddingConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="EMBEDDING_")

    provider: Literal["openai", "local", "huggingface", "ollama"] = "local"
    model_name: str = "BAAI/bge-m3"  # for provider=ollama use the Ollama tag, e.g. "bge-m3" (also 1024 dims)
    base_url: str = "http://localhost:11434"  # Ollama server, used when provider=ollama
    ollama_num_gpu: int | None = None  # 0 = run the embedding model on CPU so it never evicts the chat model from a small GPU
    dimensions: int = 1024
    batch_size: int = 32
    max_retries: int = 3
    timeout: float = 60.0


class RerankerConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="RERANKER_")

    provider: Literal["openai", "local", "huggingface", "cohere", "none"] = "local"  # "none" keeps vector order
    model_name: str = "BAAI/bge-reranker-v2-m3"
    top_k: int = 20
    max_retries: int = 3
    timeout: float = 60.0


class ScoringConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="SCORING_")

    skill_weight: float = 0.40
    experience_weight: float = 0.20
    education_weight: float = 0.10
    semantic_weight: float = 0.30
    min_skill_match_threshold: float = 0.3
    min_experience_years: float = 0.0
    prompt_version: str = "2.0"  # 2.0: evidence-grounded, verified explanations
    scoring_version: str = "2.0"


class ChunkingConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="CHUNKING_")

    chunk_size: int = 1000
    chunk_overlap: int = 200
    min_chunk_size: int = 100


class PipelineConfig(_EnvSettings):
    """Limits and switches for the staged resume pipeline (`/api/v1/pipeline/*`)."""

    model_config = SettingsConfigDict(env_prefix="PIPELINE_")

    api_key: str = ""  # shared secret the backend sends as X-API-Key; empty disables the check (local dev)
    max_file_mb: int = 10
    ocr_enabled: bool = True  # only used when a PDF has too little embedded text
    ocr_min_chars: int = 200  # fewer extracted characters than this on a page-bearing PDF triggers OCR
    ocr_language: str = "eng"
    ocr_max_pages: int = 6
    profile_text_chars: int = 9000  # resume text sent to the LLM (~2.3k tokens; more overflows a small local context window)
    profile_max_tokens: int = 2500  # cap on the profile JSON the model may write; generation time is linear in this
    embed_concurrency: int = 1  # simultaneous embedding batches in this process


class SpringBootConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="SPRING_BOOT_")

    base_url: str = "http://localhost:8080"
    api_key: str = ""
    timeout: float = 30.0


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 1
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"

    model: ModelConfig = Field(default_factory=ModelConfig)
    qdrant: QdrantConfig = Field(default_factory=QdrantConfig)
    inngest: InngestConfig = Field(default_factory=InngestConfig)
    openai: OpenAIConfig = Field(default_factory=OpenAIConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    embedding: EmbeddingConfig = Field(default_factory=EmbeddingConfig)
    reranker: RerankerConfig = Field(default_factory=RerankerConfig)
    scoring: ScoringConfig = Field(default_factory=ScoringConfig)
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig)
    spring_boot: SpringBootConfig = Field(default_factory=SpringBootConfig)
    pipeline: PipelineConfig = Field(default_factory=PipelineConfig)


settings = AppConfig()