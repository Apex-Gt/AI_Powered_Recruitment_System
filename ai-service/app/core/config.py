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
    location: str | None = None  # e.g. ":memory:" for tests; overrides host/port
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


class OpenAIConfig(_EnvSettings):
    """Only used when EMBEDDING_PROVIDER / RERANKER_PROVIDER is `openai`."""

    model_config = SettingsConfigDict(env_prefix="OPENAI_")

    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    organization: str | None = None


class LLMConfig(_EnvSettings):
    """Chat model for resume profile extraction and RAG summaries.

    Any OpenAI-compatible endpoint works. Defaults to Groq's free tier; see README for
    Gemini / OpenRouter / local Ollama presets.
    """

    model_config = SettingsConfigDict(env_prefix="LLM_")

    api_key: str = ""
    base_url: str = "https://api.groq.com/openai/v1"
    model: str = "llama-3.3-70b-versatile"
    temperature: float = 0.1
    max_tokens: int = 4096
    timeout: float = 90.0
    max_retries: int = 4  # SDK-level retries with backoff; covers free-tier 429s
    json_mode: bool = True  # send response_format=json_object (auto-disabled if the model rejects it)

    @property
    def is_configured(self) -> bool:
        """A key is required for hosted providers; local servers (Ollama, LM Studio) need none."""
        if self.api_key:
            return True
        return any(h in self.base_url for h in ("localhost", "127.0.0.1", "host.docker.internal"))


class EmbeddingConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="EMBEDDING_")

    provider: Literal["openai", "local", "huggingface"] = "local"
    model_name: str = "BAAI/bge-m3"
    dimensions: int = 1024
    batch_size: int = 32
    max_retries: int = 3
    timeout: float = 60.0


class RerankerConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="RERANKER_")

    provider: Literal["openai", "local", "huggingface", "cohere"] = "local"
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
    prompt_version: str = "1.0"
    scoring_version: str = "1.0"


class ChunkingConfig(_EnvSettings):
    model_config = SettingsConfigDict(env_prefix="CHUNKING_")

    chunk_size: int = 1000
    chunk_overlap: int = 200
    min_chunk_size: int = 100


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


settings = AppConfig()