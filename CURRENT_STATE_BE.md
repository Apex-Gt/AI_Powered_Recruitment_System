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
- JWT with HttpOnly cookie
- JWT claims: `userId`, `role`, `companyId`
- JwtAuthenticationFilter for token validation
- CustomUserDetailsService + CustomUserDetails
- BCrypt password encoding

### 3. Admin → Recruiter Management
- **POST /api/admin/recruiters** - Admin creates recruiters
- `@PreAuthorize("hasRole('ADMIN')")`
- Derives company from authenticated admin (company isolation)
- Recruiter gets `role=RECRUITER`, same `companyId` as admin
- Email/phone uniqueness validation

### 4. Job Management (Recruiter & Admin)
- **POST /api/job** - Create job
- `@PreAuthorize("hasAnyRole('RECRUITER', 'ADMIN')")`
- Auto-sets: `company` (from auth user), `createdBy` (auth user), `status=OPEN`
- JobSkills embedded in request
- **GET /api/job/my-jobs** - List jobs created by authenticated user
- Filters by `createdBy` = current user (recruiters see only their jobs)

### 5. AI Embedding Service
- EmbeddingService + EmbeddingServiceImplementation
- Generates job embeddings via Spring AI / Ollama
- Builds job text from title, department, skills, description, etc.
- Stores `float[] jdEmbedding` in Job entity (pgvector)

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

1. **Email service for recruiter credentials** - Admin-created recruiters receive credentials via email with company name
2. **Dynamic company name in emails** - Uses admin's company name (from security context) instead of static config
3. **Email authentication fix** - App now starts without email config; sends gracefully when configured with Gmail App Password
4. **Job ownership enforcement** - Recruiters see only their jobs via `GET /job/my-jobs`
5. **Recruiter creation by Admin** - `POST /admin/recruiters` with company isolation
6. **Login response DTO** - Structured `LoginResponse` with user info + token metadata
7. **Company registration response** - `CompanyRegistrationResponse` with CompanyInfo + AdminInfo
8. **GST uniqueness check** - Prevents duplicate company registration
9. **Method-level security** - Added `@EnableMethodSecurity` and `@PreAuthorize` annotations
10. **Job entity fix** - Changed `createdBy` from Recruiter to User entity

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
│   │   └── JobController.java
│   ├── service/
│   │   ├── AuthService.java
│   │   ├── CompanyService.java
│   │   ├── UserService.java
│   │   ├── JobService.java
│   │   └── EmbeddingService.java
│   ├── service/implementation/
│   │   ├── AuthServiceImplementation.java
│   │   ├── CompanyServiceImplementation.java
│   │   ├── UserServiceImplementation.java
│   │   ├── JobServiceImplementation.java
│   │   └── EmbeddingServiceImplementation.java
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

*Last Updated: 2026-10-03*