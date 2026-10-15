# Graph Report - AI_Powered_Recruitment_System  (2026-10-15)

## Corpus Check
- 189 files · ~60,295 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .log 5, (none) 4, .properties 2)

## Summary
- 1564 nodes · 4523 edges · 83 communities (51 shown, 32 thin omitted)
- Extraction: 94% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 247 edges (avg confidence: 0.89)
- Token cost: 116,642 input · 0 output

## Community Hubs (Navigation)
- Core UI Primitives & Theming
- Java AI Service Client & DTOs
- Frontend Auth Context & Types
- Python Exception Hierarchy
- AI Callback Controller & Event DTOs
- Chart Component Library
- FastAPI AI Endpoints
- App Shell & Card Components
- Badge & Empty State Components
- Global Exception Handler
- Deterministic Scoring Service
- Embedding Service Abstraction
- Job & Admin Controllers
- PDF Processing & Candidate Extraction
- Inngest Workflow Implementations
- JWT Filter & Token Service
- Candidate Upload & File Storage
- User Entity & Response DTOs
- Security & WebClient Config
- Service Implementations & User Details
- Admin Recruiter Management
- Candidate Controller Endpoints
- Company Entity & Admin Requests
- Tabs & Candidate Profile Page
- Entity Mappers (MapStruct)
- Duplicate Registration Exceptions
- Job Service & Resource Errors
- AI Service Configuration
- Job Entity & Validation
- Qdrant Vector Store Service
- Logging & Module Exports
- Frontend Package Manifest
- Skill Entity & Repositories
- TypeScript Compiler Config
- Company Mapper & Conflict Errors
- Job Request/Response DTOs
- Company Controller & Service
- Recruiter Credential Email
- Frontend Runtime Dependencies
- AI Pipeline Design Concepts
- Company Isolation & Architecture Rules
- Auth Controller & Service
- Custom User Details
- Docker Compose Service Topology
- Frontend Dev Tooling
- Frontend API Client
- Resume Entity
- Layout & Sidebar Navigation
- Job Response Nested DTOs
- Candidate Entity & Repository
- Java-Python Integration Flows
- AI Callback Receivers
- Company Registration Response
- Application Status Enum
- Auth & DTO Boundary Policies
- Planned Screening Flow Specs
- Vite Node TS Config
- Login Response DTOs
- Skill Response DTO
- Employment Type Enum
- Frontend Pages & Design System
- Spring Boot Application Entry
- Job Status Enum
- Work Mode Enum
- Spring Boot Context Test
- NPM Scripts
- Status Enum
- Schema & Terminology Decisions
- Vite Build Config
- Bad Request Exception
- Constraint Violation Exception
- User Not Found Exception
- AI Service Root
- Maven Project Coordinates

## God Nodes (most connected - your core abstractions)
1. `CommonResponse` - 127 edges
2. `cn()` - 75 edges
3. `CandidateProfile` - 44 edges
4. `ResumeChunk` - 44 edges
5. `AIServiceResponse` - 41 edges
6. `Job` - 38 edges
7. `Company` - 35 edges
8. `Button` - 35 edges
9. `User` - 33 edges
10. `Card` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Key Technical Decisions (Tika, Ollama, pgvector, async)` --semantically_similar_to--> `Model Configuration (BGE-M3, GPT-4o-mini, Qwen3)`  [AMBIGUOUS] [semantically similar]
  IMPLEMENTATION_PLAN.md → ai-service/README.md
- `Java Job Embedding Service` --semantically_similar_to--> `Resume Ingestion (PDF to Qdrant)`  [INFERRED] [semantically similar]
  CURRENT_STATE_BE.md → ai-service/README.md
- `Planned Weighted Scoring Algorithm` --semantically_similar_to--> `Deterministic Candidate-Job Scoring Algorithm`  [INFERRED] [semantically similar]
  IMPLEMENTATION_PLAN.md → ai-service/README.md
- `Python AI Service Boundary` --semantically_similar_to--> `Stateless AI Service Design`  [INFERRED] [semantically similar]
  PROJECT_CONTEXT.md → ai-service/README.md
- `Planned RAG Summary Pipeline` --semantically_similar_to--> `Evidence-Based RAG Summary with Reranking`  [INFERRED] [semantically similar]
  IMPLEMENTATION_PLAN.md → ai-service/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Company Isolation Enforcement Across Layers** — project_context_company_isolation, development_rules_company_isolation, development_rules_never_trust_client_fields, project_context_securitycontext, current_state_be_admin_recruiter_management, current_state_be_job_management, current_state_be_entity_model [EXTRACTED 1.00]
- **Resume Screening Pipeline Participants** — current_status_resume_upload_flow, ai_service_readme_resume_ingestion, ai_service_readme_candidate_extraction, ai_service_readme_scoring_algorithm, ai_service_readme_rag_summary, ai_service_readme_candidate_ranking, ai_service_readme_qdrant_collection_schema, ai_service_readme_inngest_workflows [EXTRACTED 1.00]
- **Java-Python Integration Contract** — current_status_ai_service_client, current_status_ai_callback_controller, current_status_ai_dto_event_model, ai_service_readme_stateless_ai_service, current_status_inngest_relay_decision, project_context_ai_service_boundary, implementation_plan_api_contract [EXTRACTED 1.00]

## Communities (83 total, 32 thin omitted)

### Community 0 - "Core UI Primitives & Theming"
Cohesion: 0.05
Nodes (48): ButtonProps, IconButton, InputProps, SelectProps, Textarea, TextareaProps, ConfirmModal(), ConfirmModalProps (+40 more)

### Community 1 - "Java AI Service Client & DTOs"
Cohesion: 0.09
Nodes (5): AIServiceResponse, AIServiceClient, CandidateService, AIServiceClientImplementation, CandidateServiceImplementation

### Community 2 - "Frontend Auth Context & Types"
Cohesion: 0.05
Nodes (53): AuthContext, AuthContextType, AuthProvider(), CandidateListParams, CandidateCardProps, KanbanColumnProps, AIAnalysis, ApiError (+45 more)

### Community 3 - "Python Exception Hierarchy"
Cohesion: 0.08
Nodes (19): AIServiceError, CandidateExtractionError, ConfigurationError, InngestError, ModelUnavailableError, RAGError, RankingError, ValidationError (+11 more)

### Community 4 - "AI Callback Controller & Event DTOs"
Cohesion: 0.15
Nodes (14): EvidenceChunk, IngestResumeEvent, JobDescription, JobRequirement, MatchScore, RAGSummary, RAGSummaryEvent, RankCandidatesEvent (+6 more)

### Community 5 - "Chart Component Library"
Cohesion: 0.07
Nodes (34): BarChartComponent(), BarChartProps, ChartData, HorizontalBarChart(), HorizontalBarChartProps, ChartData, FunnelChartProps, LineChartProps (+26 more)

### Community 6 - "FastAPI AI Endpoints"
Cohesion: 0.09
Nodes (35): get_match_score(), get_rag_summary(), get_ranking(), ingest_resume(), IngestResumeRequest, rag_summary(), RAGSummaryRequest, rank_candidates() (+27 more)

### Community 7 - "App Shell & Card Components"
Cohesion: 0.12
Nodes (41): App(), FunnelChart(), LineChartComponent(), DonutChart(), Button, Card, CardContent, CardDescription (+33 more)

### Community 8 - "Badge & Empty State Components"
Cohesion: 0.16
Nodes (36): Badge(), BadgeProps, StatusBadge(), EmptyCandidates(), EmptyJobs(), EmptyPipeline(), EmptySearch(), EmptyState() (+28 more)

### Community 10 - "Deterministic Scoring Service"
Cohesion: 0.12
Nodes (22): ScoringError, CandidateProfile, Education, EducationLevel, JobDescription, Skill, ScoringService, test_candidate_profile_creation() (+14 more)

### Community 11 - "Embedding Service Abstraction"
Cohesion: 0.10
Nodes (8): EmbeddingError, BaseEmbeddingService, ConfigurationError, LocalBGEEmbeddingService, OpenAIEmbeddingService, TestEmbeddingServiceIntegration, TestQdrantIntegration, TestRerankerServiceIntegration

### Community 12 - "Job & Admin Controllers"
Cohesion: 0.09
Nodes (4): JobController, JobRequest, JobSkillRequest, JobService

### Community 13 - "PDF Processing & Candidate Extraction"
Cohesion: 0.10
Nodes (13): PDFProcessingError, CandidateExtractionService, PDFProcessingService, event_loop(), test_skill_validation(), candidate_extractor(), pdf_processor(), test_chunk_text_basic() (+5 more)

### Community 14 - "Inngest Workflow Implementations"
Cohesion: 0.15
Nodes (17): MatchScore, RAGSummary, _extract_profile_from_chunks(), _fetch_all_match_scores(), _fetch_candidate_profile(), _fetch_job_description(), _fetch_match_score(), _fetch_rag_summary() (+9 more)

### Community 16 - "Candidate Upload & File Storage"
Cohesion: 0.13
Nodes (5): CandidateUploadRequest, CandidateResponse, CandidateMapper, FileStorageService, FileStorageServiceImplementation

### Community 17 - "User Entity & Response DTOs"
Cohesion: 0.12
Nodes (8): User, CommonResponseStatus, FAILURE, SUCCESS, UNAUTHORIZED, Role, ADMIN, RECRUITER

### Community 19 - "Service Implementations & User Details"
Cohesion: 0.15
Nodes (3): AuthServiceImplementation, EmbeddingServiceImplementation, CustomUserDetailsService

### Community 22 - "Company Entity & Admin Requests"
Cohesion: 0.10
Nodes (5): AdminRequest, RecruiterRequest, UserResponse, Company, UserMapper

### Community 23 - "Tabs & Candidate Profile Page"
Cohesion: 0.15
Nodes (21): Tabs(), TabsContent(), TabsContentProps, TabsContext, TabsContextType, TabsList(), TabsListProps, TabsProps (+13 more)

### Community 24 - "Entity Mappers (MapStruct)"
Cohesion: 0.14
Nodes (4): JobSkill, JobMapper, JobSkillMapper, SkillMapper

### Community 25 - "Duplicate Registration Exceptions"
Cohesion: 0.22
Nodes (4): EmailAlreadyRegisteredException, PhoneNumberAlreadyExistsException, UserRepository, UserServiceImplementation

### Community 27 - "AI Service Configuration"
Cohesion: 0.19
Nodes (18): AppConfig, ChunkingConfig, EmbeddingConfig, InngestConfig, ModelConfig, OpenAIConfig, QdrantConfig, RerankerConfig (+10 more)

### Community 28 - "Job Entity & Validation"
Cohesion: 0.10
Nodes (3): Job, JobRepository, EmbeddingService

### Community 29 - "Qdrant Vector Store Service"
Cohesion: 0.16
Nodes (6): health_check(), lifespan(), QdrantError, create_embedding_service(), EmbeddingService, QdrantService

### Community 30 - "Logging & Module Exports"
Cohesion: 0.18
Nodes (3): add_service_context(), get_logger(), setup_logging()

### Community 31 - "Frontend Package Manifest"
Cohesion: 0.09
Nodes (22): name, type, version, autoprefixer, clsx, date-fns, @dnd-kit/core, @dnd-kit/sortable (+14 more)

### Community 32 - "Skill Entity & Repositories"
Cohesion: 0.15
Nodes (4): Skill, CompanyRepository, ResumeRepository, SkillRepository

### Community 33 - "TypeScript Compiler Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 34 - "Company Mapper & Conflict Errors"
Cohesion: 0.18
Nodes (5): CompanyResponse, RecruiterSummary, ConflictException, CompanyMapper, CompanyServiceImplementation

### Community 35 - "Job Request/Response DTOs"
Cohesion: 0.22
Nodes (3): SkillType, PREFERRED, REQUIRED

### Community 36 - "Company Controller & Service"
Cohesion: 0.20
Nodes (3): CompanyController, CompanyRequest, CompanyService

### Community 38 - "Frontend Runtime Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, clsx, date-fns, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @hookform/resolvers, lottie-react (+9 more)

### Community 39 - "AI Pipeline Design Concepts"
Cohesion: 0.16
Nodes (14): Scoring Weight Environment Configuration, Structured Candidate Profile Extraction, Deterministic Candidate Ranking, Inngest Workflow Definitions, AI Service Monitoring & Observability, resume_chunks Qdrant Collection Schema, Evidence-Based RAG Summary with Reranking, Resume Ingestion (PDF to Qdrant) (+6 more)

### Community 40 - "Company Isolation & Architecture Rules"
Cohesion: 0.14
Nodes (10): ai_resume_postgres container (pgvector/pg16), Admin to Recruiter Management, Company Registration & Verification Module, Recruiter Credential Email Service, Backend Entity Model and Relationships, Job Management (Recruiter & Admin Endpoints), Role-Based Navigation & Protected Routes, Company Verification Flow (planned) (+2 more)

### Community 41 - "Auth Controller & Service"
Cohesion: 0.21
Nodes (3): AuthController, UpdateProfileRequest, AuthService

### Community 43 - "Docker Compose Service Topology"
Cohesion: 0.23
Nodes (13): ai-service container, inngest dev container, qdrant container, Java Job Embedding Service, FastAPI AI Service (README view), Full-Stack Architecture Overview, Spring Boot Backend Service, Service Environment Variable Reference (+5 more)

### Community 44 - "Frontend Dev Tooling"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, postcss, tailwindcss, @types/react (+6 more)

### Community 48 - "Layout & Sidebar Navigation"
Cohesion: 0.38
Nodes (8): getPageTitle(), Layout(), navigation, Sidebar(), SidebarProps, useAuth(), useTheme(), react-router-dom

### Community 49 - "Job Response Nested DTOs"
Cohesion: 0.64
Nodes (4): CompanyInfo, JobResponse, SkillInfo, UserInfo

### Community 51 - "Java-Python Integration Flows"
Cohesion: 0.28
Nodes (8): AICallbackController (/api/ai/* callbacks), AI Event & Result DTO Model (dto/ai), AIServiceClient (Java WebClient integration), Candidate Scoring Flow, CandidateServiceImplementation (upload orchestration), Candidate Profile Page with AI Analysis Tab, FileStorageService (local filesystem), RAG Summary Flow

### Community 53 - "Company Registration Response"
Cohesion: 0.61
Nodes (3): AdminInfo, CompanyInfo, CompanyRegistrationResponse

### Community 54 - "Application Status Enum"
Cohesion: 0.25
Nodes (7): ApplicationStatus, APPLIED, INTERVIEW, REJECTED, SCREENING, SELECTED, SHORTLISTED

### Community 55 - "Auth & DTO Boundary Policies"
Cohesion: 0.29
Nodes (4): JWT Authentication & Authorization, Non-Confidential Response DTOs, Frontend API Layer, Frontend AuthContext

### Community 56 - "Planned Screening Flow Specs"
Cohesion: 0.29
Nodes (7): Missing Resumes Page, Resume Upload Flow, Java-Python Score Candidate API Contract, Java-Side Flow Orchestration (10 steps), PythonAiClient (planned Java WebClient client), Planned Weighted Scoring Algorithm, Resume Screening & Ranking End-to-End Flow

### Community 57 - "Vite Node TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 60 - "Employment Type Enum"
Cohesion: 0.29
Nodes (6): EmploymentType, CONTRACT, FREELANCE, FULL_TIME, INTERNSHIP, PART_TIME

### Community 61 - "Frontend Pages & Design System"
Cohesion: 0.29
Nodes (5): Recruiter Dashboard Page, Candidate Pipeline Kanban Board, RecruitAI Frontend App Shell, AI Resume Screening Pipeline, End-to-End Recruitment Workflow

### Community 63 - "Job Status Enum"
Cohesion: 0.33
Nodes (5): JobStatus, ARCHIVED, CLOSED, DRAFT, OPEN

### Community 64 - "Work Mode Enum"
Cohesion: 0.40
Nodes (4): WorkMode, HYBRID, ONSITE, REMOTE

### Community 66 - "NPM Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 67 - "Status Enum"
Cohesion: 0.50
Nodes (3): Status, ACTIVE, INACTIVE

## Ambiguous Edges - Review These
- `Key Technical Decisions (Tika, Ollama, pgvector, async)` → `Model Configuration (BGE-M3, GPT-4o-mini, Qwen3)`  [AMBIGUOUS]
  IMPLEMENTATION_PLAN.md · relation: semantically_similar_to
- `AI-Powered Recruitment Platform Overview` → `Spring Boot Backend Service`  [AMBIGUOUS]
  README.md · relation: references
- `FastAPI AI Service (README view)` → `AIServiceClient (Java WebClient integration)`  [AMBIGUOUS]
  current_status.md · relation: references

## Knowledge Gaps
- **47 isolated node(s):** `ai-service`, `com.project:AI_ResumeRAG_BE`, `APPLIED`, `SCREENING`, `SHORTLISTED` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 480 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CommonResponse` connect `Global Exception Handler` to `Company Mapper & Conflict Errors`, `AI Callback Controller & Event DTOs`, `Company Controller & Service`, `Auth Controller & Service`, `Job & Admin Controllers`, `User Entity & Response DTOs`, `Service Implementations & User Details`, `Admin Recruiter Management`, `AI Callback Receivers`, `Candidate Controller Endpoints`, `Company Entity & Admin Requests`, `Duplicate Registration Exceptions`, `Job Service & Resource Errors`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `ai-service`, `com.project:AI_ResumeRAG_BE`, `APPLIED` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core UI Primitives & Theming` be split into smaller, more focused modules?**
  _Cohesion score 0.05310734463276836 - nodes in this community are weakly interconnected._
- **Why does `ResumeChunk` connect `Python Exception Hierarchy` to `FastAPI AI Endpoints`, `Deterministic Scoring Service`, `Embedding Service Abstraction`, `PDF Processing & Candidate Extraction`, `Inngest Workflow Implementations`, `Qdrant Vector Store Service`, `Logging & Module Exports`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Java AI Service Client & DTOs` be split into smaller, more focused modules?**
  _Cohesion score 0.0853302162478083 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Key Technical Decisions (Tika, Ollama, pgvector, async)` and `Model Configuration (BGE-M3, GPT-4o-mini, Qwen3)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `AI-Powered Recruitment Platform Overview` and `Spring Boot Backend Service`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._