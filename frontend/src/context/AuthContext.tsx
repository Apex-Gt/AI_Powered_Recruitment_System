import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '@/utils/api'
import type { User, Role } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (roles: Role[]) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = async () => {
    try {
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
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
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
    await authApi.logout()
    setUser(null)
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
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        refreshUser,
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