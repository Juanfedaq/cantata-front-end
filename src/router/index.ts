import type { Router, RouteRecordRaw } from 'vue-router'
import type { Pinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { scrollToTop } from '@/scroll'

// SEO: title/description alimentam o <head> por rota (useDefaultSeo no
// App.vue); noindex marca páginas privadas/transacionais para os buscadores.
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
    noindex?: boolean
    requiresAuth?: boolean
    requiresArtist?: boolean
    requiresAdmin?: boolean
    guestOnly?: boolean
  }
}

// As rotas são exportadas (em vez do router pronto) porque o vite-ssg cria
// o router por conta própria — client-side no browser, memory history na
// pré-renderização do build. O main.ts monta tudo via ViteSSG.
export const routes: RouteRecordRaw[] = [
  // REGRA INEGOCIÁVEL (spec §9.1): a ComingSoonView é a home pública ("/")
  // até o lançamento. A troca pela home real será manual — basta apontar
  // "/" para HomeView e mover a ComingSoon para outra rota (ou removê-la).
  {
    path: '/',
    name: 'coming-soon',
    component: () => import('@/views/ComingSoonView.vue'),
    // Sem meta.title: usa o título/descrição padrão da marca.
  },
  // Home real da plataforma (banner, categorias, últimos lançamentos).
  {
    path: '/inicio',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: {
      title: 'Início',
      description:
        'Descubra partituras de novos compositores — coral, orquestra, música de câmara e mais. Publique, descubra e adquira música escrita no Cantata.',
    },
  },
  {
    path: '/biblioteca',
    name: 'biblioteca',
    component: () => import('@/views/BibliotecaView.vue'),
    meta: {
      title: 'Biblioteca de partituras',
      description:
        'Explore o catálogo de partituras do Cantata: busque por categoria, formação e nome. Obras com qualidade editorial e licenciamento claro.',
    },
  },
  // Vitrine com VÁRIOS artistas escondida por decisão de produto (2026-07-20
  // — ver PROGRESS.md): por ora a plataforma trabalha só com o perfil do
  // sócio (rota abaixo, que continua ativa). Comentado, não removido —
  // reativar é só descomentar quando a vitrine plural voltar.
  // {
  //   path: '/artistas',
  //   name: 'artistas',
  //   component: () => import('@/views/ArtistasView.vue'),
  //   meta: {
  //     title: 'Artistas',
  //     description:
  //       'Conheça os compositores do Cantata e explore as obras publicadas por cada um.',
  //   },
  // },
  {
    path: '/artistas/:id',
    name: 'artista-perfil',
    component: () => import('@/views/ArtistProfileView.vue'),
    // Título/descrição reais vêm da view (usePageSeo) quando o perfil carrega.
    meta: { title: 'Artista' },
  },
  {
    path: '/conteudo/:id',
    name: 'conteudo',
    component: () => import('@/views/ContentDetailView.vue'),
    meta: { title: 'Partitura' },
  },
  {
    path: '/privacidade',
    name: 'privacidade',
    component: () => import('@/views/PrivacidadeView.vue'),
    meta: {
      title: 'Política de Privacidade',
      description:
        'Como o Cantata trata seus dados: armazenamento essencial, sem rastreadores e sem publicidade.',
    },
  },
  // Telas de autenticação. O fundo delas (anéis + luz do cursor) virou
  // global: AppBackdrop no App.vue, persistente entre TODAS as views.
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: {
      guestOnly: true,
      title: 'Entrar',
      description: 'Acesse sua conta no Cantata.',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: {
      guestOnly: true,
      title: 'Criar conta',
      description:
        'Crie sua conta no Cantata — publique suas composições ou encontre repertório para o seu grupo.',
    },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { guestOnly: true, title: 'Recuperar senha', noindex: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { title: 'Redefinir senha', noindex: true },
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/views/VerifyEmailView.vue'),
    meta: { title: 'Verificação de e-mail', noindex: true },
  },
  // O dashboard foi aposentado (2026-07-09): suas entradas viraram o
  // dropdown do usuário no header. Redirect mantém links antigos vivos.
  {
    path: '/dashboard',
    redirect: '/perfil',
  },
  {
    path: '/compras',
    name: 'minhas-compras',
    component: () => import('@/views/MinhasComprasView.vue'),
    meta: { requiresAuth: true, title: 'Minhas compras', noindex: true },
  },
  // Aberta a qualquer logado: não-artistas veem aqui o convite
  // "Torne-se um artista" (que morava no dashboard).
  {
    path: '/perfil',
    name: 'perfil',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'Meu perfil', noindex: true },
  },
  {
    path: '/artista/conteudos',
    name: 'artista-conteudos',
    component: () => import('@/views/ArtistContentsView.vue'),
    meta: { requiresAuth: true, requiresArtist: true, title: 'Meus conteúdos', noindex: true },
  },
  {
    path: '/contrato',
    name: 'contrato',
    component: () => import('@/views/ContratoView.vue'),
    meta: { requiresAuth: true, requiresArtist: true, title: 'Contrato', noindex: true },
  },
  {
    path: '/artista/publicar',
    name: 'artista-publicar',
    component: () => import('@/views/ContentUploadView.vue'),
    meta: { requiresAuth: true, requiresArtist: true, title: 'Publicar', noindex: true },
  },
  {
    path: '/artista/stripe',
    name: 'artista-stripe',
    component: () => import('@/views/ArtistStripeView.vue'),
    meta: { requiresAuth: true, requiresArtist: true, title: 'Recebimentos', noindex: true },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Admin', noindex: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

// Guardas de navegação, registradas no router criado pelo ViteSSG.
// A pinia vem por parâmetro: fora de componentes (e na pré-renderização,
// onde não há instância ativa global) o useAuthStore precisa dela explícita.
export function setupRouterGuards(router: Router, pinia: Pinia) {
  // Protege rotas privadas (e por papel) e afasta usuários logados das
  // telas de convidado (login, cadastro, etc.).
  router.beforeEach((to) => {
    const auth = useAuthStore(pinia)

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (to.meta.requiresArtist && !auth.isArtist) {
      // O convite para virar artista mora no Meu Perfil.
      return { name: 'perfil' }
    }
    if (to.meta.requiresAdmin && !auth.isAdmin) {
      return { name: 'home' }
    }
    if (to.meta.guestOnly && auth.isAuthenticated) {
      return { name: 'home' }
    }
  })

  // Toda troca de página começa do topo (via Lenis quando ativo — sem isso,
  // a SPA manteria a posição de scroll da página anterior).
  router.afterEach((to, from) => {
    if (to.path !== from.path) scrollToTop()
  })
}
