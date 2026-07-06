import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  authApi,
  getToken,
  setToken,
  clearToken,
  setOnUnauthorized,
  type AuthUser,
} from '@/services/api'

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

  function persistUser(value: AuthUser) {
    user.value = value
    localStorage.setItem(USER_KEY, JSON.stringify(value))
  }

  async function login(email: string, password: string) {
    const { token: newToken, user: newUser } = await authApi.login({ email, password })
    token.value = newToken
    setToken(newToken)
    persistUser(newUser)
  }

  function logout() {
    token.value = null
    user.value = null
    clearToken()
    localStorage.removeItem(USER_KEY)
  }

  /**
   * Revalida a sessão persistida contra o servidor no boot do app.
   * Token expirado/revogado → 401 → logout (via handler global).
   * Falha de rede não derruba a sessão — só não atualiza o usuário.
   */
  async function bootstrap() {
    if (!token.value) return
    try {
      const { user: fresh } = await authApi.me()
      persistUser(fresh)
    } catch {
      // 401 já disparou o logout pelo handler global; falha de rede é ignorada.
    }
  }

  // Qualquer 401 em chamada autenticada derruba a sessão local.
  setOnUnauthorized(logout)

  return { token, user, isAuthenticated, login, logout, bootstrap }
})
