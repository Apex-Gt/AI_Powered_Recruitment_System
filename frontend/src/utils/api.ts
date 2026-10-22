const API_BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Fired when a protected request is rejected with 401 (expired/invalid session)
export const AUTH_EXPIRED_EVENT = 'auth:expired'

// In-flight request cache to prevent duplicate simultaneous requests
const inFlightRequests = new Map<string, Promise<any>>()

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private getCacheKey(endpoint: string, options: RequestInit): string {
    const method = options.method || 'GET'
    // Include query params in cache key for GET requests
    if (method === 'GET' && endpoint.includes('?')) {
      return `${method}:${endpoint}`
    }
    return `${method}:${endpoint.split('?')[0]}`
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const cacheKey = this.getCacheKey(endpoint, options)

    // For GET requests, deduplicate simultaneous identical requests
    if ((options.method === 'GET' || !options.method) && inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>
    }

    const isFormData = options.body instanceof FormData
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    } as Record<string, string>

    // Add Authorization header if we have a token (fallback for cookie issues)
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    const requestPromise = fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }))
        // 401 on anything except login/me means the session is no longer valid.
        // (/auth/me is handled by AuthContext, which also distinguishes network errors.)
        if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/me') {
          window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
        }
        throw new ApiError(error.message || `HTTP error! status: ${response.status}`, response.status)
      }

      if (response.status === 204) {
        return {} as T
      }

      return response.json()
    }).finally(() => {
      // Clean up cache after request completes
      inFlightRequests.delete(cacheKey)
    })

    // Cache the promise for GET requests
    if ((options.method === 'GET' || !options.method)) {
      inFlightRequests.set(cacheKey, requestPromise)
    }

    return requestPromise
  }

  get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)])
    ).toString() : ''
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' })
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    })
  }

  patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // Auth token management for Authorization header fallback
  private authToken: string | null = null

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  getAuthToken(): string | null {
    return this.authToken
  }

  // Clear auth token on logout
  clearAuthToken() {
    this.authToken = null
  }
}

export const api = new ApiClient()

export const authApi = {
  login: (email: string, password: string) =>
    api.post<CommonResponse<LoginResponse>>('/auth/login', { email, password }).then((res) => {
      // Store token for Authorization header fallback
      if (res.data?.accessToken) {
        api.setAuthToken(res.data.accessToken)
      }
      return res
    }),
  logout: () => api.post('/auth/logout', {}).finally(() => {
    api.clearAuthToken()
  }),
  getMe: () => api.get<CommonResponse<UserResponse>>('/auth/me'),
  updateMe: (data: { userName: string; email: string; phoneNumber?: string }) =>
    api.put<CommonResponse<UserResponse>>('/auth/me', data),
}

export const companyApi = {
  register: (data: CompanyRegistrationRequest) =>
    api.post<CommonResponse<CompanyRegistrationResponse>>('/company/register', data),
  getForAdmin: () => api.get<CommonResponse<Company>>('/admin/company'),
  updateForAdmin: (data: { companyName?: string; country?: string; state?: string; city?: string; industry?: string }) =>
    api.put<CommonResponse<Company>>('/admin/company', data),
}

// The backend returns job lists as a plain array and uses OPEN/ARCHIVED statuses.
// Normalise to the shape the UI uses (ACTIVE/CLOSED) and paginate/filter client-side.
type RawJob = Omit<Job, 'status' | 'skills'> & {
  status: string
  skills?: (Partial<JobSkill> & { skillId?: string })[]
}

function normalizeJob(raw: RawJob): Job {
  const status = raw.status === 'OPEN' ? 'ACTIVE' : raw.status === 'ARCHIVED' ? 'CLOSED' : raw.status
  return {
    ...raw,
    status: status as Job['status'],
    skills: (raw.skills ?? []).map((s) => ({ ...s, id: s.id ?? s.skillId ?? '' })) as JobSkill[],
  }
}

function toJobPage(payload: unknown, params: JobListParams = {}): PaginatedResponse<Job> {
  const pageSize = params.pageSize ?? 10
  const page = params.page ?? 1
  const maybePage = payload as { data?: RawJob[]; total?: number; page?: number; pageSize?: number; totalPages?: number }
  if (maybePage && !Array.isArray(payload) && Array.isArray(maybePage.data)) {
    return {
      data: maybePage.data.map(normalizeJob),
      total: maybePage.total ?? maybePage.data.length,
      page: maybePage.page ?? page,
      pageSize: maybePage.pageSize ?? pageSize,
      totalPages: maybePage.totalPages ?? 1,
    }
  }
  const search = params.search?.trim().toLowerCase()
  const all = (Array.isArray(payload) ? (payload as RawJob[]) : [])
    .map(normalizeJob)
    .filter((j) => !params.status || j.status === params.status)
    .filter((j) => !params.department || j.department === params.department)
    .filter((j) => !search || j.title.toLowerCase().includes(search))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
  const current = Math.min(page, totalPages)
  return {
    data: all.slice((current - 1) * pageSize, current * pageSize),
    total: all.length,
    page: current,
    pageSize,
    totalPages: all.length === 0 ? 0 : totalPages,
  }
}

export const jobApi = {
  create: (data: CreateJobRequest) => api.post<CommonResponse<Job>>('/job', data),
  getMyJobs: (params?: JobListParams) => api.get<CommonResponse<PaginatedResponse<Job>>>('/job/my-jobs', params as Record<string, unknown>),
  getMyJobsUnwrapped: async (params?: JobListParams) => {
    // Filtering and paging happen client-side, so don't send params to the backend
    const response = await api.get<CommonResponse<unknown>>('/job/my-jobs')
    return toJobPage(response.data, params)
  },
  getByIdForRecruiter: (id: string) => api.get<CommonResponse<Job>>(`/recruiter/jobs/${id}`),
  getByIdForRecruiterUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<Job>>(`/recruiter/jobs/${id}`)
    return response.data
  },
  updateForRecruiter: (id: string, data: Partial<CreateJobRequest>) =>
    api.put<CommonResponse<Job>>(`/recruiter/jobs/${id}`, data),
  deleteForRecruiter: (id: string) => api.delete<CommonResponse<void>>(`/recruiter/jobs/${id}`),
  updateJobSkills: (id: string, skills: JobSkillRequest[]) =>
    api.put<CommonResponse<Job>>(`/recruiter/jobs/${id}/skills`, skills),
  getAllForAdmin: (params?: JobListParams) => api.get<CommonResponse<PaginatedResponse<Job>>>('/admin/jobs', params as Record<string, unknown>),
  getAllForAdminUnwrapped: async (params?: JobListParams) => {
    const response = await api.get<CommonResponse<unknown>>('/admin/jobs')
    return toJobPage(response.data, params)
  },
  getByIdForAdmin: (id: string) => api.get<CommonResponse<Job>>(`/admin/jobs/${id}`),
  updateForAdmin: (id: string, data: Partial<CreateJobRequest>) =>
    api.put<CommonResponse<Job>>(`/admin/jobs/${id}`, data),
  deleteForAdmin: (id: string) => api.delete<CommonResponse<void>>(`/admin/jobs/${id}`),
  updateJobSkillsForAdmin: (id: string, skills: JobSkillRequest[]) =>
    api.put<CommonResponse<Job>>(`/admin/jobs/${id}/skills`, skills),
}

export const candidateApi = {
  uploadResume: (data: FormData) =>
    api.post<CommonResponse<CandidateResponse>>('/recruiter/candidates/upload', data),
  bulkUploadResumes: (data: FormData) =>
    api.post<CommonResponse<CandidateResponse[]>>('/recruiter/candidates/bulk-upload', data),
  getAll: (params?: CandidateListParams) => api.get<CommonResponse<PaginatedResponse<CandidateResponse>>>('/recruiter/candidates', params as Record<string, unknown>),
  getAllUnwrapped: async (params?: CandidateListParams) => {
    const response = await api.get<CommonResponse<PaginatedResponse<CandidateResponse>>>('/recruiter/candidates', params as Record<string, unknown>)
    return response.data
  },
  getById: (id: string) => api.get<CommonResponse<CandidateResponse>>(`/recruiter/candidates/${id}`),
  getByIdUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<CandidateResponse>>(`/recruiter/candidates/${id}`)
    return response.data
  },
  update: (id: string, data: { candidateName: string; candidateEmail: string; phoneNumber?: string; location?: string }) =>
    api.put<CommonResponse<CandidateResponse>>(`/recruiter/candidates/${id}`, data),
  delete: (id: string) => api.delete<CommonResponse<void>>(`/recruiter/candidates/${id}`),
  scoreJob: (candidateId: string, jobId: string) =>
    api.post<CommonResponse<void>>(`/recruiter/candidates/${candidateId}/score-job/${jobId}`, {}),
  generateRAGSummary: (candidateId: string, jobId: string) =>
    api.post<CommonResponse<void>>(`/recruiter/candidates/${candidateId}/rag-summary/${jobId}`, {}),
  rankCandidates: (jobId: string, candidateIds: string[]) =>
    api.post<CommonResponse<void>>(`/recruiter/candidates/jobs/${jobId}/rank-candidates`, candidateIds),
  getMatchScore: (candidateId: string, jobId: string) =>
    api.get<CommonResponse<MatchScore>>(`/recruiter/candidates/${candidateId}/match-score/${jobId}`),
  getRAGSummary: (candidateId: string, jobId: string) =>
    api.get<CommonResponse<RAGSummary>>(`/recruiter/candidates/${candidateId}/rag-summary/${jobId}`),
  getRanking: (jobId: string) =>
    api.get<CommonResponse<RankingResult>>(`/recruiter/candidates/jobs/${jobId}/ranking`),
  healthCheck: () => api.get<CommonResponse<unknown>>('/recruiter/candidates/ai-service/health'),

  // Backward compatibility - old endpoints that frontend pages expect
  getAllLegacy: (params?: CandidateListParams) => api.get<CommonResponse<PaginatedResponse<Candidate>>>('/recruiter/candidates', params as Record<string, unknown>),
  getAllLegacyUnwrapped: async (params?: CandidateListParams) => {
    const response = await api.get<CommonResponse<PaginatedResponse<Candidate>>>('/recruiter/candidates', params as Record<string, unknown>)
    return response.data
  },
  getByIdLegacy: (id: string) => api.get<CommonResponse<Candidate>>(`/recruiter/candidates/${id}`),
  getByIdLegacyUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<Candidate>>(`/recruiter/candidates/${id}`)
    return response.data
  },
  updateStatus: (id: string, status: CandidateStatus) =>
    api.patch<CommonResponse<Candidate>>(`/recruiter/candidates/${id}/status`, { status }),
  getAiAnalysis: (id: string) => api.get<CommonResponse<AIAnalysis>>(`/recruiter/candidates/${id}/ai-analysis`),
  // Resolves to null while the analysis is still being generated; rejects only on real errors (e.g. 404 candidate)
  getAiAnalysisUnwrapped: async (id: string): Promise<AIAnalysis | null> => {
    const response = await api.get<CommonResponse<AIAnalysis | null>>(`/recruiter/candidates/${id}/ai-analysis`)
    return response.data ?? null
  },
  shortlist: (id: string) => api.post<CommonResponse<void>>(`/recruiter/candidates/${id}/shortlist`, {}),
  reject: (id: string, reason?: string) =>
    api.post<CommonResponse<void>>(`/recruiter/candidates/${id}/reject`, { reason }),
  getNotes: (id: string) =>
    api.get<CommonResponse<CandidateNote[]>>(`/recruiter/candidates/${id}/notes`).then((res) => res.data),
  addNote: (id: string, note: string) =>
    api.post<CommonResponse<CandidateNote>>(`/recruiter/candidates/${id}/notes`, { note }).then((res) => res.data),
}

export const resumeApi = {
  // The backend reads name, email, phone and location out of the PDF itself.
  upload: (file: File, jobId: string) => {
    const formData = new FormData()
    formData.append('resumeFile', file)
    // The backend binds jobId with @RequestPart, which needs a JSON-typed part (a plain form field is octet-stream)
    formData.append('jobId', new Blob([JSON.stringify(jobId)], { type: 'application/json' }))
    return api.post<CommonResponse<CandidateResponse>>('/recruiter/candidates/upload', formData)
  },
  getById: (id: string) => api.get<CommonResponse<Resume>>(`/resumes/${id}`),
  getByIdUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<Resume>>(`/resumes/${id}`)
    return response.data
  },
  parse: (id: string) => api.post<CommonResponse<{ extractedText: string }>>(`/resumes/${id}/parse`, {}),
}

export type BatchStatus = 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED'
export type BatchTaskStatus = 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW' | 'DUPLICATE'
export type BatchTaskStage = 'EXTRACT' | 'PERSIST' | 'PROFILE' | 'INDEX' | 'SCORE' | 'SUMMARY' | 'DONE'

export interface Batch {
  id: string
  jobId: string
  status: BatchStatus
  totalFiles: number
  percentComplete: number
  counts: Record<BatchTaskStatus, number>
  createdAt: string
  completedAt: string | null
  elapsedSeconds: number | null
  resumesPerMinute: number | null
  medianSecondsPerResume: number | null
  p95SecondsPerResume: number | null
  estimatedSecondsRemaining: number | null
}

export interface BatchTask {
  id: string
  fileName: string
  status: BatchTaskStatus
  stage: BatchTaskStage
  attempts: number
  errorCode: string | null
  errorMessage: string | null
  needsReview: boolean
  warnings: string[]
  candidateId: string | null
  createdAt: string
  finishedAt: string | null
}

export const batchApi = {
  /** Answers as soon as the files are stored and queued, however many there are; poll `get` for progress. */
  create: (jobId: string, files: File[]) => {
    const formData = new FormData()
    formData.append('jobId', jobId)
    files.forEach((file) => formData.append('files', file))
    return api.post<CommonResponse<Batch>>('/recruiter/batches', formData).then((res) => res.data)
  },
  get: (batchId: string) => api.get<CommonResponse<Batch>>(`/recruiter/batches/${batchId}`).then((res) => res.data),
  tasks: (batchId: string, params?: { status?: BatchTaskStatus; page?: number; size?: number }) =>
    api
      .get<CommonResponse<{ items: BatchTask[]; totalPages: number; totalItems: number }>>(
        `/recruiter/batches/${batchId}/tasks`,
        { size: 200, ...params } as Record<string, unknown>
      )
      .then((res) => res.data),
  retryFailed: (batchId: string) =>
    api.post<CommonResponse<{ requeued: number }>>(`/recruiter/batches/${batchId}/retry`, {}).then((res) => res.data),
  retryTask: (batchId: string, taskId: string) =>
    api.post<CommonResponse<{ requeued: boolean }>>(`/recruiter/batches/${batchId}/tasks/${taskId}/retry`, {}).then((res) => res.data),
  forJob: (jobId: string) => api.get<CommonResponse<Batch[]>>('/recruiter/batches', { jobId }).then((res) => res.data),
}

export const assessmentApi = {
  getAll: (params?: { jobId?: string }) =>
    api.get<CommonResponse<Assessment[]>>('/assessments', params as Record<string, unknown>).then((res) => res.data),
  getById: (id: string) => api.get<CommonResponse<Assessment>>(`/assessments/${id}`).then((res) => res.data),
  create: (data: AssessmentInput) => api.post<CommonResponse<Assessment>>('/assessments', data).then((res) => res.data),
  update: (id: string, data: AssessmentInput) => api.put<CommonResponse<Assessment>>(`/assessments/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete<CommonResponse<void>>(`/assessments/${id}`),
  assign: (assessmentId: string, candidateId: string) =>
    api.post<CommonResponse<AssessmentAttempt>>(`/assessments/${assessmentId}/assign`, { candidateId }).then((res) => res.data),
  assignMany: (assessmentId: string, candidateIds: string[]) =>
    api.post<CommonResponse<BulkAssignResult>>(`/assessments/${assessmentId}/assign-many`, { candidateIds }).then((res) => res.data),
  getAttempts: (params?: { assessmentId?: string; candidateId?: string }) =>
    api.get<CommonResponse<AssessmentAttempt[]>>('/assessments/attempts', params as Record<string, unknown>).then((res) => res.data),
  getAttempt: (attemptId: string) =>
    api.get<CommonResponse<AssessmentAttempt>>(`/assessments/attempts/${attemptId}`).then((res) => res.data),
  gradeAnswer: (attemptId: string, answerId: string, score: number, feedback?: string) =>
    api.put<CommonResponse<AssessmentAttempt>>(`/assessments/attempts/${attemptId}/answers/${answerId}/grade`, { score, feedback }).then((res) => res.data),
}

/** Candidate-facing calls: no login, the secret token from the emailed link is the credential. */
export const publicAssessmentApi = {
  get: (token: string) => api.get<CommonResponse<PublicAssessment>>(`/public/assessments/${token}`).then((res) => res.data),
  /** Begins the assessment (needs acceptedTerms the first time) or the next round. */
  start: (token: string, acceptedTerms = false) =>
    api.post<CommonResponse<PublicAssessment>>(`/public/assessments/${token}/start`, { acceptedTerms }).then((res) => res.data),
  submit: (token: string, answers: Record<string, string>) =>
    api.post<CommonResponse<PublicAssessment>>(`/public/assessments/${token}/submit`, { answers }).then((res) => res.data),
}

export const interviewApi = {
  getAll: (params?: InterviewListParams) =>
    api.get<CommonResponse<PaginatedResponse<Interview>>>('/interviews', params as Record<string, unknown>).then((res) => res.data),
  getById: (id: string) => api.get<CommonResponse<Interview>>(`/interviews/${id}`).then((res) => res.data),
  schedule: (data: ScheduleInterviewRequest) => api.post<CommonResponse<Interview>>('/interviews', data).then((res) => res.data),
  update: (id: string, data: ScheduleInterviewRequest) => api.put<CommonResponse<Interview>>(`/interviews/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete<CommonResponse<void>>(`/interviews/${id}`),
  submitFeedback: (id: string, feedback: SubmitInterviewFeedbackRequest) =>
    api.post<CommonResponse<Interview>>(`/interviews/${id}/feedback`, feedback).then((res) => res.data),
  cancel: (id: string) => api.post<CommonResponse<Interview>>(`/interviews/${id}/cancel`, {}).then((res) => res.data),
}

export const analyticsApi = {
  getOverview: () => api.get<CommonResponse<AnalyticsOverview>>('/analytics/overview'),
  getFunnel: () => api.get<CommonResponse<FunnelData[]>>('/analytics/funnel'),
  getTimeToHire: () => api.get<CommonResponse<TimeToHireData>>('/analytics/time-to-hire'),
  getAiMatchDistribution: () => api.get<CommonResponse<AiMatchDistribution>>('/analytics/ai-match-distribution'),
  getJobsMetrics: () => api.get<CommonResponse<JobsMetrics>>('/analytics/jobs'),
}

export const userApi = {
  createRecruiter: (data: CreateRecruiterRequest) =>
    api.post<CommonResponse<User>>('/admin/recruiters', data),
  getRecruitersForAdmin: () => api.get<CommonResponse<User[]>>('/admin/recruiters'),
  getRecruiterByIdForAdmin: (id: string) => api.get<CommonResponse<User>>(`/admin/recruiters/${id}`),
  getCurrentUser: () => api.get<CommonResponse<User>>('/recruiter/me'),
  updateRecruiterForAdmin: (id: string, data: { userName?: string; email?: string; phoneNumber?: string; active?: boolean }) =>
    api.put<CommonResponse<User>>(`/admin/recruiters/${id}`, data),
  deleteRecruiterForAdmin: (id: string) => api.delete<CommonResponse<void>>(`/admin/recruiters/${id}`),
  updateMe: (data: { userName: string; email: string; phoneNumber?: string }) =>
    api.put<CommonResponse<UserResponse>>('/auth/me', data),
}

import type { User, Company, Job, Candidate, Resume, AIAnalysis, Assessment, AssessmentAttempt, AssessmentQuestion, BulkAssignResult, PublicAssessment, Interview, CandidateStatus, JobSkill, InterviewFeedback } from '@/types'
import type { PaginatedResponse } from '@/types'

interface CommonResponse<T> {
  code: number
  status: string
  data: T
  message: string
  timestamp: string
}

interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: {
    id: string
    userName: string
    email: string
    phoneNumber: string
    emailVerified: boolean
    phoneNumberVerified: boolean
    role: string
    companyId: string
    companyName: string
    active: boolean
    createdAt: string
    updatedAt: string
  }
}

interface UserResponse {
  id: string
  userName: string
  email: string
  phoneNumber: string
  emailVerified: boolean
  phoneNumberVerified: boolean
  role: string
  companyId: string
  active: boolean
  createdAt: string
  updatedAt: string
}

interface CompanyRegistrationRequest {
  companyName: string
  country: string
  state: string
  city: string
  industry?: string
  gstNumber: string
  logo?: string
  adminUserName: string
  adminEmail: string
  adminPhoneNumber: string
  password: string
}

interface CompanyRegistrationResponse {
  company: {
    id: string
    companyName: string
    country: string
    state: string
    city: string
    gstNumber: string
    companyVerified: boolean
    active: boolean
    createdAt: string
    updatedAt: string
  }
  admin: {
    id: string
    userName: string
    email: string
    phoneNumber: string
    emailVerified: boolean
    phoneNumberVerified: boolean
    role: string
    createdAt: string
    updatedAt: string
  }
}

interface CreateJobRequest {
  title: string
  department: string
  employmentType: Job['employmentType']
  workMode: Job['workMode']
  location: string
  experienceRequired: number
  educationRequired: string
  minimumSalary: number
  maximumSalary: number
  description: string
  applicationDeadline: string
  vacancies: number
  skills: Omit<JobSkill, 'id'>[]
}

interface JobListParams {
  page?: number
  pageSize?: number
  status?: Job['status']
  search?: string
  department?: string
}

interface CandidateListParams {
  page?: number
  pageSize?: number
  status?: CandidateStatus
  jobId?: string
  search?: string
}

interface InterviewListParams {
  page?: number
  pageSize?: number
  status?: Interview['status']
  candidateId?: string
  jobId?: string
}

interface CreateRecruiterRequest {
  userName: string
  email: string
  phoneNumber: string
  password: string
}

interface AssessmentInput {
  title: string
  type: Assessment['type']
  status?: Assessment['status']
  about?: string
  termsAndConditions?: string
  /** null detaches the assessment from any job */
  jobId?: string | null
  rounds: {
    title: string
    description?: string
    durationMinutes: number
    questions: {
      question: string
      type: AssessmentQuestion['type']
      options?: string[]
      correctAnswer?: string
      weight: number
    }[]
  }[]
}

interface CandidateNote {
  id: string
  note: string
  authorName: string
  createdAt: string
}

interface SubmitInterviewFeedbackRequest {
  rating: number
  strengths: string[]
  weaknesses: string[]
  recommendation: InterviewFeedback['recommendation']
  notes: string
}

interface ScheduleInterviewRequest {
  candidateId: string
  jobId: string
  type: Interview['type']
  scheduledAt: string
  duration: number
  interviewers: string[]
  meetingLink?: string
}

interface AnalyticsOverview {
  activeJobs: number
  totalCandidates: number
  shortlisted: number
  interviews: number
  offers: number
}

interface FunnelData {
  stage: string
  count: number
  conversionRate: number
}

interface TimeToHireData {
  average: number
  median: number
  byJob: { jobTitle: string; days: number }[]
}

interface AiMatchDistribution {
  ranges: { range: string; count: number }[]
}

interface JobsMetrics {
  total: number
  active: number
  draft: number
  closed: number
  avgApplicants: number
  avgTimeToFill: number
  offersExtended: number
  hired: number
  byDepartment?: Record<string, number>
}

interface CandidateResponse {
  id: string
  candidateName: string
  candidateEmail: string
  phoneNumber: string
  location?: string
  jobId: string
  resumeId: string
  resumeFileName?: string
  resumeFileUrl?: string
  createdAt: string
  updatedAt: string
  status?: CandidateStatus
  appliedAt?: string
  jobTitle?: string
  experience?: number
  skills?: string[]
}

interface JobSkillRequest {
  skillId: string
  weight: number
  required: boolean
}

interface MatchScore {
  candidateId: string
  jobId: string
  overallScore: number
  skillMatchScore: number
  experienceMatchScore: number
  educationMatchScore: number
  semanticMatchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  skillCoverage: number
  evidenceChunks: string[]
  metadata: Record<string, unknown>
  createdAt: string
}

interface EvidenceChunk {
  chunkId: string
  text: string
  section: string
  relevanceScore: number
  sourcePdf: string
}

interface RAGSummary {
  candidateId: string
  jobId: string
  strengths: string[]
  matchedSkills: string[]
  missingSkills: string[]
  relevantExperience: string[]
  evidence: EvidenceChunk[]
  summaryText: string
  confidenceScore: number
  generatedAt: string
  modelUsed: string
  promptVersion: string
}

interface RankedCandidate {
  candidateId: string
  jobId: string
  rank: number
  overallScore: number
  matchScore: MatchScore
  ragSummary: RAGSummary | null
}

interface RankingResult {
  jobId: string
  candidates: RankedCandidate[]
  totalCandidates: number
  rankedAt: string
  scoringVersion: string
}