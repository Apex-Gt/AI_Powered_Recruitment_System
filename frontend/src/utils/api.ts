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

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
      body: JSON.stringify(data),
    })
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
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

// API endpoints
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
  create: (data: CreateJobRequest) => api.post<Job>('/job', data),
  getMyJobs: (params?: JobListParams) => api.get<PaginatedResponse<Job>>('/job/my-jobs', params as Record<string, unknown>),
  getByIdForRecruiter: (id: string) => api.get<CommonResponse<Job>>(`/recruiter/jobs/${id}`),
  updateForRecruiter: (id: string, data: Partial<CreateJobRequest>) =>
    api.put<CommonResponse<Job>>(`/recruiter/jobs/${id}`, data),
  getAllForAdmin: (params?: JobListParams) => api.get<PaginatedResponse<Job>>('/admin/jobs', params as Record<string, unknown>),
  getByIdForAdmin: (id: string) => api.get<CommonResponse<Job>>(`/admin/jobs/${id}`),
  updateForAdmin: (id: string, data: Partial<CreateJobRequest>) =>
    api.put<CommonResponse<Job>>(`/admin/jobs/${id}`, data),
}

// TODO: Backend not implemented - Candidate Management
export const candidateApi = {
  getAll: (params?: CandidateListParams) => api.get<PaginatedResponse<Candidate>>('/candidates', params as Record<string, unknown>),
  getById: (id: string) => api.get<Candidate>(`/candidates/${id}`),
  updateStatus: (id: string, status: CandidateStatus) =>
    api.patch<Candidate>(`/candidates/${id}/status`, { status }),
  getAiAnalysis: (id: string) => api.get<AIAnalysis>(`/candidates/${id}/ai-analysis`),
  shortlist: (id: string) => api.post(`/candidates/${id}/shortlist`, {}),
  reject: (id: string, reason?: string) =>
    api.post(`/candidates/${id}/reject`, { reason }),
  addNote: (id: string, note: string) =>
    api.post(`/candidates/${id}/notes`, { note }),
}

// TODO: Backend not implemented - Resume Management
export const resumeApi = {
  upload: (file: File, candidateId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('candidateId', candidateId)
    return fetch(`${API_BASE}/resumes/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }).then((res) => res.json())
  },
  getById: (id: string) => api.get<Resume>(`/resumes/${id}`),
  parse: (id: string) => api.post<{ extractedText: string }>(`/resumes/${id}/parse`, {}),
}

// TODO: Backend not implemented - Assessments
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

// TODO: Backend not implemented - Interviews
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

// TODO: Backend not implemented - Analytics
export const analyticsApi = {
  getOverview: () => api.get<AnalyticsOverview>('/analytics/overview'),
  getFunnel: () => api.get<FunnelData[]>('/analytics/funnel'),
  getTimeToHire: () => api.get<TimeToHireData>('/analytics/time-to-hire'),
  getAiMatchDistribution: () => api.get<AiMatchDistribution>('/analytics/ai-match-distribution'),
  getJobsMetrics: () => api.get<JobsMetrics>('/analytics/jobs'),
}

export const userApi = {
  createRecruiter: (data: CreateRecruiterRequest) =>
    api.post<User>('/admin/recruiters', data),
  getRecruitersForAdmin: () => api.get<CommonResponse<User[]>>('/admin/recruiters'),
  getRecruiterByIdForAdmin: (id: string) => api.get<CommonResponse<User>>(`/admin/recruiters/${id}`),
  getCurrentUser: () => api.get<CommonResponse<User>>('/recruiter/me'),
  updateRecruiterForAdmin: (id: string, data: { userName?: string; email?: string; phoneNumber?: string; active?: boolean }) =>
    api.put<CommonResponse<User>>(`/admin/recruiters/${id}`, data),
  updateMe: (data: { userName: string; email: string; phoneNumber?: string }) =>
    api.put<CommonResponse<UserResponse>>('/auth/me', data),
  // TODO: Backend not implemented - DELETE /admin/recruiters/{id}
  // delete: (id: string) => api.delete(`/admin/recruiters/${id}`),
}

// Type imports for API
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