<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import { useAuthStore } from '@/stores/auth'
import { authApi, ApiError } from '@/services/api'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const info = ref('')
const needsVerification = ref(false)

async function onSubmit() {
  error.value = ''
  info.value = ''
  needsVerification.value = false
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message
      if (err.code === 'EMAIL_NOT_VERIFIED') needsVerification.value = true
    } else {
      error.value = 'Erro inesperado. Tente novamente.'
    }
  } finally {
    loading.value = false
  }
}

async function resend() {
  info.value = ''
  error.value = ''
  try {
    const { message } = await authApi.resendVerification(email.value)
    info.value = message
  } catch {
    error.value = 'Não foi possível reenviar o e-mail.'
  }
}
</script>

<template>
  <AuthShell title="Entrar" subtitle="Acesse sua conta Cantata">
    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <p v-if="info" class="alert alert-success">{{ info }}</p>
    <button v-if="needsVerification" type="button" class="btn btn-ghost" @click="resend">
      Reenviar e-mail de confirmação
    </button>

    <form class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="email">E-mail</label>
        <input id="email" v-model="email" type="email" class="input" placeholder="voce@email.com"
          autocomplete="email" required />
      </div>
      <div class="field">
        <label for="password">Senha</label>
        <input id="password" v-model="password" type="password" class="input" placeholder="••••••••"
          autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn" :disabled="loading">
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <div class="auth-links">
      <RouterLink to="/forgot-password" class="auth-link">Esqueci minha senha</RouterLink>
      <span>Não tem conta?
        <RouterLink to="/register" class="auth-link">Cadastre-se</RouterLink>
      </span>
    </div>
  </AuthShell>
</template>
