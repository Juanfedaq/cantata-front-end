<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import GoogleSignInButton from '@/components/GoogleSignInButton.vue'
import { authApi, ApiError } from '@/services/api'

const router = useRouter()
const route = useRoute()

const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function onSubmit() {
  error.value = ''
  success.value = ''

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
    const { message } = await authApi.register({
      name: name.value || undefined,
      email: email.value,
      password: password.value,
    })
    success.value = message
    name.value = email.value = password.value = confirm.value = ''
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.'
  } finally {
    loading.value = false
  }
}

function onGoogleSuccess() {
  const redirect = (route.query.redirect as string) || '/inicio'
  router.push(redirect)
}

function onGoogleError(message: string) {
  error.value = message
}
</script>

<template>
  <AuthShell title="Criar conta" subtitle="Comece a usar o Cantata">
    <p v-if="error" class="alert alert-error">{{ error }}</p>
    <p v-if="success" class="alert alert-success">{{ success }}</p>

    <form v-if="!success" class="auth-form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="name">Nome</label>
        <input id="name" v-model="name" type="text" class="input" placeholder="Seu nome"
          autocomplete="name" />
      </div>
      <div class="field">
        <label for="email">E-mail</label>
        <input id="email" v-model="email" type="email" class="input" placeholder="voce@email.com"
          autocomplete="email" required />
      </div>
      <div class="field">
        <label for="password">Senha</label>
        <input id="password" v-model="password" type="password" class="input"
          placeholder="Mínimo 8 caracteres" autocomplete="new-password" required />
      </div>
      <div class="field">
        <label for="confirm">Confirmar senha</label>
        <input id="confirm" v-model="confirm" type="password" class="input" placeholder="••••••••"
          autocomplete="new-password" required />
      </div>
      <button type="submit" class="btn" :disabled="loading">
        {{ loading ? 'Criando…' : 'Criar conta' }}
      </button>
    </form>

    <GoogleSignInButton v-if="!success" @success="onGoogleSuccess" @error="onGoogleError" />

    <div class="auth-links">
      <span>Já tem conta?
        <RouterLink to="/login" class="auth-link">Entrar</RouterLink>
      </span>
    </div>
  </AuthShell>
</template>
