from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ModelConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MODEL_", extra="ignore")

    foundation_model: str = "Qwen3-Embedding-8B"
    embedding_model: str = "BGE-M3"
    embedding_dimensions: int = 1024
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 4096


class QdrantConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="QDRANT_", extra="ignore")

    host: str = "localhost"
    port: int = 6333
    collection_name: str = "resume_chunks"
    distance_metric: Literal["cosine", "euclidean", "dot"] = "cosine"
    batch_size: int = 100
    timeout: float = 30.0


class InngestConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INNGEST_", extra="ignore")

    signing_key: str = ""
    event_key: str = ""
    base_url: str = "http://localhost:8288"
    dev_mode: bool = True


class OpenAIConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OPENAI_", extra="ignore")

    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    organization: str | None = None


class EmbeddingConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EMBEDDING_", extra="ignore")

    provider: Literal["openai", "local", "huggingface"] = "local"
    model_name: str = "BAAI/bge-m3"
    dimensions: int = 1024
    batch_size: int = 32
    max_retries: int = 3
    timeout: float = 60.0


class RerankerConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RERANKER_", extra="ignore")

    provider: Literal["openai", "local", "huggingface", "cohere"] = "local"
    model_name: str = "BAAI/bge-reranker-v2-m3"
    top_k: int = 20
    max_retries: int = 3
    timeout: float = 60.0


class ScoringConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SCORING_", extra="ignore")

    skill_weight: float = 0.40
    experience_weight: float = 0.20
    education_weight: float = 0.10
    semantic_weight: float = 0.30
    min_skill_match_threshold: float = 0.3
    min_experience_years: float = 0.0
    prompt_version: str = "1.0"
    scoring_version: str = "1.0"


class ChunkingConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CHUNKING_", extra="ignore")

    chunk_size: int = 1000
    chunk_overlap: int = 200
    min_chunk_size: int = 100


class SpringBootConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPRING_", extra="ignore")

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

    model: ModelConfig = ModelConfig()
    qdrant: QdrantConfig = QdrantConfig()
    inngest: InngestConfig = InngestConfig()
    openai: OpenAIConfig = OpenAIConfig()
    embedding: EmbeddingConfig = EmbeddingConfig()
    reranker: RerankerConfig = RerankerConfig()
    scoring: ScoringConfig = ScoringConfig()
    chunking: ChunkingConfig = ChunkingConfig()
    spring_boot: SpringBootConfig = SpringBootConfig()


settings = AppConfig()