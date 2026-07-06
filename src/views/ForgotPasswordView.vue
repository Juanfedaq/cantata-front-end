<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { authApi, ApiError } from '@/services/api'

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function onSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    const { message } = await authApi.forgotPassword(email.value)
    success.value = message
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Esqueci minha senha" subtitle="Enviaremos um link de redefinição para seu e-mail">
    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <p v-if="success" class="alert alert-success">{{ success }}</p>

    <form v-if="!success" class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="email">E-mail</label>
        <input id="email" v-model="email" type="email" class="input" placeholder="voce@email.com"
          autocomplete="email" required />
      </div>
      <button type="submit" class="btn" :disabled="loading">
        {{ loading ? 'Enviando…' : 'Enviar link' }}
      </button>
    </form>

    <div class="auth-links">
      <RouterLink to="/login" class="auth-link">Voltar para o login</RouterLink>
    </div>
  </AuthShell>
</template>
