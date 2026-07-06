<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { authApi, ApiError } from '@/services/api'

const route = useRoute()
const token = computed(() => (route.query.token as string) || '')

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function onSubmit() {
  error.value = ''
  success.value = ''

  if (!token.value) {
    error.value = 'Link inválido. Solicite uma nova redefinição.'
    return
  }
  if (password.value.length < 8) {
    error.value = 'A senha deve ter ao menos 8 caracteres.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'As senhas não coincidem.'
    return
  }

  loading.value = true
  try {
    const { message } = await authApi.resetPassword({ token: token.value, password: password.value })
    success.value = message
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Redefinir senha" subtitle="Escolha uma nova senha para sua conta">
    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <p v-if="success" class="alert alert-success">{{ success }}</p>

    <form v-if="!success" class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="password">Nova senha</label>
        <input id="password" v-model="password" type="password" class="input"
          placeholder="Mínimo 8 caracteres" autocomplete="new-password" required />
      </div>
      <div class="field">
        <label for="confirm">Confirmar senha</label>
        <input id="confirm" v-model="confirm" type="password" class="input" placeholder="••••••••"
          autocomplete="new-password" required />
      </div>
      <button type="submit" class="btn" :disabled="loading">
        {{ loading ? 'Salvando…' : 'Redefinir senha' }}
      </button>
    </form>

    <div class="auth-links">
      <RouterLink to="/login" class="auth-link">Ir para o login</RouterLink>
    </div>
  </AuthShell>
</template>
