<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { authApi, ApiError } from '@/services/api'

const route = useRoute()
const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('Confirmando seu e-mail…')

onMounted(async () => {
  const token = (route.query.token as string) || ''
  if (!token) {
    status.value = 'error'
    message.value = 'Link inválido. Token não encontrado.'
    return
  }
  try {
    const res = await authApi.verifyEmail(token)
    status.value = 'success'
    message.value = res.message
  } catch (err) {
    status.value = 'error'
    message.value = err instanceof ApiError ? err.message : 'Não foi possível confirmar o e-mail.'
  }
})
</script>

<template>
  <AuthShell title="Confirmação de e-mail">
    <p v-if="status === 'loading'" class="alert">{{ message }}</p>
    <p v-else-if="status === 'success'" class="alert alert-success">{{ message }}</p>
    <p v-else class="alert alert-error">{{ message }}</p>

    <div class="auth-links">
      <RouterLink to="/login" class="auth-link">Ir para o login</RouterLink>
    </div>
  </AuthShell>
</template>
