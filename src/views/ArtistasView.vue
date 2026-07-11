<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { artistsApi, catalogApi, type ArtistSummary, type Category } from '@/services/api'
import { artistHue } from '@/utils/avatar'

const artists = ref<ArtistSummary[]>([])
const loading = ref(true)
const error = ref('')

// Filtros: busca em nome/bio, categoria com obra aprovada e ordenação.
const categories = ref<Category[]>([])
const q = ref('')
const selectedCategory = ref('')
const order = ref<'' | 'recentes' | 'nome'>('') // '' = mais publicados (padrão)

const ORDER_OPTIONS = [
  { value: '', label: 'Mais publicados' },
  { value: 'recentes', label: 'Recentes' },
  { value: 'nome', label: 'Nome A–Z' },
] as const

async function fetchArtists() {
  loading.value = true
  error.value = ''
  try {
    artists.value = (
      await artistsApi.list({
        q: q.value || undefined,
        categoria: selectedCategory.value || undefined,
        order: order.value || undefined,
      })
    ).artists
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao listar os artistas.'
  } finally {
    loading.value = false
  }
}

function selectCategory(slug: string) {
  selectedCategory.value = selectedCategory.value === slug ? '' : slug
}

watch([q, selectedCategory, order], fetchArtists)

onMounted(async () => {
  try {
    categories.value = (await catalogApi.categories()).categories
  } catch {
    // Sem categorias, a busca e a ordenação seguem funcionando.
  }
  fetchArtists()
})
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Artistas</h1>

    <!-- Busca + filtro por categoria publicada (mesma gramática da
         Biblioteca: chips com ícone, "Todos" limpa o filtro) -->
    <div class="toolbar">
      <input v-model.lazy="q" type="search" class="search" placeholder="Buscar por nome ou bio…" />
      <div class="chips">
        <button class="chip" :class="{ active: selectedCategory === '' }" @click="selectCategory('')">
          <CategoryIcon class="chip-icon" slug="todos" :size="16" />
          Todos
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="chip"
          :class="[cat.slug, { active: selectedCategory === cat.slug }]"
          @click="selectCategory(cat.slug)"
        >
          <CategoryIcon class="chip-icon" :slug="cat.slug" :size="16" />
          {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- Ordenação -->
    <div class="sub-group">
      <span class="sub-label">Ordenar:</span>
      <button
        v-for="opt in ORDER_OPTIONS"
        :key="opt.value"
        class="chip small"
        :class="{ active: order === opt.value }"
        @click="order = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!artists.length" class="muted">Nenhum artista encontrado com esses filtros.</p>

    <div v-else class="grid">
      <RouterLink
        v-for="artist in artists"
        :key="artist.id"
        :to="`/artistas/${artist.id}`"
        class="card"
        :style="{ '--artist-hue': artistHue(artist.name) }"
      >
        <!-- Palco: mesmo bloco da home — avatar e ondas no centro exato,
             nome na base. -->
        <div class="hero">
          <span class="waves" aria-hidden="true">
            <span v-for="n in 16" :key="n" class="wave" :class="`wave-${n}`"></span>
          </span>
          <ArtistAvatar class="avatar" :name="artist.name" :avatar-path="artist.avatarPath" :size="88" />
          <h3 class="name">{{ artist.name || 'Artista' }}</h3>
        </div>

        <!-- Box de dados: bio + contagem, separado por linha de 1px. -->
        <div class="meta">
          <p v-if="artist.bio" class="bio">{{ artist.bio }}</p>
          <span class="count">{{ artist.publishedCount }} conteúdo(s) publicado(s)</span>
        </div>
      </RouterLink>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

// Toolbar de filtros: mesma gramática da Biblioteca (busca blocada +
// chips de categoria com ícone + ordenação em chips pequenos).
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.search {
  @include block-input;
  flex: 1;
  min-width: 220px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
}

.chip {
  @include block-chip;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  // Fundo opaco: o backdrop de anéis não atravessa (como na Biblioteca).
  background: $color-back;

  &.active {
    background: $fill-active-solid;
  }

  &.small {
    padding: 0.4rem 0.85rem;
    font-size: 0.7rem;
  }

  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }
}

.chip-icon {
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));
  flex-shrink: 0;
}

.sub-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.sub-label {
  @include label-type;
  font-size: 0.7rem;
  color: $text-dim;
  min-width: 90px;
  margin-right: 1rem;
}

// Cards soltos com um respiro curto entre eles (deixaram de ser colados
// em 2026-07-11); cada card mantém a própria moldura completa de 1px.
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

// Card blocado (guia §3) em duas zonas: o "palco" (mesmo bloco de artista
// da home — avatar e ondas no centro exato, nome na base) e o box de dados
// (bio + contagem) separado por linha de 1px. Fundo tintado pela cor do
// nome (--artist-hue).
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid $line;
  color: $color-white;
  text-decoration: none;
  text-align: center;
  // Tinta do artista em versão opaca (mistura com o fundo): o backdrop
  // global de anéis não atravessa o bloco.
  background: color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 7%, rgb(var(--bg-rgb)));
  transition: background-color 0.5s $ease-brand;
  // Sem gesto global de hover (2026-07-09): a onda sonora dos anéis já é
  // o gesto do hover destes blocos.

  &:hover {
    background: color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 13%, rgb(var(--bg-rgb)));

    .name {
      color: $gold-text;
    }

    .avatar {
      transform: translate(-50%, -50%) scale(1.08);
    }

    .wave {
      animation: sound-wave 1.8s $ease-brand infinite;
    }
  }
}

// Palco de altura fixa, como na home: avatar de 88px no centro exato,
// ondas no mesmo centro, nome ancorado na base. O overflow recorta as
// ondas DENTRO do palco — elas não invadem o box de dados.
.hero {
  position: relative;
  display: block;
  height: 200px;
  overflow: hidden;

  // Anéis no mesmo centro do avatar (50% = centro do palco).
  @include artist-waves(88px, 50%);
}

// Cresce um pouco no hover — como é absoluto e o nome é ancorado à base,
// nada se desloca.
.avatar {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  transition: transform 0.5s $ease-brand;
}

.name {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 1.1rem;
  margin: 0;
  font-family: $font-display;
  font-size: 1.15rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.5s $ease-brand;
}

// Box de dados: separado do palco por linha de 1px, mesma gramática
// blocada do resto do sistema.
.meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem 1.25rem 1.1rem;
  border-top: 1px solid $line;
}

.bio {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(var(--fg-rgb), 0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.count {
  @include label-type;
  font-size: 0.68rem;
  color: $gold-text;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
}
</style>
