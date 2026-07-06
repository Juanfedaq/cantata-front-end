<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

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
  <RouterView />
</template>
