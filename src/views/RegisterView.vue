<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import GoogleSignInButton from '@/components/GoogleSignInButton.vue'
import { authApi, ApiError } from '@/services/api'
import { checkPassword, passwordIsValid } from '@/utils/passwordRules'

const router = useRouter()
const route = useRoute()

const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

// Requisitos da senha em tempo real (QA 2026-08-05). A lista só aparece
// depois que a pessoa começa a digitar — mostrar cinco itens vermelhos num
// campo ainda vazio parece repreensão.
const passwordRules = computed(() =>
  checkPassword(password.value, {
    email: email.value,
    name: name.value,
    confirm: confirm.value,
  }),
)
const passwordOk = computed(() => passwordIsValid(passwordRules.value))
const showRules = computed(() => password.value.length > 0)

async function onSubmit() {
  error.value = ''
  success.value = ''

  // A lista na tela já diz o que falta; aqui só barramos o envio. O servidor
  // continua validando — isto é conveniência, não segurança.
  if (!passwordOk.value) {
    error.value = 'A senha ainda não cumpre todos os requisitos abaixo.'
    return
  }

  loading.value = true
  try {
    const { message } = await authApi.register({
      name: name.value.trim(),
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
          autocomplete="name" required />
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

      <!-- Requisitos da senha: cada item vira verde quando cumprido. Os
           mesmos cinco que o servidor cobra, para a lista nunca ficar toda
           verde e o cadastro falhar mesmo assim. -->
      <ul v-if="showRules" class="rules" aria-live="polite">
        <li v-for="rule in passwordRules" :key="rule.id" class="rule" :class="{ ok: rule.ok }">
          <span class="dot" aria-hidden="true"></span>
          <span>{{ rule.label }}</span>
          <span class="sr-only">{{ rule.ok ? ' — cumprido' : ' — pendente' }}</span>
        </li>
      </ul>

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

<style scoped lang="scss">
// Lista de requisitos da senha. Sem moldura: é apoio ao campo acima, não um
// bloco solto na página (guia §3.4).
.rules {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: -0.4rem 0 0.25rem;
}

.rule {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  line-height: 1.4;
  color: rgba(var(--fg-rgb), 0.55);
  transition: color 0.4s $ease-brand;

  &.ok {
    color: $color-success;
  }
}

// O ponto carrega o estado. A cor sozinha não pode ser o único sinal
// (daltonismo): o texto muda de tom junto, e o leitor de tela ouve
// "cumprido"/"pendente" pelo .sr-only ao lado.
.dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $color-error;
  transition:
    background 0.4s $ease-brand,
    transform 0.4s $ease-brand;

  .rule.ok & {
    background: $color-success;
    transform: scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rule,
  .dot {
    transition: none;
  }
}

// Texto só para leitor de tela (mesmo padrão do ContentUploadView).
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
