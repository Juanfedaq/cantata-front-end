import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, getToken, setToken, clearToken, type AuthUser } from '@/services/api'

const USER_KEY = 'cantata_user'

function loadUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getToken())
  const user = ref<AuthUser | null>(loadUser())

  const isAuthenticated = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const { token: newToken, user: newUser } = await authApi.login({ email, password })
    token.value = newToken
    user.value = newUser
    setToken(newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
  }

  function logout() {
    token.value = null
    user.value = null
    clearToken()
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isAuthenticated, login, logout }
})
