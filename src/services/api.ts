// Cliente HTTP mínimo em torno do fetch, centralizando a URL base,
// o cabeçalho de autenticação e o tratamento de erros da API.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const TOKEN_KEY = 'cantata_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Erro de API com a mensagem já pronta para exibir ao usuário. */
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Tente novamente.', 0)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(data.error ?? 'Ocorreu um erro inesperado.', res.status, data.code)
  }

  return data as T
}

// ---- Endpoints de autenticação --------------------------------------------

export interface AuthUser {
  id: number
  name: string | null
  email: string
  emailVerified: boolean
}

export const authApi = {
  register: (payload: { name?: string; email: string; password: string }) =>
    request<{ message: string }>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: payload }),

  verifyEmail: (token: string) =>
    request<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  resendVerification: (email: string) =>
    request<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email } }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (payload: { token: string; password: string }) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: payload }),

  me: () => request<{ user: AuthUser }>('/me', { auth: true }),
}
