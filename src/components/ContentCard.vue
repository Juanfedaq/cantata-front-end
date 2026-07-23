<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { fileUrl, formatPrice, type CategoryRef, type Musical } from '@/services/api'
import { useSpotlightStore } from '@/stores/spotlight'
import { useOwnedStore } from '@/stores/owned'

// Obras são pacotes: `categories` são as tags do que o pacote inclui.
// `musical` (dado mantém o nome interno) = TEMA opcional da obra (Natal,
// Páscoa, …): quando existe, um selo discreto com o nome do tema aparece
// sobre a capa. Sem tratamento "premium" (sombra/animação) — 2026-07-23.
const props = defineProps<{
  id: number
  title: string
  priceCents: number
  coverPath: string | null
  categories: CategoryRef[]
  musical?: Musical | null
  artistId?: number
  artistName?: string | null
}>()

// Hover/foco publica a capa no fundo da página (CoverSpotlight): a imagem
// aparece grande em perspectiva lateral atrás do conteúdo. Sem capa, nada
// acontece. O unmount esconde (navegação com o mouse ainda sobre o card).
const spotlight = useSpotlightStore()

function spotlightShow() {
  const url = fileUrl(props.coverPath)
  if (url) spotlight.show(url)
}

onBeforeUnmount(() => spotlight.hide())

// Selo "Já adquirido": a store das compras é carregada uma vez (idempotente
// entre todos os cards) e diz se o usuário já possui esta obra.
const owned = useOwnedStore()
onMounted(() => owned.load())
const isOwned = computed(() => owned.owns(props.id))
</script>

<template>
  <RouterLink
    :to="`/conteudo/${id}`"
    class="card"
    @mouseenter="spotlightShow"
    @mouseleave="spotlight.hide()"
    @focusin="spotlightShow"
    @focusout="spotlight.hide()"
  >
    <div class="cover">
      <img v-if="coverPath" :src="fileUrl(coverPath) ?? undefined" :alt="title" />
      <span v-else class="cover-placeholder">🎵</span>
      <span v-if="musical" class="tema-badge">{{ musical.name }}</span>
      <span v-if="isOwned" class="owned-badge">Já adquirido</span>
    </div>
    <div class="body">
      <span class="tags">
        <span
          v-for="cat in categories"
          :key="cat.slug"
          class="category"
          :class="cat.slug"
          role="img"
          :aria-label="cat.name"
          :title="cat.name"
        >
          <CategoryIcon :slug="cat.slug" :size="18" />
        </span>
      </span>
      <h3 class="title">{{ title }}</h3>
      <p v-if="artistName" class="artist">{{ artistName }}</p>
      <p class="price">{{ formatPrice(priceCents) }}</p>
    </div>
  </RouterLink>
</template>

<style scoped lang="scss">
// Card blocado (guia §3/§6): moldura completa de 1px, sem radius.
// Hover só com preenchimento + título dourado (sem hover-arc — decisão
// de 2026-07-09: cards de produto e blocos de artista ficam sem o arco).
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid $line;
  overflow: hidden;
  text-decoration: none;
  color: $color-white;
  // Fundo opaco: o backdrop global de anéis não atravessa o card.
  background: $color-back;
  // Sombra difusa "premium" (exceção ao §8 do guia, registrada em
  // 2026-07-22): baixa e espalhada, nunca dura, FIXA (sem efeito no hover).
  // Sem translateY: o transform dos cards é do motion-v (inline) e um
  // transform de hover em CSS brigaria com ele.
  box-shadow: 0 14px 32px -18px rgba(0, 0, 0, 0.45);
  transition: background-color 0.5s $ease-brand, box-shadow 0.5s $ease-brand;

  &:hover {
    background: $fill-hover-solid;

    .title {
      color: $gold-text;
    }

    // Zoom suave da capa no hover (só transform/GPU; recorte pelo .cover).
    .cover img {
      transform: scale(1.06);
    }
  }

  // No tema escuro a sombra preta quase desaparece sobre o fundo #11100d:
  // a profundidade vem de um halo dourado bem fraco (também fixo).
  [data-theme='dark'] & {
    box-shadow:
      0 14px 32px -18px rgba(0, 0, 0, 0.8),
      0 10px 28px -16px rgba($color-primary, 0.18);
  }

  // Sem movimento: o hover não amplia a capa.
  @media (prefers-reduced-motion: reduce) {
    &:hover .cover img {
      transform: none;
    }
  }
}

.cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: rgba(var(--fg-rgb), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  // Recorta o zoom da capa (o card já tem overflow, mas o zoom não pode
  // vazar sobre o corpo — este overflow prende a imagem na área da capa).
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s $ease-brand;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
}

// Selo do TEMA sobre a capa: blocado no dourado da marca, fundo OPACO
// (mistura com o fundo do tema) para ler bem em cima da foto — mesmo
// padrão dos badges de status de Meus Conteúdos (guia §5/§8).
.tema-badge {
  @include label-type;
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  background: color-mix(in srgb, $color-primary 22%, rgb(var(--bg-rgb)));
  color: $gold-text;
}

// Selo "Já adquirido" (canto DIREITO): mesmo formato do selo do tema, mas
// na cor de sucesso (o usuário já possui esta obra). Fundo opaco p/ ler
// sobre a capa.
.owned-badge {
  @include label-type;
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  background: color-mix(in srgb, $color-success 24%, rgb(var(--bg-rgb)));
  color: $color-success;
}

.cover-placeholder {
  font-size: 2.5rem;
  opacity: 0.4;
}

.body {
  padding: 0.9rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

// Categorias do pacote: só o ícone na tinta da categoria (matiz fixa por
// slug, guia §5.1; lightness por tema via --cat-tag-l, como as tags
// antigas) — o nome fica no title/aria-label.
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.category {
  display: inline-flex;
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));

  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }
}

.title {
  font-family: $font-display;
  font-size: 1.05rem;
  font-weight: 600;
  transition: color 0.5s $ease-brand;
}

.artist {
  font-size: 0.85rem;
  color: $text-secondary;
}

// Preço é dado, não rótulo: sem uppercase (guia §5).
.price {
  margin-top: 0.35rem;
  font-weight: 600;
}
</style>
