<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import ContentCard from '@/components/ContentCard.vue'
import {
  catalogApi,
  type CatalogItem,
  type Category,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'

const route = useRoute()
const router = useRouter()

const categories = ref<Category[]>([])
const subcategories = ref<Subcategory[]>([])
const items = ref<CatalogItem[]>([])
const loading = ref(true)
const error = ref('')

const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const q = ref('')
const selectedCategory = ref<string>((route.query.categoria as string) || '')
const selectedSubs = ref<number[]>([])

const SUB_TYPE_LABELS: Record<SubcategoryType, string> = {
  instrumento: 'Instrumento',
  genero: 'Gênero',
  dificuldade: 'Dificuldade',
}

const subsByType = computed(() => {
  const groups: { type: SubcategoryType; label: string; items: Subcategory[] }[] = []
  for (const type of ['instrumento', 'genero', 'dificuldade'] as SubcategoryType[]) {
    const list = subcategories.value.filter((s) => s.type === type)
    if (list.length) groups.push({ type, label: SUB_TYPE_LABELS[type], items: list })
  }
  return groups
})

async function fetchItems() {
  loading.value = true
  error.value = ''
  try {
    const res = await catalogApi.list({
      page: page.value,
      perPage: 12,
      category: selectedCategory.value || undefined,
      subcategories: selectedSubs.value,
      q: q.value || undefined,
    })
    items.value = res.items
    totalPages.value = res.totalPages
    total.value = res.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar o catálogo.'
  } finally {
    loading.value = false
  }
}

function toggleSub(id: number) {
  const idx = selectedSubs.value.indexOf(id)
  if (idx >= 0) selectedSubs.value.splice(idx, 1)
  else selectedSubs.value.push(id)
}

function selectCategory(slug: string) {
  selectedCategory.value = selectedCategory.value === slug ? '' : slug
  router.replace({ query: selectedCategory.value ? { categoria: selectedCategory.value } : {} })
}

// Filtros/busca voltam à página 1 e recarregam.
watch([selectedCategory, selectedSubs, q], () => {
  page.value = 1
  fetchItems()
}, { deep: true })

watch(page, fetchItems)

onMounted(async () => {
  try {
    const cats = await catalogApi.categories()
    categories.value = cats.categories
    subcategories.value = cats.subcategories
  } catch {
    // Filtros indisponíveis não impedem a listagem.
  }
  fetchItems()
})
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Biblioteca</h1>

    <!-- Busca + filtro de categoria -->
    <div class="toolbar">
      <input v-model.lazy="q" type="search" class="search" placeholder="Buscar por título ou artista…" />
      <div class="chips">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="chip"
          :class="{ active: selectedCategory === cat.slug }"
          @click="selectCategory(cat.slug)"
        >
          {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- Filtros por subcategoria -->
    <div v-for="group in subsByType" :key="group.type" class="sub-group">
      <span class="sub-label">{{ group.label }}:</span>
      <button
        v-for="sub in group.items"
        :key="sub.id"
        class="chip small"
        :class="{ active: selectedSubs.includes(sub.id) }"
        @click="toggleSub(sub.id)"
      >
        {{ sub.name }}
      </button>
    </div>

    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!items.length" class="muted">Nenhum conteúdo encontrado com esses filtros.</p>

    <div v-else class="grid">
      <ContentCard
        v-for="item in items"
        :key="item.id"
        :id="item.id"
        :title="item.title"
        :price-cents="item.priceCents"
        :cover-path="item.coverPath"
        :categories="item.categories"
        :artist-name="item.artist.name"
      />
    </div>

    <!-- Paginação tradicional (decisão registrada no PROGRESS.md) -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="page--">← Anterior</button>
      <span class="muted">Página {{ page }} de {{ totalPages }} ({{ total }} itens)</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="page++">Próxima →</button>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

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

// Grupo blocado (guia §3): chips colados, sem pílulas; bordas de 1px
// sobrepostas pelo mixin block-chip.
.chips {
  display: flex;
  flex-wrap: wrap;
}

.chip {
  @include block-chip;

  &.small {
    padding: 0.4rem 0.85rem;
    font-size: 0.7rem;
  }
}

// Chips diretos no contêiner: sem gap (colados); o respiro fica só
// entre o rótulo e o grupo (guia §3.3).
.sub-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.sub-label {
  @include label-type;
  font-size: 0.7rem;
  color: $text-dim;
  min-width: 90px;
  margin-right: 1rem;
}

.grid {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

.pagination {
  margin-top: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.page-btn {
  @include block-button;
  padding: 0.6rem 1.2rem;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
}
</style>
