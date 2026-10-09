# AI RESUME RAG — PROJECT CONTEXT

## PROJECT

Name:
AI-Powered Intelligent Recruitment and Candidate Shortlisting Platform

Purpose:
An AI-powered recruitment platform for companies to manage recruiters,
jobs, candidates, resumes, assessments, interviews, candidate evaluation,
ranking and shortlisting.

The platform combines traditional recruitment workflows with:
- Resume parsing
- Semantic job-resume matching
- Embeddings
- LLM-based analysis
- RAG
- Candidate scoring
- Candidate ranking
- Assessments
- Coding evaluation
- Interview analysis

---

## TERMINOLOGY

IMPORTANT:

Always use:
"company"

Never use:
"organization"

The database/entity/business terminology must use Company.

---

## TECHNOLOGY

Backend:
- Java 25 (latest LTS)
- Spring Boot
- Spring Security
- JWT
- Maven
- Spring Data JPA
- MapStruct

Database:
- PostgreSQL
- pgvector

Frontend:
- React / Next.js
- TypeScript

AI:
- Python
- NLP
- Embeddings
- LLM
- RAG
- Semantic Search

Infrastructure:
- Docker
- Docker Compose

Testing:
- Postman
- JUnit
- Mockito

---

## ARCHITECTURE

Current backend architecture:

Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL

Security:

HTTP Request
    ↓
JwtAuthenticationFilter
    ↓
JwtService
    ↓
CustomUserDetailsService
    ↓
UserRepository
    ↓
CustomUserDetails
    ↓
SecurityContextHolder
    ↓
Controller / Service

AI architecture:

React
    ↓
Spring Boot
    ↓
Python AI Service
    ↓
NLP / Embeddings / LLM / RAG
    ↓
AI Result
    ↓
Spring Boot
    ↓
React

---

## USER ROLES

PLATFORM_ADMIN
ADMIN
RECRUITER

### PLATFORM_ADMIN

Platform-level administrator.

Responsibilities:
- Verify companies
- Manage platform-level operations

Status:
PLANNED / PARTIALLY IMPLEMENTED

### ADMIN

Company administrator.

Responsibilities:
- Belongs to one company
- Creates recruiters
- Views company-wide recruitment data
- Manages company recruitment operations

### RECRUITER

Company recruiter.

Responsibilities:
- Belongs to one company
- Creates jobs
- Manages candidates
- Uploads resumes
- Runs recruitment processes
- Performs interviews

---

## COMPANY ISOLATION

This is a critical security requirement.

Every User belongs to a Company.

Every Job belongs to a Company.

A recruiter must NEVER access another company's data.

Recruiter A:
→ Can access only Recruiter A's permitted recruitment data.

Recruiter B:
→ Can access only Recruiter B's permitted recruitment data.

Company ADMIN:
→ Can access all recruitment data belonging to their company.

Ownership must always be enforced by the backend.

Never trust companyId supplied by the frontend.

---

## CORE RELATIONSHIPS

Company
    1
    |
    N
User

Company
    1
    |
    N
Job

User
    1
    |
    N
Job

Job
    1
    |
    N
Candidate

Candidate
    1
    |
    1
Resume

---

## CURRENT USER MODEL

User contains identity and authentication information.

Important fields:

- id
- userName
- email
- phoneNumber
- password
- emailVerified
- phoneNumberVerified
- role
- company
- createdAt
- updatedAt

Do not put unnecessary recruiter-specific profile information into User.

If recruiter-specific profile information becomes necessary,
consider a separate RecruiterProfile entity.

---

## COMPANY MODEL

Company contains company information.

Important fields:

- id
- companyName
- country
- state
- city
- industry
- registrationNumber
- gstNumber
- logo
- companyEmail
- phoneNumber
- companyVerified
- active
- createdAt
- updatedAt

Company email and phone number are NOT intended to be the
duplicate-company identity criteria.

Registration number should be used for company uniqueness.

GST number can also have a uniqueness constraint when applicable.

---

## AUTHENTICATION

Authentication uses JWT.

Current flow:

Login
    ↓
Spring AuthenticationManager
    ↓
UserDetailsService
    ↓
User
    ↓
JWT generated
    ↓
JWT stored in HttpOnly cookie
    ↓
Future request
    ↓
JwtAuthenticationFilter
    ↓
JWT validation
    ↓
User loaded from database
    ↓
CustomUserDetails
    ↓
SecurityContextHolder

---

## JWT

Recommended claims:

sub
userId
role
companyId
iat
exp

Do NOT put:

- password
- password hash
- phone number
- unnecessary company information
- candidate information
- resume information

JWT identifies/authenticates the user.

Database queries and backend authorization enforce actual ownership.

---

## SECURITYCONTEXT

CustomUserDetails wraps the User entity.

Current structure:

Authentication
    ↓
CustomUserDetails
    ↓
User
    ↓
Company

Current user company can be obtained using:

customUserDetails.getUser().getCompany()

For company ID:

customUserDetails.getUser().getCompany().getId()

Do not accept companyId from client requests when it can be derived
from the authenticated user.

---

## DTO RULES

Client-controlled requests must NOT contain backend-controlled values.

Do NOT accept:

- companyId
- role
- createdBy
- companyVerified
- emailVerified
- phoneNumberVerified

The backend must determine these values.

---

## COMPANY REGISTRATION

Company registration creates:

1. Company
2. First ADMIN user

This operation should be transactional.

Flow:

Company Registration
    ↓
Create Company
    ↓
Create ADMIN User
    ↓
Associate ADMIN with Company

---

## COMPANY VERIFICATION

Planned flow:

Company Registration
    ↓
Admin email verification
    ↓
Email verification link
    ↓
Phone OTP verification
    ↓
Submit company verification details
    ↓
Platform Admin review
    ↓
companyVerified = true

Important:

The frontend must never directly set:
companyVerified = true

Only the backend/platform admin can do this.

---

## RECRUITER CREATION

ADMIN creates recruiter.

Request:

userName
email
phoneNumber
password

Do NOT include:

companyId
role

Backend determines:

role = RECRUITER

company = authenticated ADMIN's company

Flow:

ADMIN JWT
    ↓
SecurityContext
    ↓
Current ADMIN
    ↓
Current Company
    ↓
Create RECRUITER
    ↓
Associate recruiter with same Company

---

## RECRUITER REQUEST

Current DTO:

RecruiterRequest

Fields:

- userName
- email
- phoneNumber
- password

Example:

{
  "userName": "Kewin",
  "email": "kewin@abctech.com",
  "phoneNumber": "+918883296337",
  "password": "Recruiter@123"
}

---

## JOB OWNERSHIP

Job should contain:

company_id
created_by

company_id:
The company owning the job.

created_by:
The recruiter who created the job.

Never accept these ownership values blindly from the client.

Derive them from the authenticated user.

---

## RECRUITMENT WORKFLOW

Company registration
    ↓
Company verification
    ↓
Admin
    ↓
Create recruiters
    ↓
Recruiter login
    ↓
Create job
    ↓
Upload candidate resumes
    ↓
Parse resumes
    ↓
Generate embeddings
    ↓
Compare resume with job
    ↓
Calculate matching score
    ↓
Generate explanation
    ↓
Rank candidates
    ↓
Shortlist candidates
    ↓
Assessment
    ↓
Coding assessment
    ↓
Recruiter interview
    ↓
AI interview analysis
    ↓
Final candidate evaluation

---

## AI RESUME SCREENING

Inputs:

Job Description
+
Candidate Resume

Processing:

Resume
    ↓
Text extraction
    ↓
Resume normalization
    ↓
Embedding generation
    ↓
Vector storage
    ↓
Job embedding
    ↓
Semantic similarity
    ↓
Candidate matching score
    ↓
LLM explanation

Output:

- Match score
- Matching skills
- Missing skills
- Relevant experience
- Explanation
- Ranking information

---

## AI SERVICE

AI functionality is intended to be implemented in Python.

Java Spring Boot remains the main backend.

Communication:

Spring Boot
    ↓
HTTP REST API
    ↓
Python AI Service
    ↓
AI processing
    ↓
JSON response
    ↓
Spring Boot

Do not move the entire application to Python.

---

## FUTURE MODULES

Planned modules:

1. Company
2. Authentication
3. Recruiter
4. Job
5. Candidate
6. Resume
7. AI Screening
8. Candidate Ranking
9. Assessment
10. Coding Assessment
11. Interview
12. AI Interview Analysis
13. Notification
14. Analytics
15. Platform Administration

---

## DEVELOPMENT PRINCIPLE

Do not redesign the project unnecessarily.

Before changing anything:

1. Inspect existing code.
2. Understand the current implementation.
3. Check CURRENT_STATE.md.
4. Make the smallest required change.
5. Preserve existing naming and architecture.
6. Do not modify unrelated modules.