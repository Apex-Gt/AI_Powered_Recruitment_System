const API_BASE = '/api'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const isFormData = options.body instanceof FormData
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    } as Record<string, string>

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
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
}

export const api = new ApiClient()

export const authApi = {
  login: (email: string, password: string) =>
    api.post<CommonResponse<LoginResponse>>('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout', {}),
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

export const jobApi = {
  create: (data: CreateJobRequest) => api.post<CommonResponse<Job>>('/job', data),
  getMyJobs: (params?: JobListParams) => api.get<CommonResponse<PaginatedResponse<Job>>>('/job/my-jobs', params as Record<string, unknown>),
  getMyJobsUnwrapped: async (params?: JobListParams) => {
    const response = await api.get<CommonResponse<PaginatedResponse<Job>>>('/job/my-jobs', params as Record<string, unknown>)
    return response.data
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
    const response = await api.get<CommonResponse<PaginatedResponse<Job>>>('/admin/jobs', params as Record<string, unknown>)
    return response.data
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
  getAllLegacy: (params?: CandidateListParams) => api.get<CommonResponse<PaginatedResponse<Candidate>>>('/candidates', params as Record<string, unknown>),
  getAllLegacyUnwrapped: async (params?: CandidateListParams) => {
    const response = await api.get<CommonResponse<PaginatedResponse<Candidate>>>('/candidates', params as Record<string, unknown>)
    return response.data
  },
  getByIdLegacy: (id: string) => api.get<CommonResponse<Candidate>>(`/candidates/${id}`),
  getByIdLegacyUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<Candidate>>(`/candidates/${id}`)
    return response.data
  },
  updateStatus: (id: string, status: CandidateStatus) =>
    api.patch<CommonResponse<Candidate>>(`/candidates/${id}/status`, { status }),
  getAiAnalysis: (id: string) => api.get<CommonResponse<AIAnalysis>>(`/candidates/${id}/ai-analysis`),
  getAiAnalysisUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<AIAnalysis>>(`/candidates/${id}/ai-analysis`)
    return response.data
  },
  shortlist: (id: string) => api.post<CommonResponse<void>>(`/candidates/${id}/shortlist`, {}),
  reject: (id: string, reason?: string) =>
    api.post<CommonResponse<void>>(`/candidates/${id}/reject`, { reason }),
  addNote: (id: string, note: string) =>
    api.post<CommonResponse<void>>(`/candidates/${id}/notes`, { note }),
}

export const resumeApi = {
  upload: (file: File, candidateName: string, candidateEmail: string, jobId: string, phoneNumber?: string, location?: string) => {
    const formData = new FormData()
    formData.append('resumeFile', file)
    formData.append('candidateName', candidateName)
    formData.append('candidateEmail', candidateEmail)
    formData.append('jobId', jobId)
    if (phoneNumber) formData.append('phoneNumber', phoneNumber)
    if (location) formData.append('location', location)
    return api.post<CommonResponse<CandidateResponse>>('/recruiter/candidates/upload', formData)
  },
  getById: (id: string) => api.get<CommonResponse<Resume>>(`/resumes/${id}`),
  getByIdUnwrapped: async (id: string) => {
    const response = await api.get<CommonResponse<Resume>>(`/resumes/${id}`)
    return response.data
  },
  parse: (id: string) => api.post<CommonResponse<{ extractedText: string }>>(`/resumes/${id}/parse`, {}),
}

export const assessmentApi = {
  getAll: () => api.get<Assessment[]>('/assessments'),
  getById: (id: string) => api.get<Assessment>(`/assessments/${id}`),
  create: (data: Partial<Assessment>) => api.post<Assessment>('/assessments', data),
  update: (id: string, data: Partial<Assessment>) => api.put<Assessment>(`/assessments/${id}`, data),
  delete: (id: string) => api.delete(`/assessments/${id}`),
  assign: (assessmentId: string, candidateId: string) =>
    api.post(`/assessments/${assessmentId}/assign`, { candidateId }),
  submit: (assessmentId: string, candidateId: string, answers: Record<string, string>) =>
    api.post(`/assessments/${assessmentId}/submit`, { candidateId, answers }),
}

export const interviewApi = {
  getAll: (params?: InterviewListParams) => api.get<PaginatedResponse<Interview>>('/interviews', params as Record<string, unknown>),
  getById: (id: string) => api.get<Interview>(`/interviews/${id}`),
  schedule: (data: ScheduleInterviewRequest) => api.post<Interview>('/interviews', data),
  update: (id: string, data: Partial<Interview>) => api.put<Interview>(`/interviews/${id}`, data),
  delete: (id: string) => api.delete(`/interviews/${id}`),
  submitFeedback: (id: string, feedback: InterviewFeedback) =>
    api.post(`/interviews/${id}/feedback`, feedback),
  cancel: (id: string) => api.post(`/interviews/${id}/cancel`, {}),
}

export const analyticsApi = {
  getOverview: () => api.get<AnalyticsOverview>('/analytics/overview'),
  getFunnel: () => api.get<FunnelData[]>('/analytics/funnel'),
  getTimeToHire: () => api.get<TimeToHireData>('/analytics/time-to-hire'),
  getAiMatchDistribution: () => api.get<AiMatchDistribution>('/analytics/ai-match-distribution'),
  getJobsMetrics: () => api.get<JobsMetrics>('/analytics/jobs'),
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

import type { User, Company, Job, Candidate, Resume, AIAnalysis, Assessment, Interview, CandidateStatus, JobSkill, InterviewFeedback } from '@/types'
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