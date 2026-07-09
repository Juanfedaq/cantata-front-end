import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { scrollToTop } from '@/scroll'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // REGRA INEGOCIÁVEL (spec §9.1): a ComingSoonView é a home pública ("/")
    // até o lançamento. A troca pela home real será manual — basta apontar
    // "/" para HomeView e mover a ComingSoon para outra rota (ou removê-la).
    {
      path: '/',
      name: 'coming-soon',
      component: () => import('@/views/ComingSoonView.vue'),
    },
    // Home real da plataforma (banner, categorias, últimos lançamentos).
    {
      path: '/inicio',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/biblioteca',
      name: 'biblioteca',
      component: () => import('@/views/BibliotecaView.vue'),
    },
    {
      path: '/artistas',
      name: 'artistas',
      component: () => import('@/views/ArtistasView.vue'),
    },
    {
      path: '/artistas/:id',
      name: 'artista-perfil',
      component: () => import('@/views/ArtistProfileView.vue'),
    },
    {
      path: '/conteudo/:id',
      name: 'conteudo',
      component: () => import('@/views/ContentDetailView.vue'),
    },
    {
      path: '/privacidade',
      name: 'privacidade',
      component: () => import('@/views/PrivacidadeView.vue'),
    },
    // Telas de autenticação. O fundo delas (anéis + luz do cursor) virou
    // global: AppBackdrop no App.vue, persistente entre TODAS as views.
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/views/VerifyEmailView.vue'),
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
      meta: { requiresAuth: true },
    },
    // Aberta a qualquer logado: não-artistas veem aqui o convite
    // "Torne-se um artista" (que morava no dashboard).
    {
      path: '/perfil',
      name: 'perfil',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/artista/conteudos',
      name: 'artista-conteudos',
      component: () => import('@/views/ArtistContentsView.vue'),
      meta: { requiresAuth: true, requiresArtist: true },
    },
    {
      path: '/contrato',
      name: 'contrato',
      component: () => import('@/views/ContratoView.vue'),
      meta: { requiresAuth: true, requiresArtist: true },
    },
    {
      path: '/artista/publicar',
      name: 'artista-publicar',
      component: () => import('@/views/ContentUploadView.vue'),
      meta: { requiresAuth: true, requiresArtist: true },
    },
    {
      path: '/artista/stripe',
      name: 'artista-stripe',
      component: () => import('@/views/ArtistStripeView.vue'),
      meta: { requiresAuth: true, requiresArtist: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// Guarda de navegação: protege rotas privadas (e por papel) e afasta
// usuários logados das telas de convidado (login, cadastro, etc.).
router.beforeEach((to) => {
  const auth = useAuthStore()

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

export default router
