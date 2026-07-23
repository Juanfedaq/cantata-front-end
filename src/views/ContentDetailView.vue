<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useOwnedStore } from '@/stores/owned'
import { catalogApi, purchasesApi, fileUrl, formatPrice, type CatalogDetail } from '@/services/api'
import { usePageSeo } from '@/composables/useSeo'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const owned = useOwnedStore()

const content = ref<CatalogDetail | null>(null)

// SEO: quando a obra carrega, o <head> passa a refletir título, descrição
// e capa reais (compartilhamento e indexação da página da partitura).
usePageSeo({
  title: computed(() => content.value?.title ?? null),
  description: computed(() => {
    const c = content.value
    if (!c) return null
    return (
      c.description ??
      `Partitura de ${c.artist.name ?? 'artista do Cantata'} — publique, descubra e adquira música escrita no Cantata.`
    )
  }),
  image: computed(() => fileUrl(content.value?.coverPath)),
})
const loading = ref(true)
const error = ref('')
const buying = ref(false)
const buyError = ref('')

// Obras são pacotes: cada item (categoria) tem a própria prévia.
function previewExt(path: string) {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

// Autor da obra (não comprou — é dele) × comprador que já ADQUIRIU (tem
// compra paga; dado da tabela purchases, via a store owned). Quando já
// adquiriu, some o "Comprar" e entra o link para "Minhas Compras".
const isOwn = computed(() => !!auth.user && content.value?.artist.id === auth.user.id)
const isPurchased = computed(() => !!content.value && owned.owns(content.value.id))

// Resumo "Este produto contém": conta os arquivos por categoria e descreve
// pelo tipo de arquivo (áudio/vídeo) ou pelo nome da categoria (partitura/
// cifra). Ex.: "2 arquivos de áudio", "1 arquivo de cifra".
const CATEGORY_FILE_NOUN: Record<string, string> = {
  partituras: 'partitura',
  musicas: 'áudio',
  cifras: 'cifra',
  coreografias: 'vídeo',
}

const packageSummary = computed(() =>
  (content.value?.items ?? [])
    .map((item) => {
      const n = item.files.length
      const noun = CATEGORY_FILE_NOUN[item.category.slug] ?? item.category.name.toLowerCase()
      return { slug: item.category.slug, text: `${n} ${n === 1 ? 'arquivo' : 'arquivos'} de ${noun}` }
    })
    .filter((s) => s.text),
)

onMounted(async () => {
  owned.load() // garante que sabemos se o usuário já possui esta obra
  if (route.query.checkout === 'cancelado') {
    buyError.value = 'Pagamento cancelado. Você pode tentar novamente quando quiser.'
  }
  try {
    content.value = (await catalogApi.detail(String(route.params.id))).content
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar o conteúdo.'
  } finally {
    loading.value = false
  }
})

// ---- Compartilhar ------------------------------------------------------------
// Celular (e navegadores com Web Share API): painel NATIVO do sistema.
// Desktop sem a API: mini painel blocado com redes + copiar link.
const shareOpen = ref(false)
const copied = ref(false)

const shareUrl = computed(() =>
  typeof window === 'undefined'
    ? ''
    : `${window.location.origin}/conteudo/${content.value?.id ?? route.params.id}`,
)

const shareText = computed(() =>
  content.value
    ? `${content.value.title} — ${content.value.artist.name ?? 'artista'} no Cantata`
    : 'Cantata',
)

const shareLinks = computed(() => {
  const url = encodeURIComponent(shareUrl.value)
  const text = encodeURIComponent(shareText.value)
  return {
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
  }
})

async function share() {
  if (navigator.share) {
    try {
      await navigator.share({ title: content.value?.title, text: shareText.value, url: shareUrl.value })
    } catch {
      // usuário fechou o painel nativo — nada a fazer
    }
    return
  }
  shareOpen.value = !shareOpen.value
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // clipboard indisponível (contexto inseguro) — o usuário ainda tem as redes
  }
}

async function buy() {
  if (!content.value) return
  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  buying.value = true
  buyError.value = ''
  try {
    const { url } = await purchasesApi.checkout(content.value.id)
    window.location.href = url // redireciona para o Checkout do Stripe
  } catch (err) {
    buyError.value = err instanceof Error ? err.message : 'Erro ao iniciar o pagamento.'
    buying.value = false
  }
}
</script>

<template>
  <AppLayout>
    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else-if="content" class="detail">
      <div class="media">
        <img
          v-if="content.coverPath"
          :src="fileUrl(content.coverPath) ?? undefined"
          :alt="content.title"
          class="cover"
        />

        <!-- Preview limitado (spec §5.4) — os arquivos completos só após a
             compra. Uma prévia por item do pacote. -->
        <div v-for="item in content.items" :key="item.id" class="preview">
          <h3 class="preview-title">Prévia — {{ item.category.name }}</h3>
          <audio v-if="previewExt(item.previewPath) === 'mp3'" controls :src="fileUrl(item.previewPath) ?? undefined" />
          <video v-else-if="previewExt(item.previewPath) === 'mp4'" controls :src="fileUrl(item.previewPath) ?? undefined" />
          <iframe v-else-if="previewExt(item.previewPath) === 'pdf'" :src="fileUrl(item.previewPath) ?? undefined" class="pdf" />
          <img v-else-if="fileUrl(item.previewPath)" :src="fileUrl(item.previewPath)!" alt="Prévia" class="preview-img" />
        </div>
      </div>

      <div class="info">
        <span class="cat-tags">
          <span v-for="cat in content.categories" :key="cat.slug" class="category" :class="cat.slug">{{ cat.name }}</span>
        </span>
        <h1 class="title">{{ content.title }}</h1>
        <RouterLink :to="`/artistas/${content.artist.id}`" class="artist">
          por {{ content.artist.name || 'Artista' }}
        </RouterLink>

        <p v-if="content.description" class="description">{{ content.description }}</p>

        <!-- Resumo do que o pacote inclui (arquivos por categoria) -->
        <div v-if="packageSummary.length" class="includes">
          <h2 class="includes-title">Este produto contém</h2>
          <ul class="includes-list">
            <li v-for="line in packageSummary" :key="line.slug">
              <CategoryIcon class="includes-icon" :class="line.slug" :slug="line.slug" :size="18" />
              <span>{{ line.text }}</span>
            </li>
          </ul>
        </div>

        <div v-if="content.subcategories.length" class="tags">
          <span v-for="sub in content.subcategories" :key="sub.id" class="tag">{{ sub.name }}</span>
        </div>

        <div class="buy-box">
          <p class="price">{{ formatPrice(content.priceCents) }}</p>
          <p v-if="isOwn" class="muted">Este conteúdo é seu.</p>
          <!-- Já adquirido: sem "Comprar" — leva a Minhas Compras p/ baixar -->
          <template v-else-if="isPurchased">
            <p class="owned-note">✓ Você já adquiriu este conteúdo.</p>
            <RouterLink to="/compras" class="buy-btn">Ver em Minhas Compras</RouterLink>
          </template>
          <template v-else>
            <button class="buy-btn" :disabled="buying || !content.purchasable" @click="buy">
              {{ buying ? 'Redirecionando…' : 'Comprar' }}
            </button>
            <p v-if="!content.purchasable" class="muted small">
              Compra temporariamente indisponível para este artista.
            </p>
          </template>
          <p v-if="buyError" class="error small">{{ buyError }}</p>

          <!-- Compartilhar: nativo no celular; painel blocado no desktop -->
          <button class="share-btn" @click="share">Compartilhar</button>
          <div v-if="shareOpen" class="share-panel">
            <a class="share-item" :href="shareLinks.whatsapp" target="_blank" rel="noopener">WhatsApp</a>
            <a class="share-item" :href="shareLinks.facebook" target="_blank" rel="noopener">Facebook</a>
            <a class="share-item" :href="shareLinks.x" target="_blank" rel="noopener">X</a>
            <button class="share-item" :class="{ copied }" @click="copyLink">
              {{ copied ? 'Link copiado!' : 'Copiar link' }}
            </button>
          </div>

          <p v-if="!isPurchased && !isOwn" class="muted small">
            Após a compra, o download fica disponível para sempre em "Minhas Compras".
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

// Imagens não levam borda nem radius (guia §3.6).
.cover {
  width: 100%;
  margin-bottom: 1.5rem;
}

.preview-title {
  font-family: $font-display;
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.preview audio,
.preview video,
.preview .pdf,
.preview-img {
  width: 100%;
}

.pdf {
  height: 420px;
  border: 1px solid $line;
  background: $fill-active;
}

// Tags das categorias do pacote: chips com cor por categoria (mixin global).
.cat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.category {
  @include category-tag;
  font-size: 0.64rem;
  padding: 0.3rem 0.65rem;
}

.title {
  font-family: $font-display;
  font-size: 2rem;
  margin: 0.4rem 0;
}

.artist {
  color: rgba(var(--fg-rgb), 0.7);
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $gold-text;
  }
}

.description {
  margin-top: 1.25rem;
  color: rgba(var(--fg-rgb), 0.75);
  white-space: pre-line;
}

// "Este produto contém": título de rótulo + lista com o ícone de cada
// categoria (na tinta dela, como nos cards) + a contagem de arquivos.
.includes {
  margin-top: 1.5rem;
}

.includes-title {
  @include label-type;
  font-size: 0.72rem;
  color: $text-secondary;
  margin-bottom: 0.6rem;
}

.includes-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: rgba(var(--fg-rgb), 0.85);
  }
}

// Ícone na tinta da categoria (mesma disciplina dos cards, §5.1).
.includes-icon {
  flex-shrink: 0;
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));

  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }
}

// Tags como grupo blocado colado (guia §3): sem pílulas, bordas sobrepostas.
.tags {
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
}

.tag {
  @include label-type;
  font-size: 0.68rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid $line;
  margin: 0 -1px -1px 0;
  color: $text-secondary;
}

// Bloco solto na página: moldura completa de 1px (guia §3.4).
.buy-box {
  margin-top: 2rem;
  padding: 1.75rem;
  border: 1px solid $line;
}

// Preço é dado: sem uppercase (guia §5).
.price {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

// Aviso "já adquirido" acima do botão de Minhas Compras (cor de sucesso).
.owned-note {
  margin-bottom: 0.75rem;
  color: $color-success;
  font-weight: 600;
}

.buy-btn {
  @include block-button-primary;
  width: 100%;
}

// Compartilhar: botão secundário blocado sob o Comprar.
.share-btn {
  @include block-button;
  width: 100%;
  margin-top: 0.75rem;
}

// Mini painel de redes: grupo blocado colado (guia §3), itens lado a lado.
.share-panel {
  display: flex;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.share-item {
  @include block-chip;
  flex: 1;
  text-align: center;
  text-decoration: none;
  font-size: 0.68rem;
  white-space: nowrap;

  &.copied {
    color: $gold-text;
    background: $fill-active;
  }
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.small {
  font-size: 0.82rem;
  margin-top: 0.6rem;
}

.error {
  color: $color-error;
}
</style>
