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
import { safeStorage } from '@/utils/safeStorage'

const USER_KEY = 'cantata_user'

function loadUser(): AuthUser | null {
  const raw = safeStorage.getItem(USER_KEY)
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
  const isAdmin = computed(() => !!user.value?.isAdmin)
  const isArtist = computed(() => !!user.value?.isArtist)

  function persistUser(value: AuthUser) {
    user.value = value
    safeStorage.setItem(USER_KEY, JSON.stringify(value))
  }

  // O login já devolve o usuário COMPLETO (papéis inclusive) desde
  // 2026-08-05 — antes vinham só 4 campos e era preciso chamar `/me` logo em
  // seguida só para descobrir se a pessoa era artista ou admin. Duas
  // requisições em toda entrada, uma delas puramente por causa do formato.
  async function login(email: string, password: string) {
    const { token: newToken, user: newUser } = await authApi.login({ email, password })
    token.value = newToken
    setToken(newToken)
    persistUser(newUser)
  }

  /** Login/cadastro via "Entrar com o Google" — mesmo formato de resposta do login comum. */
  async function loginWithGoogle(credential: string) {
    const { token: newToken, user: newUser } = await authApi.googleLogin(credential)
    token.value = newToken
    setToken(newToken)
    persistUser(newUser)
  }

  /** Rebusca o usuário no servidor (ex.: após upgrade para artista). */
  async function refresh() {
    if (!token.value) return
    const { user: fresh } = await authApi.me()
    persistUser(fresh)
  }

  function logout() {
    token.value = null
    user.value = null
    clearToken()
    safeStorage.removeItem(USER_KEY)
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

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isArtist,
    login,
    loginWithGoogle,
    logout,
    bootstrap,
    refresh,
    // Aplica um usuário que o servidor ACABOU de devolver (ex.: `PUT /me`),
    // evitando um `refresh()` que buscaria de novo o que já está em mãos.
    setUser: persistUser,
  }
})
