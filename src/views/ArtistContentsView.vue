<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { contentsApi, artistsApi, formatPrice, type MyContent } from '@/services/api'

const contents = ref<MyContent[]>([])
const loading = ref(true)
const error = ref('')
const stripeStatus = ref<'carregando' | 'completo' | 'pendente' | 'indisponivel'>('carregando')
const stripeLoading = ref(false)

const STATUS_LABELS: Record<MyContent['status'], string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aprovado: 'Publicado',
  reprovado: 'Reprovado',
}

onMounted(async () => {
  try {
    contents.value = (await contentsApi.mine()).contents
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao listar seus conteúdos.'
  } finally {
    loading.value = false
  }

  try {
    const status = await artistsApi.stripeStatus()
    stripeStatus.value = status.onboardingComplete ? 'completo' : 'pendente'
  } catch {
    stripeStatus.value = 'indisponivel'
  }
})

async function startOnboarding() {
  stripeLoading.value = true
  try {
    const { url } = await artistsApi.stripeOnboarding()
    window.location.href = url
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao iniciar o onboarding.'
    stripeLoading.value = false
  }
}

async function remove(content: MyContent) {
  if (!confirm(`Excluir "${content.title}"?`)) return
  try {
    await contentsApi.remove(content.id)
    contents.value = contents.value.filter((c) => c.id !== content.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao excluir.'
  }
}

// A foto de perfil (e a bio) agora são editadas em Meu Perfil (/perfil).
</script>

<template>
  <AppLayout>
    <div class="head">
      <h1 class="page-title">Meus Conteúdos</h1>
      <RouterLink to="/artista/publicar" class="new-btn">+ Publicar conteúdo</RouterLink>
    </div>

    <!-- Aviso do Stripe: sem onboarding completo, as vendas ficam bloqueadas -->
    <div v-if="stripeStatus === 'pendente' || stripeStatus === 'indisponivel'" class="stripe-warn">
      <p v-if="stripeStatus === 'pendente'">
        ⚠️ Complete o cadastro de recebimentos (Stripe) para que seus conteúdos possam ser vendidos.
      </p>
      <p v-else>⚠️ Não foi possível verificar seu cadastro de recebimentos agora.</p>
      <button class="stripe-btn" :disabled="stripeLoading" @click="startOnboarding">
        {{ stripeLoading ? 'Redirecionando…' : 'Configurar recebimentos' }}
      </button>
    </div>
    <p v-else-if="stripeStatus === 'completo'" class="stripe-ok">✅ Recebimentos habilitados via Stripe.</p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="!contents.length" class="muted">Você ainda não enviou nenhum conteúdo.</p>

    <ul v-else class="list">
      <li v-for="c in contents" :key="c.id" class="item">
        <div class="meta">
          <div class="row">
            <span class="badge" :class="c.status">{{ STATUS_LABELS[c.status] }}</span>
            <strong class="title">{{ c.title }}</strong>
            <span class="muted">{{ c.categories.map((cat) => cat.name).join(' · ') }} · {{ formatPrice(c.priceCents) }}</span>
          </div>
          <p v-if="c.status === 'reprovado' && c.rejectionReason" class="reason">
            Motivo da reprovação: {{ c.rejectionReason }}
          </p>
        </div>
        <div class="actions">
          <RouterLink
            v-if="c.status !== 'aprovado'"
            :to="`/artista/publicar?editar=${c.id}`"
            class="action-link"
          >
            {{ c.status === 'reprovado' ? 'Ajustar e reenviar' : 'Editar' }}
          </RouterLink>
          <RouterLink v-else :to="`/conteudo/${c.id}`" class="action-link">Ver página</RouterLink>
          <button v-if="c.status !== 'aprovado'" class="action-link danger" @click="remove(c)">
            Excluir
          </button>
        </div>
      </li>
    </ul>
  </AppLayout>
</template>

<style scoped lang="scss">
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
}

.new-btn {
  @include block-button-primary;
  padding: 0.6rem 1.4rem;
}

// Aviso solto na página: moldura completa, sem radius (guia §3);
// borda na cor funcional de erro (exceção prevista no guia §8).
.stripe-warn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
  border: 1px solid rgba($color-error, 0.4);
  margin-bottom: 1.5rem;
  color: rgba(var(--fg-rgb), 0.85);
}

.stripe-btn {
  @include block-button-primary;
  padding: 0.6rem 1.2rem;
}

.stripe-ok {
  color: $color-success;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
  border: 1px solid $line;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.title {
  font-family: $font-display;
  font-size: 1.05rem;
}

// Badge blocado: quadrado, rótulo uppercase espaçado (guia §3/§5).
// "Em revisão" usa o dourado da paleta (o amarelo antigo estava fora dela).
.badge {
  @include label-type;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;

  &.rascunho {
    background: rgba(var(--fg-rgb), 0.08);
    color: rgba(var(--fg-rgb), 0.7);
  }
  &.em_revisao {
    background: rgba($color-primary, 0.18);
    color: $gold-text;
  }
  &.aprovado {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
  &.reprovado {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}

.reason {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: $color-error;
}

.actions {
  display: flex;
  gap: 1rem;
}

.action-link {
  background: none;
  border: none;
  cursor: pointer;
  color: $gold-text;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
  }

  &.danger {
    color: $color-error;
  }
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
  margin-bottom: 1rem;
}
</style>
