import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/dashboard/Dashboard'
import { Jobs } from '@/pages/jobs/Jobs'
import { CreateJob } from '@/pages/jobs/CreateJob'
import { JobDetail } from '@/pages/jobs/JobDetail'
import { Candidates } from '@/pages/candidates/Candidates'
import { CandidateProfile } from '@/pages/candidates/CandidateProfile'
import { Pipeline } from '@/pages/pipeline/Pipeline'
import { Assessments } from '@/pages/assessments/Assessments'
import { Interviews } from '@/pages/interviews/Interviews'
import { Analytics } from '@/pages/analytics/Analytics'
import { Team } from '@/pages/team/Team'
import { Company } from '@/pages/company/Company'
import { Settings } from '@/pages/settings/Settings'
import { Login } from '@/pages/auth/Login'
import { Register } from '@/pages/auth/Register'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/create" element={<CreateJob />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="candidates/:id" element={<CandidateProfile />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="interviews" element={<Interviews />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="team" element={<Team />} />
        <Route path="company" element={<Company />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App