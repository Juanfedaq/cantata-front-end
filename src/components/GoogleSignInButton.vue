<script setup lang="ts">
// Botão "Entrar com o Google" (Google Identity Services): sem redirect nem
// client secret — o Google devolve um ID token já assinado, que só
// repassamos para POST /auth/google (o backend confere e resolve a conta).
// Compartilhado por LoginView e RegisterView: o mesmo botão serve para
// cadastro e login (o backend decide se cria ou vincula a conta).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Sem os tipos oficiais do GIS instalados (@types/google.accounts), declaramos
// à mão SÓ o que usamos — initialize + renderButton. O global é opcional
// porque só existe depois do script do Google carregar.
interface GsiIdConfig {
  client_id: string
  callback: (response: { credential: string }) => void
}

interface GsiButtonOptions {
  type: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'small' | 'medium' | 'large'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
  locale?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GsiIdConfig) => void
          renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void
        }
      }
    }
  }
}

const emit = defineEmits<{ success: []; error: [message: string] }>()

const auth = useAuthStore()
const container = ref<HTMLElement | null>(null)
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

/** Carrega o script do Google uma única vez, mesmo com Login/Register remontando. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

let unmounted = false

onMounted(async () => {
  if (!clientId || !container.value) return // sem client id: o botão não aparece

  try {
    await loadGoogleScript()
    if (unmounted || !container.value) return

    // O script carregou mas o global pode não ter sido publicado (bloqueio de
    // rede/extensão) — sem esta guarda, o TS não estreita o tipo e o erro
    // viraria um TypeError cru em vez da mensagem amigável do catch.
    const gsi = window.google?.accounts.id
    if (!gsi) throw new Error('Google Identity Services não inicializou.')

    gsi.initialize({
      client_id: clientId,
      callback: async (response: { credential: string }) => {
        try {
          await auth.loginWithGoogle(response.credential)
          emit('success')
        } catch (err) {
          emit('error', err instanceof Error ? err.message : 'Erro ao entrar com o Google.')
        }
      },
    })
    gsi.renderButton(container.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      width: 320,
      locale: 'pt-BR',
    })
  } catch {
    emit('error', 'Não foi possível carregar o login do Google.')
  }
})

onBeforeUnmount(() => {
  unmounted = true
})
</script>

<template>
  <!-- Divisor + botão só existem juntos: sem VITE_GOOGLE_CLIENT_ID
       configurado, nem o "ou" nem o container aparecem (nada órfão). -->
  <template v-if="clientId">
    <div class="divider"><span>ou</span></div>
    <div ref="container" class="google-btn"></div>
  </template>
</template>

<style scoped lang="scss">
// O botão em si é renderizado pelo Google (iframe, visual deles — fora do
// nosso controle de estilo); só centralizamos o container. O .divider vem
// do _auth.scss global (compartilhado com o resto dos formulários de auth).
.google-btn {
  display: flex;
  justify-content: center;
  width: 100%;
}
</style>
