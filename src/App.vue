<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppBackdrop from '@/components/AppBackdrop.vue'
import CookieConsent from '@/components/CookieConsent.vue'
import CoverSpotlight from '@/components/CoverSpotlight.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useDefaultSeo } from '@/composables/useSeo'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// <head> por rota (título, descrição, canonical, Open Graph, robots) —
// lê o meta das rotas; views dinâmicas refinam com usePageSeo.
useDefaultSeo()

// Instancia a store de tema já na raiz: aplica o data-theme no <html>
// em qualquer rota (inclusive telas de auth, que não usam o AppLayout).
useThemeStore()

// Se a sessão cair (401/logout) enquanto o usuário está numa rota
// protegida, leva para o login em vez de deixar a tela num estado morto.
watch(
  () => auth.isAuthenticated,
  (logged) => {
    if (!logged && route.meta.requiresAuth) {
      router.replace({ name: 'login', query: { redirect: route.fullPath } })
    }
  },
)
</script>

<template>
  <!-- Fundo global persistente (anéis + luz do cursor): vive fora do
       RouterView, então não reinicia ao trocar de view. A ComingSoon
       (rota "/", intocável) fica sem ele. -->
  <AppBackdrop v-if="route.name !== 'coming-soon'" />
  <!-- Capa em destaque no fundo (hover dos cards de obra): irmão do
       backdrop, DEPOIS dele — paira sobre os anéis, atrás do conteúdo. -->
  <CoverSpotlight v-if="route.name !== 'coming-soon'" />
  <RouterView />
  <!-- Aviso de cookies: global e persistente; fora da ComingSoon para
       manter a landing de pré-lançamento limpa. -->
  <CookieConsent v-if="route.name !== 'coming-soon'" />
</template>
