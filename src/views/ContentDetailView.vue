<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useOwnedStore } from '@/stores/owned'
import { catalogApi, purchasesApi, fileUrl, formatPrice, type CatalogDetail } from '@/services/api'
import { usePageSeo } from '@/composables/useSeo'
import { substantivoDoArquivo } from '@/categoryKinds'
import { catHue } from '@/utils/categoryStyle'

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
//
// O substantivo saía de um mapa por slug, que só valia enquanto as categorias
// eram as quatro fixas. Agora vem da natureza e do nome que o admin deu
// (`substantivoDoArquivo`) — categoria nova entra com frase certa sem deploy.
const packageSummary = computed(() =>
  (content.value?.items ?? []).map((item) => {
    const n = item.files.length
    const noun = substantivoDoArquivo(item.category)
    return {
      slug: item.category.slug,
      icon: item.category.icon,
      hue: item.category.hue,
      text: `${n} ${n === 1 ? 'arquivo' : 'arquivos'} de ${noun}`,
    }
  }),
)

onMounted(async () => {
  owned.load() // garante que sabemos se o usuário já possui esta obra
  if (route.query.checkout === 'cancelado') {
    buyError.value = 'Pagamento cancelado. Você pode tentar novamente quando quiser.'
  }
  try {
    content.value = (await catalogApi.detail(String(route.params.id))).content
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos abrir esta obra agora. Tente de novo em instantes.'
  } finally {
    loading.value = false
  }
})

// ---- Compartilhar ------------------------------------------------------------
// As redes ficam SEMPRE visíveis, ao lado do rótulo, logo abaixo do título
// (2026-08-05, QA): antes o compartilhar era um botão dentro da caixa de
// compra e só abria o painel ao clicar — escondia a ação e competia com o
// "Comprar", que é o que a caixa existe para destacar.
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

// No celular vale usar o painel nativo (leva a lista de apps do aparelho);
// onde ele não existe, as redes ao lado já dão conta.
const hasNativeShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share)

async function shareNative() {
  try {
    await navigator.share({ title: content.value?.title, text: shareText.value, url: shareUrl.value })
  } catch {
    // usuário fechou o painel nativo — nada a fazer
  }
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
    buyError.value = err instanceof Error ? err.message : 'Não conseguimos abrir o pagamento agora. Tente de novo em instantes.'
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
        <div v-for="item in content.items" :key="item.category.slug" class="preview">
          <h3 class="preview-title">Prévia — {{ item.category.name }}</h3>
          <audio v-if="previewExt(item.previewPath) === 'mp3'" controls :src="fileUrl(item.previewPath) ?? undefined" />
          <video v-else-if="previewExt(item.previewPath) === 'mp4'" controls :src="fileUrl(item.previewPath) ?? undefined" />
          <iframe v-else-if="previewExt(item.previewPath) === 'pdf'" :src="fileUrl(item.previewPath) ?? undefined" class="pdf" />
          <img v-else-if="fileUrl(item.previewPath)" :src="fileUrl(item.previewPath)!" alt="Prévia" class="preview-img" />
        </div>
      </div>

      <div class="info">
        <span class="cat-tags">
          <span v-for="cat in content.categories" :key="cat.slug" class="category" :style="catHue(cat)">{{ cat.name }}</span>
        </span>
        <h1 class="title">{{ content.title }}</h1>
        <RouterLink :to="`/artistas/${content.artist.id}`" class="artist">
          por {{ content.artist.name || 'Artista' }}
        </RouterLink>

        <!-- Compartilhar logo abaixo do título: rótulo + redes na mesma linha,
             sempre visíveis (2026-08-05, QA). -->
        <div class="share">
          <span class="share-label">Compartilhar</span>
          <div class="share-links">
            <a class="share-item" :href="shareLinks.whatsapp" target="_blank" rel="noopener">WhatsApp</a>
            <a class="share-item" :href="shareLinks.facebook" target="_blank" rel="noopener">Facebook</a>
            <a class="share-item" :href="shareLinks.x" target="_blank" rel="noopener">X</a>
            <button type="button" class="share-item" :class="{ copied }" @click="copyLink">
              {{ copied ? 'Link copiado' : 'Copiar link' }}
            </button>
            <button v-if="hasNativeShare" type="button" class="share-item" @click="shareNative">
              Mais…
            </button>
          </div>
        </div>

        <p v-if="content.description" class="description">{{ content.description }}</p>

        <!-- Resumo do que o pacote inclui (arquivos por categoria) -->
        <div v-if="packageSummary.length" class="includes">
          <h2 class="includes-title">Este produto contém</h2>
          <ul class="includes-list">
            <li v-for="line in packageSummary" :key="line.slug">
              <CategoryIcon class="includes-icon" :style="catHue(line)" :icon="line.icon" :size="18" />
              <span>{{ line.text }}</span>
            </li>
          </ul>
        </div>

        <div v-if="content.subcategories.length" class="tags">
          <span v-for="sub in content.subcategories" :key="sub.id" class="tag">{{ sub.name }}</span>
        </div>

        <div class="buy-box">
          <p class="price">{{ formatPrice(content.priceCents) }}</p>
          <p v-if="isOwn" class="muted">Esta obra é sua.</p>
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
              Este artista ainda está preparando os recebimentos. Volte em breve.
            </p>
          </template>
          <p v-if="buyError" class="error small">{{ buyError }}</p>

          <p v-if="!isPurchased && !isOwn" class="muted small">
            Após a compra, o download fica disponível para sempre em "Minhas Compras".
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
// Respiro maior em toda a página (2026-08-05, QA): as duas colunas se
// afastam, e no celular — onde uma cai sob a outra — o vão precisa ser bem
// maior, senão a prévia encosta no título.
.detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3.5rem;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
}

// Imagens não levam borda nem radius (guia §3.6).
.cover {
  width: 100%;
  margin-bottom: 2.5rem;
}

// Uma prévia por categoria do pacote — elas se empilham e precisam de vão.
.preview + .preview {
  margin-top: 2.5rem;
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

// Sublinhado permanente (2026-08-05, QA): sem ele não se percebia que "por
// Fulano" leva à página do artista. O deslocamento afasta o traço das
// descidas das letras; a espessura fica discreta até o hover.
.artist {
  color: rgba(var(--fg-rgb), 0.7);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
  text-decoration-color: rgba(var(--fg-rgb), 0.35);
  transition:
    color 0.5s $ease-brand,
    text-decoration-color 0.5s $ease-brand;

  &:hover {
    color: $gold-text;
    text-decoration-color: currentColor;
  }
}

// Compartilhar: rótulo + redes na mesma linha, abaixo do título.
.share {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.share-label {
  @include label-type;
  font-size: 0.72rem;
  color: $text-secondary;
}

// Grupo blocado colado (guia §3): bordas de 1px sobrepostas pela margem.
.share-links {
  display: flex;
  flex-wrap: wrap;
}

.description {
  margin-top: 2rem;
  color: rgba(var(--fg-rgb), 0.75);
  white-space: pre-line;
}

// "Este produto contém": título de rótulo + lista com o ícone de cada
// categoria (na tinta dela, como nos cards) + a contagem de arquivos.
.includes {
  margin-top: 2.5rem;
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

}

// Tags como grupo blocado colado (guia §3): sem pílulas, bordas sobrepostas.
.tags {
  margin-top: 2rem;
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
  margin-top: 2.75rem;
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

// Cada rede é um chip do grupo blocado — sem `flex: 1` (elas não ocupam mais
// a largura da caixa de compra; agora convivem com o rótulo numa linha).
.share-item {
  @include block-chip;
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
