<script setup lang="ts">
// Preview AO VIVO do card enquanto o artista preenche o assistente de
// publicação (ContentUploadView). Espelha o visual do ContentCard da
// Biblioteca, mas é ESTÁTICO (sem link, hover-spotlight ou selo de compra)
// e mostra placeholders quando os campos ainda estão vazios.
import CategoryIcon from '@/components/CategoryIcon.vue'
import { formatPrice, type CategoryRef } from '@/services/api'

defineProps<{
  title: string
  priceCents: number | null
  coverUrl: string | null
  categories: CategoryRef[]
  musicalName: string | null
  artistName: string | null
}>()
</script>

<template>
  <div class="pcard" aria-hidden="true">
    <div class="pcover">
      <img v-if="coverUrl" :src="coverUrl" alt="" />
      <span v-else class="pcover-ph">🎵</span>
      <span v-if="musicalName" class="ptema">{{ musicalName }}</span>
    </div>
    <div class="pbody">
      <span class="ptags">
        <span v-for="cat in categories" :key="cat.slug" class="pcat" :class="cat.slug">
          <CategoryIcon :slug="cat.slug" :size="18" />
        </span>
      </span>
      <h3 class="ptitle" :class="{ placeholder: !title }">{{ title || 'Título da obra' }}</h3>
      <p v-if="artistName" class="partist">{{ artistName }}</p>
      <p class="pprice" :class="{ placeholder: !priceCents }">
        {{ priceCents ? formatPrice(priceCents) : 'R$ —' }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Mesma linguagem do ContentCard: moldura 1px, sem radius, sombra difusa,
// capa 4:3, ícones de categoria coloridos, título serifado, preço.
.pcard {
  display: flex;
  flex-direction: column;
  border: 1px solid $line;
  overflow: hidden;
  background: $color-back;
  box-shadow: 0 14px 32px -18px rgba(0, 0, 0, 0.45);

  [data-theme='dark'] & {
    box-shadow:
      0 14px 32px -18px rgba(0, 0, 0, 0.8),
      0 10px 28px -16px rgba($color-primary, 0.18);
  }
}

.pcover {
  position: relative;
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

.pcover-ph {
  font-size: 2.5rem;
  opacity: 0.4;
}

// Selo do tema (canto sup. esquerdo) — igual ao ContentCard.
.ptema {
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

.pbody {
  padding: 0.9rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ptags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
  min-height: 18px; // reserva espaço mesmo sem categorias ainda
}

// Ícone na tinta da categoria (mesma disciplina dos cards, §5.1).
.pcat {
  display: inline-flex;
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));

  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }
}

.ptitle {
  font-family: $font-display;
  font-size: 1.05rem;
  font-weight: 600;

  &.placeholder {
    color: $text-dim;
  }
}

.partist {
  font-size: 0.85rem;
  color: $text-secondary;
}

.pprice {
  margin-top: 0.35rem;
  font-weight: 600;

  &.placeholder {
    color: $text-dim;
  }
}
</style>
