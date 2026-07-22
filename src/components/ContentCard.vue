<script setup lang="ts">
import CategoryIcon from '@/components/CategoryIcon.vue'
import { fileUrl, formatPrice, type CategoryRef, type Musical } from '@/services/api'

// Obras são pacotes: `categories` são as tags do que o pacote inclui.
// `musical` (2026-07-22): obra de musical (data especial) ganha badge
// sobre a capa que a diferencia do conteúdo padrão.
defineProps<{
  id: number
  title: string
  priceCents: number
  coverPath: string | null
  categories: CategoryRef[]
  musical?: Musical | null
  artistId?: number
  artistName?: string | null
}>()
</script>

<template>
  <RouterLink :to="`/conteudo/${id}`" class="card" :class="{ 'is-musical': !!musical }">
    <div class="cover">
      <img v-if="coverPath" :src="fileUrl(coverPath) ?? undefined" :alt="title" />
      <span v-else class="cover-placeholder">🎵</span>
      <span v-if="musical" class="musical-badge">Musical · {{ musical.name }}</span>
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
  // 2026-07-22): baixa e espalhada, nunca dura. No conteúdo PADRÃO ela é
  // FIXA (sem efeito de hover — decisão do usuário); só o card de musical
  // aprofunda no hover. Sem translateY: o transform dos cards é do motion-v
  // (inline) e um transform de hover em CSS brigaria com ele.
  box-shadow: 0 14px 32px -18px rgba(0, 0, 0, 0.45);
  transition: background-color 0.5s $ease-brand, box-shadow 0.5s $ease-brand;

  &:hover {
    background: $fill-hover-solid;

    .title {
      color: $gold-text;
    }
  }

  // No tema escuro a sombra preta quase desaparece sobre o fundo #11100d:
  // a profundidade vem de um halo dourado bem fraco (também fixo).
  [data-theme='dark'] & {
    box-shadow:
      0 14px 32px -18px rgba(0, 0, 0, 0.8),
      0 10px 28px -16px rgba($color-primary, 0.18);
  }

  // Obra de MUSICAL: a sombra inteira vira o dourado da marca (pedido de
  // 2026-07-22) — é o segundo diferenciador do card, junto com o badge.
  &.is-musical {
    box-shadow: 0 14px 34px -16px rgba($color-primary, 0.45);

    &:hover {
      box-shadow:
        0 20px 46px -16px rgba($color-primary, 0.55),
        0 6px 18px -8px rgba($color-primary, 0.35);
    }
  }

  [data-theme='dark'] &.is-musical {
    box-shadow: 0 14px 34px -14px rgba($color-primary, 0.4);

    &:hover {
      box-shadow:
        0 20px 46px -14px rgba($color-primary, 0.6),
        0 6px 20px -8px rgba($color-primary, 0.4);
    }
  }

  // Capa do musical "respira": zoom em loop lento e fino (scale 1 → 1.06
  // em 9s, vai-e-volta), só transform (GPU). O recorte fica no .cover
  // (overflow) para o zoom não vazar sobre o corpo do card.
  &.is-musical .cover {
    overflow: hidden;

    img {
      animation: musical-breathe 9s ease-in-out infinite alternate;
      will-change: transform;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  }
}

@keyframes musical-breathe {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.06);
  }
}

.cover {
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

// Badge de MUSICAL sobre a capa: blocado no dourado da marca, fundo OPACO
// (mistura com o fundo do tema) para ler bem em cima da foto — mesmo
// padrão dos badges de status de Meus Conteúdos (guia §5/§8).
.musical-badge {
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
