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

/**
 * UM botão por compra (2026-08-05, QA). Antes era um botão por ARQUIVO do
 * pacote: quem comprava partitura + áudio + cifra clicava cinco vezes.
 *
 * O rótulo é só "Baixar": a contagem de arquivos já aparece ao lado de cada
 * categoria, logo acima, e o formato da entrega (arquivo direto ou ZIP) é
 * detalhe de implementação — não é decisão de quem clica.
 *
 * Pacote com um arquivo só baixa o arquivo direto; embrulhar um único PDF num
 * ZIP obrigaria a pessoa a descompactar sem motivo.
 */
async function download(p: Purchase) {
  downloadingId.value = p.id
  error.value = ''
  try {
    const arquivos = p.content.items.flatMap((i) => i.files)
    const unico = arquivos.length === 1 ? arquivos[0] : null
    if (unico) {
      await purchasesApi.download(p.content.id, unico.id, unico.fileName)
    } else {
      await purchasesApi.downloadAll(p.content.id)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao baixar o conteúdo.'
  } finally {
    downloadingId.value = null
  }
}

/** Data da compra por extenso — "4 de agosto de 2026". */
function purchaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
          <!-- Duas linhas (QA 2026-08-05): a data existia, mas era o terceiro
               item de uma fila de quatro separados por "·" e passava
               despercebida. Agora o QUE foi comprado fica em cima e o
               COMPROVANTE — quando e por quanto — em baixo, com rótulo. -->
          <p class="sub">{{ p.content.artist.name || 'Artista' }}</p>

          <!-- Uma categoria por linha, na cor dela, com a contagem de
               arquivos ao lado (2026-08-05, QA). Antes era uma fila
               "Partituras · Músicas · Cifras" em texto apagado: não dava para
               ver o que o pacote traz de cada tipo, e a contagem só existia
               nos botões de download, que agora são um só. -->
          <ul class="cats">
            <li v-for="item in p.content.items" :key="item.id" class="cat-row">
              <span class="category" :class="item.category.slug">{{ item.category.name }}</span>
              <span class="cat-count">
                {{ item.files.length }} {{ item.files.length === 1 ? 'arquivo' : 'arquivos' }}
              </span>
            </li>
          </ul>
          <p class="sub receipt">
            Comprado em
            <time :datetime="p.purchasedAt">{{ purchaseDate(p.purchasedAt) }}</time>
            · {{ formatPrice(p.amountCents) }}
          </p>
          <p v-if="p.status === 'pendente'" class="pending-badge">
            Aguardando confirmação do pagamento (Pix/boleto podem levar alguns minutos)
          </p>
        </div>

        <!-- Download não expira (spec §8). Só aparece com pagamento
             confirmado — enquanto 'pendente' (Pix/boleto), a API nega o
             download mesmo que o botão aparecesse (2026-07-20). -->
        <div v-if="p.status === 'pago'" class="dl-group">
          <button class="dl-btn" :disabled="downloadingId === p.id" @click="download(p)">
            {{ downloadingId === p.id ? 'Baixando…' : 'Baixar' }}
          </button>
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

// Linha do comprovante (quando e por quanto): um tom acima da anterior — é
// a informação procurada por quem volta a esta página meses depois.
.receipt {
  color: rgba(var(--fg-rgb), 0.72);
}

// Lista das categorias do pacote, uma por linha.
.cats {
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

// Mesma etiqueta colorida da vitrine e da página da obra (mixin global):
// a cor vem do slug da categoria, então o reconhecimento é o mesmo em
// todas as telas.
.category {
  @include category-tag;
}

.cat-count {
  font-size: 0.74rem;
  color: rgba(var(--fg-rgb), 0.5);
  font-variant-numeric: tabular-nums;
}

.pending-badge {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: $gold-text;
}

// Um botão só (antes era um por arquivo, e a coluna virava uma pilha).
.dl-group {
  flex-shrink: 0;
}

.dl-btn {
  @include block-button-primary;
  padding: 0.6rem 1.4rem;
  white-space: nowrap;
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
