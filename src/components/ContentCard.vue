<script setup lang="ts">
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
        <span v-for="cat in categories" :key="cat.slug" class="category" :class="cat.slug">{{ cat.name }}</span>
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

// Tags das categorias do pacote: chips blocados com cor por categoria
// (mixin global category-tag — matiz fixa por slug, guia §5.1).
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.2rem;
}

.category {
  @include category-tag;
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
