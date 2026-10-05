# AI RESUME RAG — CURRENT STATE

## PROJECT STATUS: BACKEND CORE MODULES IMPLEMENTED

---

## ✅ IMPLEMENTED MODULES

### 1. Company Registration & Verification
- **POST /api/company/register** - Register company + create first ADMIN user
- Transactional operation (Company + Admin created atomically)
- GST number uniqueness validation
- Returns structured response with CompanyInfo + AdminInfo (no confidential data)
- Company starts as `companyVerified=false`, `active=true`

### 2. Authentication & Authorization
- **POST /api/auth/login** - Login for all roles (ADMIN, RECRUITER)
- JWT with HttpOnly cookie (1hr expiry)
- JWT claims: `userId`, `role`, `companyId`
- JwtAuthenticationFilter for token validation
- CustomUserDetailsService + CustomUserDetails
- BCrypt password encoding
- **GET /api/auth/me** - Get current authenticated user
- **POST /api/auth/logout** - Clear JWT cookie
- **PUT /api/auth/me** - Update current user profile

### 3. Admin → Recruiter Management
- **POST /api/admin/recruiters** - Admin creates recruiters
- `@PreAuthorize("hasRole('ADMIN')")`
- Derives company from authenticated admin (company isolation)
- Recruiter gets `role=RECRUITER`, same `companyId` as admin
- Email/phone uniqueness validation
- **GET /api/admin/recruiters** - List all recruiters for company
- **GET /api/admin/recruiters/{id}** - Get recruiter by ID
- **PUT /api/admin/recruiters/{id}** - Update recruiter

### 4. Job Management (Recruiter & Admin)
- **POST /api/job** - Create job (RECRUITER, ADMIN)
- `@PreAuthorize("hasAnyRole('RECRUITER', 'ADMIN')")`
- Auto-sets: `company` (from auth user), `createdBy` (auth user), `status=OPEN`
- JobSkills embedded in request
- **GET /api/job/my-jobs** - List jobs created by authenticated user
- Filters by `createdBy` = current user (recruiters see only their jobs)

#### Recruiter-Specific Endpoints
- **GET /api/recruiter/jobs** - Get my jobs
- **GET /api/recruiter/jobs/{jobId}** - Get job by ID (own jobs only)
- **PUT /api/recruiter/jobs/{jobId}** - Update own job

#### Admin-Specific Job Endpoints
- **GET /api/admin/jobs** - Get all jobs in company
- **GET /api/admin/jobs/{jobId}** - Get any job by ID
- **PUT /api/admin/jobs/{jobId}** - Update any job

### 5. Company Management (Admin)
- **GET /api/admin/company** - Get company details
- **PUT /api/admin/company** - Update company profile

### 6. AI Embedding Service
- EmbeddingService + EmbeddingServiceImplementation
- Generates job embeddings via Spring AI / Ollama
- Builds job text from title, department, skills, description, etc.
- Stores `float[] jdEmbedding` in Job entity (pgvector)

### 7. Email Service
- EmailService + EmailServiceImplementation
- Sends recruiter credentials via email on creation
- Uses company name from admin's context
- Graceful startup without email config (Gmail App Password when configured)

---

## 🏗️ TECHNICAL ARCHITECTURE

### Entities
| Entity | Key Fields | Relationships |
|--------|------------|---------------|
| **Company** | id, companyName, gstNumber(unique), companyVerified, active | 1→N User, 1→N Job |
| **User** | id, userName, email(unique), phoneNumber(unique), password, role, emailVerified, phoneNumberVerified | N→1 Company |
| **Job** | id, title, department, employmentType, workMode, location, experienceRequired, educationRequired, salary range, description, jdEmbedding(vector), status, company_id, created_by | N→1 Company, N→1 User(createdBy), 1→N JobSkill |
| **JobSkill** | id, skillName, type(REQUIRED/PREFERRED), weight | N→1 Job |
| **Candidate** | id, candidateName, candidateEmail, phoneNumber, status, appliedAt | N→1 Job, 1→1 Resume |
| **Resume** | id, fileName, fileUrl, extractedText, uploadedAt | 1→1 Candidate |
| **Recruiter** | id, designation, experience | 1→1 User |

### Security
- JWT in HttpOnly cookie (1hr expiry)
- Stateless session management
- Method-level security: `@EnableMethodSecurity` + `@PreAuthorize`
- Company isolation enforced at service layer (derive from SecurityContext)

### DTOs (Response - No Confidential Data)
- `CompanyRegistrationResponse` (CompanyInfo + AdminInfo)
- `LoginResponse` (accessToken, tokenType, expiresIn, UserInfo)
- `UserResponse`, `JobResponse`, `CommonResponse`

---

## 🔧 TECH STACK
- **Java 21**, Spring Boot 4.1.0
- Spring Security, JWT (jjwt 0.12.7)
- Spring Data JPA, MapStruct
- PostgreSQL + pgvector
- Spring AI (Ollama embeddings)
- Maven, Lombok

---

## ⏳ PENDING / PLANNED MODULES

### High Priority
- [ ] Candidate & Resume Management (upload, parse, store)
- [ ] AI Resume Screening (Python service integration)
- [ ] Semantic matching & candidate scoring
- [ ] Candidate ranking & shortlisting

### Medium Priority
- [ ] Assessments & Coding Assessments
- [ ] Interview scheduling & AI interview analysis
- [ ] Company verification workflow (email OTP, phone OTP, platform admin review)
- [ ] PLATFORM_ADMIN role & endpoints
- [x] Email notification service (recruiter credentials)

### Low Priority
- [ ] Analytics dashboard
- [ ] Notification system
- [ ] Advanced search & filtering

---

## 📋 RECENT CHANGES (Latest First)

1. **RecruiterController added** - Dedicated endpoints for recruiter-specific operations (get my jobs, get job by ID, update job, get current user)
2. **JobController enhanced** - Added admin-specific job endpoints (get all jobs, get job by ID, update job)
3. **AdminController enhanced** - Added company management (get/update), recruiter listing/get/update, job management for admin
4. **AuthController enhanced** - Added logout, get current user, update profile endpoints
5. **Email service for recruiter credentials** - Admin-created recruiters receive credentials via email with company name
6. **Dynamic company name in emails** - Uses admin's company name (from security context) instead of static config
7. **Email authentication fix** - App now starts without email config; sends gracefully when configured with Gmail App Password
8. **Job ownership enforcement** - Recruiters see only their jobs via `GET /job/my-jobs`
9. **Recruiter creation by Admin** - `POST /admin/recruiters` with company isolation
10. **Login response DTO** - Structured `LoginResponse` with user info + token metadata
11. **Company registration response** - `CompanyRegistrationResponse` with CompanyInfo + AdminInfo
12. **GST uniqueness check** - Prevents duplicate company registration
13. **Method-level security** - Added `@EnableMethodSecurity` and `@PreAuthorize` annotations
14. **Job entity fix** - Changed `createdBy` from Recruiter to User entity

---

## 🚀 HOW TO TEST CURRENT FLOW

```bash
# 1. Register Company + Admin
POST /api/company/register
{
  "companyName": "ABC Tech",
  "country": "India",
  "state": "Karnataka",
  "city": "Bangalore",
  "gstNumber": "GST123456",
  "adminUserName": "admin",
  "adminEmail": "admin@abctech.com",
  "adminPhoneNumber": "+919999999999",
  "password": "Admin@123"
}

# 2. Login as Admin
POST /api/auth/login
{
  "email": "admin@abctech.com",
  "password": "Admin@123"
}

# 3. Create Recruiter (using admin JWT cookie)
POST /api/admin/recruiters
{
  "userName": "recruiter1",
  "email": "recruiter1@abctech.com",
  "phoneNumber": "+918888888888",
  "password": "Recruiter@123"
}

# 4. Login as Recruiter
POST /api/auth/login
{
  "email": "recruiter1@abctech.com",
  "password": "Recruiter@123"
}

# 5. Create Job (using recruiter JWT cookie)
POST /api/job
{
  "title": "Senior Java Developer",
  "department": "Engineering",
  "employmentType": "FULL_TIME",
  "workMode": "HYBRID",
  "location": "Bangalore",
  "experienceRequired": 5,
  "educationRequired": "B.Tech",
  "minimumSalary": 1500000,
  "maximumSalary": 2500000,
  "description": "We need a senior Java developer...",
  "applicationDeadline": "2026-12-31",
  "vacancies": 2,
  "skills": [
    {"skillName": "Java", "type": "REQUIRED", "weight": 30},
    {"skillName": "Spring Boot", "type": "REQUIRED", "weight": 25},
    {"skillName": "PostgreSQL", "type": "PREFERRED", "weight": 15}
  ]
}

# 6. Get My Jobs (recruiter sees only their jobs)
GET /api/job/my-jobs
# OR (recruiter-specific endpoint)
GET /api/recruiter/jobs

# 7. Get current user profile
GET /api/auth/me
# OR (recruiter-specific)
GET /api/recruiter/me

# 8. Logout
POST /api/auth/logout
```

---

## 📂 KEY FILE STRUCTURE
```
backend/
├── src/main/java/com/project/ai_resumerag_be/
│   ├── controller/
│   │   ├── AuthController.java
│   │   ├── CompanyController.java
│   │   ├── AdminController.java
│   │   ├── JobController.java
│   │   └── RecruiterController.java
│   ├── service/
│   │   ├── AuthService.java
│   │   ├── CompanyService.java
│   │   ├── UserService.java
│   │   ├── JobService.java
│   │   ├── EmbeddingService.java
│   │   └── EmailService.java
│   ├── service/implementation/
│   │   ├── AuthServiceImplementation.java
│   │   ├── CompanyServiceImplementation.java
│   │   ├── UserServiceImplementation.java
│   │   ├── JobServiceImplementation.java
│   │   ├── EmbeddingServiceImplementation.java
│   │   └── EmailServiceImplementation.java
│   ├── entity/
│   │   ├── Company.java, User.java, Job.java, JobSkill.java
│   │   ├── Candidate.java, Resume.java, Recruiter.java
│   ├── repository/
│   │   ├── CompanyRepository.java, UserRepository.java, JobRepository.java
│   ├── dto/request/ & dto/response/
│   ├── mapper/
│   ├── config/
│   │   ├── SecurityConfig.java, JwtAuthenticationFilter.java
│   ├── service/security/
│   │   ├── JwtService.java, CustomUserDetailsService.java, CustomUserDetails.java
│   └── exception/ (GlobalExceptionHandler + custom exceptions)
```

---

*Last Updated: 2026-10-05*