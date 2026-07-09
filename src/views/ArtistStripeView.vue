<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { artistsApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

// Página de retorno do onboarding do Stripe Connect (return_url / refresh_url).
const auth = useAuthStore()
const status = ref<'verificando' | 'completo' | 'pendente' | 'erro'>('verificando')
const loading = ref(false)

onMounted(async () => {
  try {
    const res = await artistsApi.stripeStatus()
    status.value = res.onboardingComplete ? 'completo' : 'pendente'
    await auth.refresh().catch(() => {})
  } catch {
    status.value = 'erro'
  }
})

async function retry() {
  loading.value = true
  try {
    const { url } = await artistsApi.stripeOnboarding()
    window.location.href = url
  } catch {
    status.value = 'erro'
    loading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="box">
      <p v-if="status === 'verificando'" class="muted">Verificando seu cadastro no Stripe…</p>

      <template v-else-if="status === 'completo'">
        <h1 class="title">✅ Recebimentos habilitados!</h1>
        <p class="muted">Seus conteúdos aprovados já podem ser vendidos.</p>
        <RouterLink to="/artista/conteudos" class="btn">Ir para Meus Conteúdos</RouterLink>
      </template>

      <template v-else>
        <h1 class="title">Cadastro incompleto</h1>
        <p class="muted">
          {{
            status === 'erro'
              ? 'Não foi possível verificar seu cadastro agora.'
              : 'O Stripe ainda precisa de mais informações para habilitar seus recebimentos.'
          }}
        </p>
        <button class="btn" :disabled="loading" @click="retry">
          {{ loading ? 'Redirecionando…' : 'Continuar cadastro no Stripe' }}
        </button>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.box {
  max-width: 480px;
  margin: 4rem auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.title {
  font-family: $font-display;
  font-size: 1.6rem;
}

.btn {
  @include block-button-primary;
}

.muted {
  color: rgba(var(--fg-rgb), 0.6);
}
</style>
