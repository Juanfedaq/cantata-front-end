// Cliente HTTP mínimo em torno do fetch, centralizando a URL base,
// o cabeçalho de autenticação e o tratamento de erros da API.
import { safeStorage } from '@/utils/safeStorage'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const TOKEN_KEY = 'cantata_token'

export function getToken(): string | null {
  return safeStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  safeStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  safeStorage.removeItem(TOKEN_KEY)
}

/** URL pública de um preview/capa salvo pelo backend (ex.: "covers/abc.png"). */
export function fileUrl(path: string | null | undefined): string | null {
  return path ? `${BASE_URL}/files/${path}` : null
}

// Chamado quando uma requisição autenticada recebe 401 (sessão inválida
// ou expirada). O store de auth registra o logout aqui — evita import
// circular entre api.ts e o store.
let onUnauthorized: (() => void) | null = null
export function setOnUnauthorized(handler: () => void): void {
  onUnauthorized = handler
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

  // FormData (upload de arquivos) vai como multipart — o browser define o
  // Content-Type com o boundary; JSON é serializado manualmente.
  const isForm = body instanceof FormData
  const headers: Record<string, string> = {}
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Tente novamente.', 0)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Sessão inválida/expirada numa chamada autenticada: derruba a sessão
    // local para a UI não ficar presa num estado "logado" que sempre falha.
    if (res.status === 401 && auth) {
      onUnauthorized?.()
    }
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
  isAdmin?: boolean
  isArtist?: boolean
  bio?: string | null
  avatarPath?: string | null
  stripeOnboardingComplete?: boolean
}

export const authApi = {
  register: (payload: { name?: string; email: string; password: string }) =>
    request<{ message: string }>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: payload }),

  // `credential` é o ID token que o Google Identity Services devolve no
  // frontend — o backend confere a assinatura e resolve/cria a conta.
  googleLogin: (credential: string) =>
    request<{ token: string; user: AuthUser }>('/auth/google', {
      method: 'POST',
      body: { credential },
    }),

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

// ---- Tipos do domínio -------------------------------------------------------

export interface Category {
  id: number
  slug: string
  name: string
}

export type SubcategoryType = 'instrumento' | 'genero' | 'dificuldade'

export interface Subcategory {
  id: number
  type: SubcategoryType
  name: string
}

// Referência de categoria usada nas tags das obras (pacotes).
export interface CategoryRef {
  id?: number
  slug: string
  name: string
}

// Um arquivo completo (privado) de uma categoria do pacote — o que o
// comprador baixa. Várias por categoria (2026-07-16).
export interface ContentFile {
  id: number
  fileName: string | null
  fileSize?: number | null
}

// Item de um pacote: uma categoria preenchida da obra, com a própria
// prévia pública e a lista de arquivos completos.
export interface ContentItem {
  id: number
  category: CategoryRef
  previewPath: string
  files: ContentFile[]
}

export interface CatalogItem {
  id: number
  title: string
  priceCents: number
  coverPath: string | null
  publishedAt: string | null
  categories: CategoryRef[]
  artist: { id: number; name: string | null }
}

export interface CatalogDetail {
  id: number
  title: string
  description: string | null
  priceCents: number
  coverPath: string | null
  publishedAt: string | null
  items: ContentItem[]
  categories: CategoryRef[]
  artist: { id: number; name: string | null; bio: string | null }
  subcategories: Subcategory[]
  purchasable: boolean
}

export type ContentStatus = 'rascunho' | 'em_revisao' | 'aprovado' | 'reprovado'

export interface MyContent {
  id: number
  title: string
  description: string | null
  priceCents: number
  status: ContentStatus
  /** Oculta das vitrines públicas (compradores mantêm acesso). */
  hidden: boolean
  rejectionReason: string | null
  coverPath: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** Compras pagas desta obra. */
  salesCount: number
  /** Líquido acumulado do artista (centavos, valores congelados na venda). */
  salesNetCents: number
  items: ContentItem[]
  categories: CategoryRef[]
}

export interface ArtistSummary {
  id: number
  name: string | null
  bio: string | null
  avatarPath: string | null
  publishedCount: number
}

export interface Purchase {
  id: number
  amountCents: number
  purchasedAt: string
  // 'pendente' = aguardando confirmação (Pix/boleto podem levar minutos);
  // download só libera com 'pago' (2026-07-20, suporte a Pix).
  status: 'pago' | 'pendente'
  content: {
    id: number
    title: string
    coverPath: string | null
    items: { id: number; category: CategoryRef; files: ContentFile[] }[]
    artist: { id: number; name: string | null }
  }
}

// ---- Catálogo / categorias / artistas (públicos) ------------------------------

export const catalogApi = {
  categories: () =>
    request<{ categories: Category[]; subcategories: Subcategory[] }>('/categories'),

  list: (params: {
    page?: number
    perPage?: number
    category?: string
    subcategories?: number[]
    q?: string
  } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.perPage) query.set('perPage', String(params.perPage))
    if (params.category) query.set('category', params.category)
    if (params.subcategories?.length) query.set('subcategories', params.subcategories.join(','))
    if (params.q) query.set('q', params.q)
    const qs = query.toString()
    return request<{
      items: CatalogItem[]
      page: number
      perPage: number
      total: number
      totalPages: number
    }>(`/catalog${qs ? `?${qs}` : ''}`)
  },

  detail: (id: number | string) => request<{ content: CatalogDetail }>(`/catalog/${id}`),
}

export const artistsApi = {
  // order 'recentes' = últimos cadastrados (home), 'nome' = alfabética;
  // padrão do backend: mais publicados. q busca em nome/bio; categoria =
  // slug (só artistas com obra aprovada naquela categoria).
  list: (params: { order?: 'recentes' | 'nome'; limit?: number; q?: string; categoria?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.order) query.set('order', params.order)
    if (params.limit) query.set('limit', String(params.limit))
    if (params.q) query.set('q', params.q)
    if (params.categoria) query.set('categoria', params.categoria)
    const qs = query.toString()
    return request<{ artists: ArtistSummary[] }>(`/artists${qs ? `?${qs}` : ''}`)
  },

  profile: (id: number | string) =>
    request<{
      artist: { id: number; name: string | null; bio: string | null; avatarPath: string | null }
      contents: Omit<CatalogItem, 'artist'>[]
    }>(`/artists/${id}`),

  // Foto de perfil do artista (campo multipart 'avatar').
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.set('avatar', file)
    return request<{ avatarPath: string }>('/artists/avatar', {
      method: 'PUT',
      body: form,
      auth: true,
    })
  },

  removeAvatar: () =>
    request<{ message: string }>('/artists/avatar', { method: 'DELETE', auth: true }),

  upgrade: (bio?: string) =>
    request<{ message: string }>('/artists/upgrade', { method: 'POST', body: { bio }, auth: true }),

  updateProfile: (bio: string) =>
    request<{ message: string }>('/artists/profile', { method: 'PUT', body: { bio }, auth: true }),

  stripeOnboarding: () =>
    request<{ url: string }>('/artists/stripe/onboarding', { method: 'POST', auth: true }),

  stripeStatus: () =>
    request<{ onboardingComplete: boolean; hasAccount: boolean }>('/artists/stripe/status', {
      auth: true,
    }),

  // ---- Contrato do artista (aceite obrigatório antes de publicar) ----

  contract: () => request<ArtistContract>('/artists/contract', { auth: true }),

  acceptContract: (version: string) =>
    request<{ message: string; version: string }>('/artists/contract/accept', {
      method: 'POST',
      body: { version },
      auth: true,
    }),

  // Simulação de repasse (transparência de preço): mesma função do checkout.
  simulateFees: (priceCents: number) =>
    request<FeeSimulation>(`/artists/fees/simulate?priceCents=${priceCents}`, { auth: true }),
}

export interface ArtistContract {
  version: string
  markdown: string
  acceptedVersion: string | null
  acceptedAt: string | null
  upToDate: boolean
}

export interface FeeSimulation {
  valorBrutoCents: number
  taxaProcessamentoCents: number
  comissaoPlataformaCents: number
  valorLiquidoArtistaCents: number
  percentAplicado: number
  pisoAplicado: boolean
  tipo: 'venda' | 'gorjeta'
  config: {
    standardPercent: number
    minFeeCents: number
    gatewayPercent: number
    gatewayFixedCents: number
  }
}

// ---- Conteúdos do artista -------------------------------------------------------

export const contentsApi = {
  mine: () => request<{ contents: MyContent[] }>('/contents/mine', { auth: true }),

  create: (form: FormData) =>
    request<{ message: string; contentId: number }>('/contents', {
      method: 'POST',
      body: form,
      auth: true,
    }),

  update: (id: number, form: FormData) =>
    request<{ message: string }>(`/contents/${id}`, { method: 'PUT', body: form, auth: true }),

  remove: (id: number) =>
    request<{ message: string }>(`/contents/${id}`, { method: 'DELETE', auth: true }),

  // Oculta/reexibe a obra nas vitrines públicas (compradores mantêm acesso).
  setHidden: (id: number, hidden: boolean) =>
    request<{ message: string; hidden: boolean }>(`/contents/${id}/hidden`, {
      method: 'PUT',
      body: { hidden },
      auth: true,
    }),
}

// ---- Compras ----------------------------------------------------------------------

export const purchasesApi = {
  checkout: (contentId: number) =>
    request<{ url: string }>('/purchases/checkout', {
      method: 'POST',
      body: { contentId },
      auth: true,
    }),

  mine: () => request<{ purchases: Purchase[] }>('/purchases/mine', { auth: true }),

  /**
   * Download do arquivo completo (rota autenticada — precisa do header, então
   * baixa via fetch e dispara o save pelo blob).
   */
  // Baixa UM arquivo do pacote (fileId de content_files); pacote com um
  // único arquivo dispensa o fileId.
  async download(contentId: number, fileId?: number | null, suggestedName?: string | null): Promise<void> {
    const token = getToken()
    const qs = fileId ? `?file=${fileId}` : ''
    const res = await fetch(`${BASE_URL}/purchases/content/${contentId}/download${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(data.error ?? 'Erro ao baixar o arquivo.', res.status)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedName || 'conteudo'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

// ---- Admin ---------------------------------------------------------------------------

export interface AdminUser {
  id: number
  name: string | null
  email: string
  emailVerified: boolean
  isAdmin: boolean
  isArtist: boolean
  stripeOnboardingComplete: boolean
  createdAt: string
}

export interface AdminContent {
  id: number
  title: string
  description: string | null
  priceCents: number
  status: ContentStatus
  rejectionReason: string | null
  coverPath: string | null
  createdAt: string
  updatedAt: string
  items: ContentItem[]
  artist: { id: number; name: string | null; email: string }
}

export interface AdminPurchase {
  id: number
  amountCents: number
  platformFeeCents: number
  status: 'pendente' | 'pago' | 'reembolsado'
  createdAt: string
  content: { id: number; title: string }
  buyer: { id: number; name: string | null; email: string }
  artist: { id: number; name: string | null }
}

export const adminApi = {
  users: (params: { page?: number; q?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.q) query.set('q', params.q)
    const qs = query.toString()
    return request<{ users: AdminUser[]; page: number; perPage: number; total: number }>(
      `/admin/users${qs ? `?${qs}` : ''}`,
      { auth: true },
    )
  },

  contents: (status: ContentStatus = 'em_revisao') =>
    request<{ contents: AdminContent[] }>(`/admin/contents?status=${status}`, { auth: true }),

  approve: (id: number) =>
    request<{ message: string }>(`/admin/contents/${id}/approve`, { method: 'POST', auth: true }),

  reject: (id: number, reason: string) =>
    request<{ message: string }>(`/admin/contents/${id}/reject`, {
      method: 'POST',
      body: { reason },
      auth: true,
    }),

  purchases: (params: { page?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    const qs = query.toString()
    return request<{ purchases: AdminPurchase[]; page: number; perPage: number; total: number }>(
      `/admin/purchases${qs ? `?${qs}` : ''}`,
      { auth: true },
    )
  },

  createSubcategory: (type: SubcategoryType, name: string) =>
    request<{ subcategory: Subcategory }>('/categories/subcategories', {
      method: 'POST',
      body: { type, name },
      auth: true,
    }),

  updateSubcategory: (id: number, payload: { name?: string; active?: boolean }) =>
    request<{ message: string }>(`/categories/subcategories/${id}`, {
      method: 'PUT',
      body: payload,
      auth: true,
    }),
}

// ---- Utilidades -------------------------------------------------------------------

/** Formata centavos como moeda brasileira (ex.: 1990 → "R$ 19,90"). */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
