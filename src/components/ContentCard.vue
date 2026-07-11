<script setup lang="ts">
import CategoryIcon from '@/components/CategoryIcon.vue'
import { fileUrl, formatPrice, type CategoryRef } from '@/services/api'

// Obras são pacotes: `categories` são as tags do que o pacote inclui.
defineProps<{
  id: number
  title: string
  priceCents: number
  coverPath: string | null
  categories: CategoryRef[]
  artistId?: number
  artistName?: string | null
}>()
</script>

<template>
  <RouterLink :to="`/conteudo/${id}`" class="card">
    <div class="cover">
      <img v-if="coverPath" :src="fileUrl(coverPath) ?? undefined" :alt="title" />
      <span v-else class="cover-placeholder">🎵</span>
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
  transition: background-color 0.5s $ease-brand;

  &:hover {
    background: $fill-hover-solid;

    .title {
      color: $gold-text;
    }
  }
}

.cover {
  aspect-ratio: 4 / 3;
  background: rgba(var(--fg-rgb), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
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
