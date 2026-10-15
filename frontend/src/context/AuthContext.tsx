import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, ApiError, AUTH_EXPIRED_EVENT } from '@/utils/api'
import type { User, Role } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  /** true when the session could not be verified because the server was unreachable (not an expired session) */
  connectionError: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (roles: Role[]) => boolean
  refreshUser: () => Promise<void>
  retryAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)

  const fetchUser = async () => {
    try {
      setConnectionError(false)
      const response = await authApi.getMe()
      const userData = response.data
      setUser({
        id: userData.id,
        userName: userData.userName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        emailVerified: userData.emailVerified,
        phoneNumberVerified: userData.phoneNumberVerified,
        role: userData.role as Role,
        companyId: userData.companyId,
        active: userData.active ?? true,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        // Missing, invalid or expired token: the session is over
        setUser(null)
      } else if (error instanceof ApiError) {
        // Server answered with another error: don't treat as proof the session expired
        setConnectionError(true)
      } else {
        // fetch() rejected: network error / server down. Keep current user state.
        setConnectionError(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  // Any protected request rejected with 401 ends the session
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    const userData = response.data.user
    setUser({
      id: userData.id,
      userName: userData.userName,
      email: userData.email,
      phoneNumber: userData.phoneNumber,
      emailVerified: userData.emailVerified,
      phoneNumberVerified: userData.phoneNumberVerified,
      role: userData.role as Role,
      companyId: userData.companyId,
      active: userData.active ?? true,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    })
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }

  const hasRole = (roles: Role[]) => {
    return user ? roles.includes(user.role) : false
  }

  const refreshUser = async () => {
    await fetchUser()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        connectionError,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        refreshUser,
        retryAuth: async () => {
          setIsLoading(true)
          await fetchUser()
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}