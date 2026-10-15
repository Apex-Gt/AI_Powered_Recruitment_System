import pytest
from app.core.config import (
    AppConfig,
    ModelConfig,
    QdrantConfig,
    EmbeddingConfig,
    RerankerConfig,
    ScoringConfig,
    ChunkingConfig,
)


def test_model_config_defaults():
    config = ModelConfig()
    assert config.foundation_model == "Qwen3-Embedding-8B"
    assert config.embedding_model == "BGE-M3"
    assert config.embedding_dimensions == 1024


def test_llm_config_defaults_to_free_groq_model():
    from app.core.config import LLMConfig

    config = LLMConfig(_env_file=None)
    assert config.base_url == "https://api.groq.com/openai/v1"
    assert config.model == "llama-3.3-70b-versatile"
    assert config.temperature == 0.1
    assert not config.is_configured  # hosted provider needs a key


def test_llm_config_local_server_needs_no_key():
    from app.core.config import LLMConfig

    assert LLMConfig(_env_file=None, base_url="http://localhost:11434/v1").is_configured
    assert LLMConfig(_env_file=None, api_key="k").is_configured


def test_qdrant_config_defaults():
    config = QdrantConfig()
    assert config.host == "localhost"
    assert config.port == 6333
    assert config.collection_name == "resume_chunks"
    assert config.distance_metric == "cosine"
    assert config.batch_size == 100
    assert config.timeout == 30.0


def test_embedding_config_defaults():
    config = EmbeddingConfig()
    assert config.provider == "local"
    assert config.model_name == "BAAI/bge-m3"
    assert config.dimensions == 1024
    assert config.batch_size == 32
    assert config.max_retries == 3
    assert config.timeout == 60.0


def test_reranker_config_defaults():
    config = RerankerConfig()
    assert config.provider == "local"
    assert config.model_name == "BAAI/bge-reranker-v2-m3"
    assert config.top_k == 20
    assert config.max_retries == 3
    assert config.timeout == 60.0


def test_scoring_config_defaults():
    config = ScoringConfig()
    assert config.skill_weight == 0.40
    assert config.experience_weight == 0.20
    assert config.education_weight == 0.10
    assert config.semantic_weight == 0.30
    assert config.min_skill_match_threshold == 0.3
    assert config.prompt_version == "1.0"
    assert config.scoring_version == "1.0"


def test_chunking_config_defaults():
    config = ChunkingConfig()
    assert config.chunk_size == 1000
    assert config.chunk_overlap == 200
    assert config.min_chunk_size == 100


def test_app_config_loads():
    config = AppConfig()
    assert config.environment == "development"
    assert config.log_level == "INFO"
    assert config.api_host == "0.0.0.0"
    assert config.api_port == 8000
    assert isinstance(config.model, ModelConfig)
    assert isinstance(config.qdrant, QdrantConfig)
    assert isinstance(config.embedding, EmbeddingConfig)
    assert isinstance(config.reranker, RerankerConfig)
    assert isinstance(config.scoring, ScoringConfig)
    assert isinstance(config.chunking, ChunkingConfig)