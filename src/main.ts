// ViteSSG no lugar do createApp puro: no browser é a mesma SPA de sempre;
// no build, o vite-ssg pré-renderiza as rotas públicas estáticas em HTML
// (SEO — crawlers recebem conteúdo pronto). As rotas ficam em @/router,
// o head por página em @/composables/useSeo.
import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'

// Fontes (self-hosted via @fontsource)
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/500-italic.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'

// Estilos globais
import '@/assets/styles/main.scss'

import App from './App.vue'
import { routes, setupRouterGuards } from './router'
import { useAuthStore } from '@/stores/auth'
import { setupSmoothScroll } from './scroll'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
  ({ app, router, isClient }) => {
    const pinia = createPinia()
    app.use(pinia)

    setupRouterGuards(router, pinia)

    // Só no browser — na pré-renderização (Node) não há window nem sessão.
    if (isClient) {
      // Scroll suave da plataforma toda (não instancia sob prefers-reduced-motion).
      setupSmoothScroll()

      // Revalida a sessão persistida contra o servidor (não bloqueia a montagem).
      useAuthStore(pinia).bootstrap()
    }
  },
)
