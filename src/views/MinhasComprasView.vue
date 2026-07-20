<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { purchasesApi, fileUrl, formatPrice, type Purchase } from '@/services/api'

const route = useRoute()

const purchases = ref<Purchase[]>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const downloadingId = ref<number | null>(null)

onMounted(async () => {
  if (route.query.checkout === 'sucesso') {
    success.value =
      'Pagamento iniciado! No cartão a confirmação é quase imediata; no Pix ou boleto pode levar alguns minutos — a compra aparece abaixo como "Aguardando confirmação" até lá.'
  }
  try {
    purchases.value = (await purchasesApi.mine()).purchases
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar suas compras.'
  } finally {
    loading.value = false
  }
})

// Um download por ARQUIVO do pacote (2026-07-16: N arquivos por categoria).
const downloadingFile = ref<number | null>(null)

async function download(p: Purchase, file: { id: number; fileName: string | null }) {
  downloadingId.value = p.id
  downloadingFile.value = file.id
  error.value = ''
  try {
    await purchasesApi.download(p.content.id, file.id, file.fileName)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao baixar o arquivo.'
  } finally {
    downloadingId.value = null
    downloadingFile.value = null
  }
}
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Minhas Compras</h1>

    <p v-if="success" class="success">{{ success }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="!purchases.length" class="muted">
      Você ainda não comprou nenhum conteúdo.
      <RouterLink to="/biblioteca" class="link">Explorar a biblioteca →</RouterLink>
    </p>

    <ul v-else class="list">
      <li v-for="p in purchases" :key="p.id" class="item">
        <img
          v-if="p.content.coverPath"
          :src="fileUrl(p.content.coverPath) ?? undefined"
          :alt="p.content.title"
          class="thumb"
        />
        <div v-else class="thumb placeholder">🎵</div>

        <div class="meta">
          <RouterLink :to="`/conteudo/${p.content.id}`" class="title">{{ p.content.title }}</RouterLink>
          <p class="sub">
            {{ p.content.items.map((i) => i.category.name).join(' · ') }} ·
            {{ p.content.artist.name || 'Artista' }} ·
            {{ new Date(p.purchasedAt).toLocaleDateString('pt-BR') }} · {{ formatPrice(p.amountCents) }}
          </p>
          <p v-if="p.status === 'pendente'" class="pending-badge">
            Aguardando confirmação do pagamento (Pix/boleto podem levar alguns minutos)
          </p>
        </div>

        <!-- Download não expira (spec §8); um botão por ARQUIVO, agrupado
             por categoria do pacote. Só aparece com pagamento confirmado —
             enquanto 'pendente' (Pix/boleto), o download ainda é negado
             pela API mesmo que o botão aparecesse (2026-07-20). -->
        <div v-if="p.status === 'pago'" class="dl-group">
          <template v-for="item in p.content.items" :key="item.id">
            <button
              v-for="(file, fi) in item.files"
              :key="file.id"
              class="dl-btn"
              :disabled="downloadingId === p.id"
              :title="file.fileName ?? undefined"
              @click="download(p, file)"
            >
              {{ downloadingId === p.id && downloadingFile === file.id
                ? 'Baixando…'
                : item.files.length > 1
                  ? `${item.category.name} ${fi + 1}`
                  : p.content.items.length > 1
                    ? `Baixar ${item.category.name}`
                    : 'Baixar' }}
            </button>
          </template>
        </div>
      </li>
    </ul>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

// Bloco solto: moldura completa de 1px, sem radius (guia §3).
.item {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid $line;
}

.thumb {
  width: 72px;
  height: 54px;
  object-fit: cover;
  flex-shrink: 0;

  &.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--fg-rgb), 0.06);
    opacity: 0.5;
  }
}

.meta {
  flex: 1;
  min-width: 0;
}

.title {
  color: $color-white;
  font-family: $font-display;
  font-size: 1.05rem;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $gold-text;
  }
}

.sub {
  margin-top: 0.25rem;
  font-size: 0.82rem;
  color: rgba(var(--fg-rgb), 0.55);
}

.pending-badge {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: $gold-text;
}

.dl-btn {
  @include block-button-primary;
  padding: 0.6rem 1.4rem;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.link {
  color: $gold-text;
}

.success {
  color: $color-success;
  margin-bottom: 1rem;
}

.error {
  color: $color-error;
  margin-bottom: 1rem;
}
</style>
