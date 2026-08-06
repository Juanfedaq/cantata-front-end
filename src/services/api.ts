// Cliente HTTP mínimo em torno do fetch, centralizando a URL base,
// o cabeçalho de autenticação e o tratamento de erros da API.
import type { CategoryKind } from "@/categoryKinds";
import { safeStorage } from "@/utils/safeStorage";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const TOKEN_KEY = "cantata_token";

export function getToken(): string | null {
  return safeStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  safeStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  safeStorage.removeItem(TOKEN_KEY);
}

/** URL pública de um preview/capa salvo pelo backend (ex.: "covers/abc.png"). */
export function fileUrl(path: string | null | undefined): string | null {
  return path ? `${BASE_URL}/files/${path}` : null;
}

// Chamado quando uma requisição autenticada recebe 401 (sessão inválida
// ou expirada). O store de auth registra o logout aqui — evita import
// circular entre api.ts e o store.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: () => void): void {
  onUnauthorized = handler;
}

/** Erro de API com a mensagem já pronta para exibir ao usuário. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false } = options;

  // FormData (upload de arquivos) vai como multipart — o browser define o
  // Content-Type com o boundary; JSON é serializado manualmente.
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.", 0);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Sessão inválida/expirada numa chamada autenticada: derruba a sessão
    // local para a UI não ficar presa num estado "logado" que sempre falha.
    //
    // ⚠️ REGRA PARA QUEM ESCREVE ROTA NOVA (achado B3-2 da revisão para o
    // beta): no backend, **401 é só para sessão inválida**. Ação recusada com
    // sessão válida — senha de confirmação errada, permissão insuficiente,
    // pré-condição não atendida — responde **403**. Um 401 nesses casos
    // desloga o usuário aqui, silenciosamente, em vez de mostrar o erro.
    if (res.status === 401 && auth) {
      onUnauthorized?.();
    }
    throw new ApiError(data.error ?? "Ocorreu um erro inesperado.", res.status, data.code);
  }

  return data as T;
}

// ---- Endpoints de autenticação --------------------------------------------

/**
 * Usuário da sessão. Formato ÚNICO: `/auth/login`, `/auth/google` e `/me`
 * devolvem exatamente estes campos (backend: `src/users.js`).
 *
 * Nenhum é opcional de propósito — antes o login mandava 4 campos e o `/me`
 * mandava 9, e os opcionais escondiam essa diferença no tipo. Se um dia
 * voltarem a divergir, o TypeScript reclama em vez de deixar `undefined`
 * circular.
 *
 * Fora daqui, por decisão de 2026-08-05: `emailVerified` (sempre `true` para
 * quem tem sessão) e `stripeOnboardingComplete` (a fonte é
 * `GET /artists/stripe/status`, que consulta o Stripe na hora).
 */
export interface AuthUser {
  /** Identificador PÚBLICO (UUID) — o inteiro do banco não sai da API. */
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  isArtist: boolean;
  bio: string | null;
  avatarPath: string | null;
}

export const authApi = {
  // `name` é obrigatório desde 2026-08-05 (o backend recusa sem ele).
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ message: string }>("/auth/register", { method: "POST", body: payload }),

  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>("/auth/login", { method: "POST", body: payload }),

  // `credential` é o ID token que o Google Identity Services devolve no
  // frontend — o backend confere a assinatura e resolve/cria a conta.
  googleLogin: (credential: string) =>
    request<{ token: string; user: AuthUser }>("/auth/google", {
      method: "POST",
      body: { credential },
    }),

  verifyEmail: (token: string) =>
    request<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST", body: { email } }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }),

  resetPassword: (payload: { token: string; password: string }) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: payload }),

  // Encerra TODAS as sessões da conta (incrementa o token_version no servidor).
  //
  // SEM TELA desde 2026-08-05 (QA): o botão "Sair de todos os dispositivos"
  // saiu do perfil porque a plataforma não mostra QUAIS aparelhos estão
  // conectados — a pessoa era convidada a encerrar uma lista que não podia
  // ver. A rota continua existindo e é o caminho do suporte para derrubar as
  // sessões de uma conta comprometida. Quem quiser fazer isso sozinho troca a
  // senha: o reset também incrementa o token_version e tem o mesmo efeito.
  logoutAll: () => request<{ message: string }>("/auth/logout-all", { method: "POST", auth: true }),

  // Exclusão de conta pelo titular (LGPD). Anonimiza os dados pessoais; o
  // histórico de compras é mantido por obrigação fiscal. Confirmação: senha,
  // ou o próprio e-mail quando a conta é só-Google (não tem senha).
  deleteAccount: (payload: { password?: string; confirmEmail?: string }) =>
    request<{ message: string }>("/auth/account", {
      method: "DELETE",
      body: payload,
      auth: true,
    }),

  me: () => request<{ user: AuthUser }>("/me", { auth: true }),

  // Troca o nome da própria conta. Vale para qualquer usuário — não é do
  // perfil de artista, é da pessoa. Devolve o usuário já atualizado, no mesmo
  // formato do login, para o store aplicar sem uma segunda chamada.
  updateName: (name: string) =>
    request<{ user: AuthUser }>("/me", { method: "PUT", body: { name }, auth: true }),
};

// ---- Tipos do domínio -------------------------------------------------------

/**
 * Categoria como vem de `GET /categories` (só as ativas) e do painel.
 *
 * `kind`, `icon` e `hue` chegaram em 2026-08-06, quando as categorias viraram
 * editáveis pelo admin. Antes essas três coisas eram decididas pelo SLUG,
 * dentro do código: um mapa de extensões no backend, um `v-if` por slug no
 * CategoryIcon e um mapa SCSS de matizes resolvido no build.
 */
export interface Category {
  id: number;
  slug: string;
  name: string;
  /** O que a categoria recebe. Decide extensões aceitas e a dica do formulário. */
  kind: CategoryKind;
  /** Chave do catálogo de ícones (CategoryIcon.vue). */
  icon: string;
  /** Matiz da tag, 0–360. Saturação e luminância continuam travadas no CSS. */
  hue: number;
  position: number;
  active: boolean;
}

/** Categoria no painel do admin: traz quantas obras dependem dela. */
export interface AdminCategory extends Category {
  /**
   * Itens de obra que apontam para esta categoria. Zero significa que excluir
   * apaga de verdade; acima de zero, excluir apenas recolhe (desativa).
   */
  contentCount: number;
}

export type SubcategoryType = "instrumento" | "genero" | "dificuldade";

export interface Subcategory {
  id: number;
  type: SubcategoryType;
  name: string;
}

// Musical (2026-07-22): classificação ACIMA das categorias — uma por data
// especial do ano (Natal, Dia das Mães, …), administrável pelo admin.
// Obra sem musical = "conteúdo padrão".
export interface Musical {
  id: number;
  name: string;
}

/** Tema no painel do admin: traz o estado e quantas obras dependem dele. */
export interface AdminMusical extends Musical {
  active: boolean;
  /**
   * Obras marcadas com este tema. Zero significa que excluir apaga de verdade;
   * acima de zero, excluir apenas recolhe.
   */
  contentCount: number;
}

// Referência de categoria usada nas tags das obras (pacotes).
/**
 * Categoria embutida numa obra (tag do card, ícone do pacote).
 *
 * Vem junto da obra, não da lista de `GET /categories` — por isso continua
 * aparecendo mesmo depois de o admin desativar a categoria: quem comprou tem
 * de seguir vendo do que a obra é feita.
 */
export interface CategoryRef {
  id?: number;
  slug: string;
  name: string;
  kind?: CategoryKind;
  icon: string;
  hue: number;
}

/**
 * Arquivo de uma categoria do pacote, como vem nas respostas PÚBLICAS
 * (catálogo). Sem `id`: desde 2026-08-05 o backend não expõe o id de
 * `content_files` em rota pública — ele é sequencial e entregaria o volume de
 * arquivos da plataforma. O site só usa a contagem e o nome aqui.
 */
export interface ContentFile {
  fileName: string | null;
  fileSize?: number | null;
}

/**
 * O mesmo arquivo nas respostas AUTENTICADAS — "Minhas Compras", "Meus
 * Conteúdos" e a fila de moderação. Aí o id vem: é ele que diz qual arquivo
 * baixar, e qual remover ao editar a obra.
 *
 * Continua sendo o id INTEIRO de `content_files`. Ele não aparece em URL de
 * navegador e só é entregue a quem já tem acesso àquela obra — comprador,
 * autor ou admin.
 */
export interface PurchasedFile extends ContentFile {
  id: number;
}

/** Item de pacote nas respostas autenticadas: arquivos com id. */
export interface OwnedContentItem {
  id: number;
  category: CategoryRef;
  previewPath: string;
  files: PurchasedFile[];
}

// Item de um pacote: uma categoria preenchida da obra, com a própria
// prévia pública e a lista de arquivos completos. Sem `id` pelo mesmo motivo
// do ContentFile — a categoria já identifica o item dentro da obra.
export interface ContentItem {
  category: CategoryRef;
  previewPath: string;
  files: ContentFile[];
}

export interface CatalogItem {
  /** Identificador PÚBLICO (UUID). Ver `cantata-back-end/src/publicId.js`. */
  id: string;
  title: string;
  priceCents: number;
  coverPath: string | null;
  publishedAt: string | null;
  musical: Musical | null;
  categories: CategoryRef[];
  artist: { id: string; name: string | null };
}

export interface CatalogDetail {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  coverPath: string | null;
  publishedAt: string | null;
  musical: Musical | null;
  items: ContentItem[];
  categories: CategoryRef[];
  artist: { id: string; name: string | null; bio: string | null };
  subcategories: Subcategory[];
  purchasable: boolean;
}

export type ContentStatus = "rascunho" | "em_revisao" | "aprovado" | "reprovado";

export interface MyContent {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  status: ContentStatus;
  /** Oculta das vitrines públicas (compradores mantêm acesso). */
  hidden: boolean;
  /**
   * Bloqueada pelo ADMIN (takedown). Diferente do `hidden`: o artista não
   * reverte, some também do link direto e ninguém mais compra. Quem já
   * comprou continua baixando.
   */
  adminBlocked: boolean;
  adminBlockedReason: string | null;
  rejectionReason: string | null;
  coverPath: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Compras pagas desta obra. */
  salesCount: number;
  /** Líquido acumulado do artista (centavos, valores congelados na venda). */
  salesNetCents: number;
  musical: Musical | null;
  items: OwnedContentItem[];
  categories: CategoryRef[];
}

export interface ArtistSummary {
  id: string;
  name: string | null;
  bio: string | null;
  avatarPath: string | null;
  publishedCount: number;
}

export interface Purchase {
  /** Id da COMPRA — interno, e não aparece em URL nenhuma. */
  id: number;
  amountCents: number;
  purchasedAt: string;
  // 'pendente' = aguardando confirmação (Pix/boleto podem levar minutos);
  // download só libera com 'pago' (2026-07-20, suporte a Pix).
  status: "pago" | "pendente";
  content: {
    /** Identificador PÚBLICO da obra (UUID). */
    id: string;
    title: string;
    coverPath: string | null;
    // Aqui os arquivos TÊM id: esta rota é autenticada e é o id que diz qual
    // arquivo baixar.
    items: OwnedContentItem[];
    artist: { id: string; name: string | null };
  };
}

// ---- Catálogo / categorias / artistas (públicos) ------------------------------

export const catalogApi = {
  categories: () =>
    request<{ categories: Category[]; subcategories: Subcategory[]; musicals: Musical[] }>(
      "/categories",
    ),

  list: (
    params: {
      page?: number;
      perPage?: number;
      // Um slug ou vários separados por vírgula (filtro acumulativo — OR).
      category?: string;
      subcategories?: number[];
      q?: string;
      // `musical` (id) = TEMA opcional da obra (Natal, Páscoa, …) — filtra
      // pela etiqueta escolhida (campo/coluna mantêm o nome interno "musical").
      musical?: number;
      // Ordenação (whitelist do backend); ausente = mais recentes.
      order?: "recentes" | "titulo-az" | "titulo-za" | "preco-desc" | "preco-asc";
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.perPage) query.set("perPage", String(params.perPage));
    if (params.category) query.set("category", params.category);
    if (params.subcategories?.length) query.set("subcategories", params.subcategories.join(","));
    if (params.q) query.set("q", params.q);
    if (params.musical) query.set("musical", String(params.musical));
    if (params.order) query.set("order", params.order);
    const qs = query.toString();
    return request<{
      items: CatalogItem[];
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    }>(`/catalog${qs ? `?${qs}` : ""}`);
  },

  detail: (id: number | string) => request<{ content: CatalogDetail }>(`/catalog/${id}`),
};

export const artistsApi = {
  // order 'recentes' = últimos cadastrados (home), 'nome' = alfabética;
  // padrão do backend: mais publicados. q busca em nome/bio; categoria =
  // slug (só artistas com obra aprovada naquela categoria).
  list: (
    params: { order?: "recentes" | "nome"; limit?: number; q?: string; categoria?: string } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.order) query.set("order", params.order);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.q) query.set("q", params.q);
    if (params.categoria) query.set("categoria", params.categoria);
    const qs = query.toString();
    return request<{ artists: ArtistSummary[] }>(`/artists${qs ? `?${qs}` : ""}`);
  },

  profile: (id: number | string) =>
    request<{
      artist: { id: string; name: string | null; bio: string | null; avatarPath: string | null };
      contents: Omit<CatalogItem, "artist">[];
    }>(`/artists/${id}`),

  // Foto de perfil do artista (campo multipart 'avatar').
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.set("avatar", file);
    return request<{ avatarPath: string }>("/artists/avatar", {
      method: "PUT",
      body: form,
      auth: true,
    });
  },

  removeAvatar: () =>
    request<{ message: string }>("/artists/avatar", { method: "DELETE", auth: true }),

  upgrade: (bio?: string) =>
    request<{ message: string }>("/artists/upgrade", { method: "POST", body: { bio }, auth: true }),

  updateProfile: (bio: string) =>
    request<{ message: string }>("/artists/profile", { method: "PUT", body: { bio }, auth: true }),

  stripeOnboarding: () =>
    request<{ url: string }>("/artists/stripe/onboarding", { method: "POST", auth: true }),

  stripeStatus: () =>
    request<{ onboardingComplete: boolean; hasAccount: boolean }>("/artists/stripe/status", {
      auth: true,
    }),

  // ---- Contrato do artista (aceite obrigatório antes de publicar) ----

  contract: () => request<ArtistContract>("/artists/contract", { auth: true }),

  acceptContract: (version: string) =>
    request<{ message: string; version: string }>("/artists/contract/accept", {
      method: "POST",
      body: { version },
      auth: true,
    }),

  // Simulação de repasse (transparência de preço): mesma função do checkout.
  simulateFees: (priceCents: number) =>
    request<FeeSimulation>(`/artists/fees/simulate?priceCents=${priceCents}`, { auth: true }),
};

export interface ArtistContract {
  version: string;
  markdown: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  upToDate: boolean;
}

export interface FeeSimulation {
  valorBrutoCents: number;
  taxaProcessamentoCents: number;
  comissaoPlataformaCents: number;
  valorLiquidoArtistaCents: number;
  percentAplicado: number;
  pisoAplicado: boolean;
  tipo: "venda" | "gorjeta";
  config: {
    standardPercent: number;
    minFeeCents: number;
    gatewayPercent: number;
    gatewayFixedCents: number;
    /** Menor preço publicável com as taxas vigentes (o back é a fonte). */
    minPriceCents: number;
  };
}

// ---- Conteúdos do artista -------------------------------------------------------

export const contentsApi = {
  mine: () => request<{ contents: MyContent[] }>("/contents/mine", { auth: true }),

  create: (form: FormData) =>
    request<{ message: string; contentId: number }>("/contents", {
      method: "POST",
      body: form,
      auth: true,
    }),

  update: (id: string, form: FormData) =>
    request<{ message: string }>(`/contents/${id}`, { method: "PUT", body: form, auth: true }),

  remove: (id: string) =>
    request<{ message: string }>(`/contents/${id}`, { method: "DELETE", auth: true }),

  // Oculta/reexibe a obra nas vitrines públicas (compradores mantêm acesso).
  setHidden: (id: string, hidden: boolean) =>
    request<{ message: string; hidden: boolean }>(`/contents/${id}/hidden`, {
      method: "PUT",
      body: { hidden },
      auth: true,
    }),
};

// ---- Compras ----------------------------------------------------------------------

export const purchasesApi = {
  checkout: (contentId: string) =>
    request<{ url: string }>("/purchases/checkout", {
      method: "POST",
      body: { contentId },
      auth: true,
    }),

  mine: () => request<{ purchases: Purchase[] }>("/purchases/mine", { auth: true }),

  /**
   * Download do arquivo completo (rota autenticada — precisa do header, então
   * baixa via fetch e dispara o save pelo blob).
   */
  // Baixa UM arquivo do pacote (fileId de content_files); pacote com um
  // único arquivo dispensa o fileId.
  async download(
    contentId: string,
    fileId?: number | null,
    suggestedName?: string | null,
  ): Promise<void> {
    const token = getToken();
    const qs = fileId ? `?file=${fileId}` : "";
    const res = await fetch(`${BASE_URL}/purchases/content/${contentId}/download${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error ?? "Não conseguimos entregar o arquivo agora. Tente de novo em instantes.", res.status);
    }
    saveBlob(await res.blob(), suggestedName || "conteudo");
  },

  /**
   * Baixa a obra INTEIRA num ZIP (2026-08-05). O nome do arquivo vem do
   * `Content-Disposition` do servidor, que já monta o nome a partir do
   * título da obra.
   */
  async downloadAll(contentId: string): Promise<void> {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/purchases/content/${contentId}/download-all`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error ?? "Não conseguimos preparar seu download agora. Tente de novo em instantes.", res.status);
    }
    saveBlob(await res.blob(), nomeDoHeader(res) ?? "conteudo.zip");
  },
};

/** Dispara o "salvar como" do navegador a partir de um blob já baixado. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lê o nome sugerido no `Content-Disposition`, se o servidor mandou um. */
function nomeDoHeader(res: Response): string | null {
  const header = res.headers.get("Content-Disposition");
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

// ---- Admin ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  stripeOnboardingComplete: boolean;
  /** Obras enviadas (sem rascunhos). Sempre 0 para quem não é artista. */
  postedCount: number;
  /** Vendas pagas das obras deste artista. Sempre 0 para quem não é artista. */
  salesCount: number;
  /** Compras pagas como comprador — vale para qualquer usuário. */
  boughtCount: number;
  createdAt: string;
}

export interface AdminContent {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  status: ContentStatus;
  rejectionReason: string | null;
  coverPath: string | null;
  createdAt: string;
  updatedAt: string;
  /** Takedown do admin: fora do ar, e o artista não reverte. */
  adminBlocked: boolean;
  adminBlockedReason: string | null;
  musical: Musical | null;
  items: OwnedContentItem[];
  artist: { id: string; name: string | null; email: string };
}

export interface AdminPurchase {
  id: number;
  amountCents: number;
  platformFeeCents: number;
  status: "pendente" | "pago" | "reembolsado";
  createdAt: string;
  content: { id: string; title: string };
  buyer: { id: string; name: string | null; email: string };
  artist: { id: string; name: string | null };
}

/**
 * Dashboard do painel admin.
 *
 * ⚠️ A CONTA: `grossCents = commissionCents + gatewayCents + artistNetCents`.
 * As três parcelas têm DONOS diferentes — a comissão fica com a Cantata, a
 * taxa do gateway sai para o Stripe (descontada do artista) e o resto é
 * repasse. Somar comissão com gateway numa linha de "taxas" produz um número
 * que não corresponde a nada.
 *
 * `commissionCents` é RECEITA, não lucro: não desconta os custos de operação.
 */
export interface AdminDashboard {
  period: DashboardPeriod;
  /** Granularidade da série: por dia em 30d, por mês nos demais. */
  bucket: "dia" | "mes";
  resumo: {
    salesCount: number;
    grossCents: number;
    commissionCents: number;
    gatewayCents: number;
    artistNetCents: number;
    avgTicketCents: number;
    /**
     * Vendas antigas sem o detalhe de taxa gravado (as colunas entraram
     * depois). Nelas a decomposição não fecha com o bruto — a tela avisa em
     * vez de mostrar um número que não bate e não se explica.
     */
    semDetalheCount: number;
  };
  /** Só o que exige ação. `null` quando não há nada daquele tipo. */
  atencao: Record<"pendente" | "reembolsado" | "falhou", { count: number; cents: number } | null>;
  topArtists: {
    id: string;
    name: string | null;
    salesCount: number;
    grossCents: number;
    commissionCents: number;
  }[];
  topContents: {
    id: string;
    title: string;
    artistName: string | null;
    salesCount: number;
    grossCents: number;
  }[];
  /** Só os períodos COM venda — quem preenche os buracos é o gráfico. */
  serie: { bucket: string; salesCount: number; grossCents: number; commissionCents: number }[];
}

export type DashboardPeriod = "30d" | "12m" | "tudo";

export const adminApi = {
  dashboard: (period: DashboardPeriod = "30d") =>
    request<AdminDashboard>(`/admin/dashboard?period=${period}`, { auth: true }),

  users: (params: { page?: number; q?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.q) query.set("q", params.q);
    const qs = query.toString();
    return request<{ users: AdminUser[]; page: number; perPage: number; total: number }>(
      `/admin/users${qs ? `?${qs}` : ""}`,
      { auth: true },
    );
  },

  contents: (status: ContentStatus = "em_revisao") =>
    request<{ contents: AdminContent[] }>(`/admin/contents?status=${status}`, { auth: true }),

  approve: (id: string) =>
    request<{ message: string }>(`/admin/contents/${id}/approve`, { method: "POST", auth: true }),

  reject: (id: string, reason: string) =>
    request<{ message: string }>(`/admin/contents/${id}/reject`, {
      method: "POST",
      body: { reason },
      auth: true,
    }),

  // Takedown de obra JÁ PUBLICADA (direito autoral, conteúdo impróprio):
  // some da vitrine E do link direto, e bloqueia novas compras. Quem já
  // comprou continua baixando.
  block: (id: string, reason: string) =>
    request<{ message: string; adminBlocked: boolean }>(`/admin/contents/${id}/block`, {
      method: "POST",
      body: { reason },
      auth: true,
    }),

  unblock: (id: string) =>
    request<{ message: string; adminBlocked: boolean }>(`/admin/contents/${id}/unblock`, {
      method: "POST",
      auth: true,
    }),

  purchases: (params: { page?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    const qs = query.toString();
    return request<{ purchases: AdminPurchase[]; page: number; perPage: number; total: number }>(
      `/admin/purchases${qs ? `?${qs}` : ""}`,
      { auth: true },
    );
  },

  // ---- Categorias (editáveis desde 2026-08-06) ----
  // `categories()` público traz só as ATIVAS; o painel precisa das recolhidas
  // também, que são justamente as que ele pode trazer de volta.
  allCategories: () =>
    request<{ categories: AdminCategory[] }>("/categories/all", { auth: true }),

  createCategory: (payload: { name: string; kind: CategoryKind; icon: string; hue: number }) =>
    request<{ category: AdminCategory; message: string }>("/categories", {
      method: "POST",
      body: payload,
      auth: true,
    }),

  updateCategory: (
    id: number,
    payload: {
      name?: string;
      kind?: CategoryKind;
      icon?: string;
      hue?: number;
      position?: number;
      active?: boolean;
    },
  ) =>
    request<{ category: AdminCategory; message: string }>(`/categories/${id}`, {
      method: "PUT",
      body: payload,
      auth: true,
    }),

  /**
   * Some com a categoria. `deleted` diz o que de fato aconteceu: `true` quando
   * ela estava vazia e foi apagada, `false` quando tinha obra dentro e foi
   * apenas recolhida. A tela mostra a `message` — o admin precisa saber qual
   * dos dois foi.
   */
  deleteCategory: (id: number) =>
    request<{ deleted: boolean; message: string }>(`/categories/${id}`, {
      method: "DELETE",
      auth: true,
    }),

  createSubcategory: (type: SubcategoryType, name: string) =>
    request<{ subcategory: Subcategory }>("/categories/subcategories", {
      method: "POST",
      body: { type, name },
      auth: true,
    }),

  updateSubcategory: (id: number, payload: { name?: string; active?: boolean }) =>
    request<{ message: string }>(`/categories/subcategories/${id}`, {
      method: "PUT",
      body: payload,
      auth: true,
    }),

  // Musicais (datas especiais). Mesmo conjunto de operações das categorias
  // desde 2026-08-06 — listar recolhidos, renomear, recolher e excluir.
  allMusicals: () =>
    request<{ musicals: AdminMusical[] }>("/categories/musicals/all", { auth: true }),

  createMusical: (name: string) =>
    request<{ musical: Musical }>("/categories/musicals", {
      method: "POST",
      body: { name },
      auth: true,
    }),

  updateMusical: (id: number, payload: { name?: string; active?: boolean }) =>
    request<{ musical: AdminMusical; message: string }>(`/categories/musicals/${id}`, {
      method: "PUT",
      body: payload,
      auth: true,
    }),

  /** `deleted` diz o que aconteceu: apagado (tema vazio) ou recolhido. */
  deleteMusical: (id: number) =>
    request<{ deleted: boolean; message: string }>(`/categories/musicals/${id}`, {
      method: "DELETE",
      auth: true,
    }),
};

// ---- Utilidades -------------------------------------------------------------------

/** Formata centavos como moeda brasileira (ex.: 1990 → "R$ 19,90"). */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
