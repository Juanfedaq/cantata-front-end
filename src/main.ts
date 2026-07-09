import { createApp } from 'vue'
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
import router from './router'
import { useAuthStore } from '@/stores/auth'
import { setupSmoothScroll } from './scroll'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Scroll suave da plataforma toda (não instancia sob prefers-reduced-motion).
setupSmoothScroll()

// Revalida a sessão persistida contra o servidor (não bloqueia a montagem).
useAuthStore().bootstrap()

app.mount('#app')
