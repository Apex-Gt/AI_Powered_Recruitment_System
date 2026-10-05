export type Role = 'ADMIN' | 'RECRUITER' | 'PLATFORM_ADMIN'

export interface User {
  id: string
  userName: string
  email: string
  phoneNumber: string
  role: Role
  companyId: string
  emailVerified: boolean
  phoneNumberVerified: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  companyName: string
  country: string
  state: string
  city: string
  industry?: string
  gstNumber: string
  companyVerified: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface JobSkill {
  id: string
  skillName: string
  type: 'REQUIRED' | 'PREFERRED'
  weight: number
}

export interface Job {
  id: string
  title: string
  department: string
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP'
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE'
  location: string
  experienceRequired: number
  educationRequired: string
  minimumSalary: number
  maximumSalary: number
  description: string
  applicationDeadline: string
  vacancies: number
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  companyId: string
  createdBy: string
  createdAt: string
  updatedAt: string
  skills: JobSkill[]
  _count?: {
    candidates: number
    shortlisted: number
  }
}

export interface Candidate {
  id: string
  candidateName: string
  candidateEmail: string
  phoneNumber: string
  status: CandidateStatus
  appliedAt: string
  jobId: string
  jobTitle: string
  aiMatchScore?: number
  experience: number
  skills: string[]
  resumeId?: string
}

export type CandidateStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'

export interface Resume {
  id: string
  fileName: string
  fileUrl: string
  extractedText: string
  uploadedAt: string
  candidateId: string
}

export interface AIAnalysis {
  overallScore: number
  breakdown: {
    skills: number
    experience: number
    education: number
    jobRelevance: number
  }
  matchingSkills: string[]
  relevantExperience: string[]
  potentialGaps: string[]
  summary: string
  generatedAt: string
}

export interface Assessment {
  id: string
  title: string
  type: 'CODING' | 'TECHNICAL' | 'BEHAVIORAL' | 'CUSTOM'
  duration: number
  questions: AssessmentQuestion[]
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED'
  createdAt: string
}

export interface AssessmentQuestion {
  id: string
  question: string
  type: 'MULTIPLE_CHOICE' | 'CODE' | 'ESSAY' | 'VIDEO'
  options?: string[]
  correctAnswer?: string
  weight: number
}

export interface Interview {
  id: string
  candidateId: string
  candidateName: string
  jobId: string
  jobTitle: string
  type: 'PHONE' | 'VIDEO' | 'ONSITE' | 'TECHNICAL'
  scheduledAt: string
  duration: number
  interviewers: string[]
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  feedback?: InterviewFeedback
  meetingLink?: string
}

export interface InterviewFeedback {
  rating: number
  strengths: string[]
  weaknesses: string[]
  recommendation: 'HIRE' | 'MAYBE' | 'NO_HIRE'
  notes: string
  submittedAt: string
  submittedBy: string
}

export interface PipelineColumn {
  id: CandidateStatus
  title: string
  count: number
}

export interface MetricCard {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
  }[]
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
  roles?: Role[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  message: string
  code: string
  details?: Record<string, string[]>
}