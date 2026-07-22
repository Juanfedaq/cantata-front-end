<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { motion, MotionConfig } from 'motion-v'
import AppLayout from '@/components/AppLayout.vue'
import ContentCard from '@/components/ContentCard.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import {
  catalogApi,
  type CatalogItem,
  type Category,
  type Musical,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'

const route = useRoute()
const router = useRouter()

// Card animável (motion.create repassa props/attrs — estilo intacto).
const MotionContentCard = motion.create(ContentCard)

// Mesma entrada da Home: véu + subida no easing da marca ao entrar na
// tela (uma vez). `delay` escalona os cards; `y` menor em itens pequenos.
const easeBrand = [0.22, 1, 0.36, 1]
function rise(delay = 0, y = 24) {
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true },
    transition: { duration: 0.7, ease: easeBrand, delay },
  }
}

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

// Musicais (2026-07-22): classificação ACIMA das categorias — aba
// Todos × Conteúdo padrão × Musicais; dentro de Musicais, filtro pela
// data especial (Natal, Dia das Mães, …). Ambos sincronizados na URL
// (?tipo= / ?musical=) como o filtro de categoria.
const musicals = ref<Musical[]>([])
type Tipo = '' | 'padrao' | 'musical'
const selectedTipo = ref<Tipo>(
  route.query.musical
    ? 'musical'
    : ['padrao', 'musical'].includes(String(route.query.tipo))
      ? (String(route.query.tipo) as Tipo)
      : '',
)
const selectedMusical = ref<number | null>(
  Number.isInteger(Number(route.query.musical)) && Number(route.query.musical) > 0
    ? Number(route.query.musical)
    : null,
)

/** Espelha os filtros compartilháveis (categoria/tipo/musical) na URL. */
function syncQuery() {
  const query: Record<string, string> = {}
  if (selectedCategory.value) query.categoria = selectedCategory.value
  if (selectedTipo.value) query.tipo = selectedTipo.value
  if (selectedTipo.value === 'musical' && selectedMusical.value) {
    query.musical = String(selectedMusical.value)
  }
  router.replace({ query })
}

function selectTipo(tipo: Tipo) {
  selectedTipo.value = tipo
  if (tipo !== 'musical') selectedMusical.value = null
  syncQuery()
}

function selectMusical(id: number) {
  selectedMusical.value = selectedMusical.value === id ? null : id
  syncQuery()
}

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
      tipo: selectedTipo.value || undefined,
      musical: selectedTipo.value === 'musical' ? selectedMusical.value ?? undefined : undefined,
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
  syncQuery()
}

// Filtros/busca voltam à página 1 e recarregam.
watch([selectedCategory, selectedSubs, q, selectedTipo, selectedMusical], () => {
  page.value = 1
  fetchItems()
}, { deep: true })

watch(page, fetchItems)

onMounted(async () => {
  try {
    const cats = await catalogApi.categories()
    categories.value = cats.categories
    subcategories.value = cats.subcategories
    musicals.value = cats.musicals
  } catch {
    // Filtros indisponíveis não impedem a listagem.
  }
  fetchItems()
})
</script>

<template>
  <AppLayout>
    <!-- Entradas com motion-v (mesma linguagem da Home): título, toolbar e
         grupos de filtro sobem em cascata; cards do grid escalonam e, nas
         trocas de filtro, os que permanecem deslizam para a nova posição
         (layout). reduced-motion="user" respeita prefers-reduced-motion. -->
    <MotionConfig reduced-motion="user">
      <motion.h1 class="page-title" v-bind="rise()">Biblioteca</motion.h1>

      <!-- Busca + filtro de categoria -->
      <motion.div class="toolbar" v-bind="rise(0.08)">
        <input v-model.lazy="q" type="search" class="search" placeholder="Buscar por título ou artista…" />
        <div class="chips">
          <!-- "Todos" limpa o filtro de categoria (ativo quando nenhum slug
               está selecionado); o ícone é a nota genérica do CategoryIcon. -->
          <button
            class="chip"
            :class="{ active: selectedCategory === '' }"
            @click="selectCategory('')"
          >
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
      </motion.div>

      <!-- Tipo de conteúdo (acima das categorias): padrão × musicais -->
      <motion.div class="sub-group" v-bind="rise(0.11)">
        <span class="sub-label">Tipo:</span>
        <button
          class="chip small"
          :class="{ active: selectedTipo === '' }"
          @click="selectTipo('')"
        >
          Todos
        </button>
        <button
          class="chip small"
          :class="{ active: selectedTipo === 'padrao' }"
          @click="selectTipo('padrao')"
        >
          Conteúdo padrão
        </button>
        <button
          class="chip small"
          :class="{ active: selectedTipo === 'musical' }"
          @click="selectTipo('musical')"
        >
          Musicais
        </button>
      </motion.div>

      <!-- Dentro de Musicais: filtro pela data especial -->
      <motion.div v-if="selectedTipo === 'musical' && musicals.length" class="sub-group" v-bind="rise(0.13)">
        <span class="sub-label">Musical:</span>
        <button
          v-for="m in musicals"
          :key="m.id"
          class="chip small"
          :class="{ active: selectedMusical === m.id }"
          @click="selectMusical(m.id)"
        >
          {{ m.name }}
        </button>
      </motion.div>

      <!-- Filtros por subcategoria -->
      <motion.div
        v-for="(group, gi) in subsByType"
        :key="group.type"
        class="sub-group"
        v-bind="rise(0.14 + gi * 0.06)"
      >
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
      </motion.div>

      <p v-if="loading" class="muted">Carregando…</p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <p v-else-if="!items.length" class="muted">Nenhum conteúdo encontrado com esses filtros.</p>

      <div v-else class="grid">
        <MotionContentCard
          v-for="(item, i) in items"
          :key="item.id"
          :id="item.id"
          :title="item.title"
          :price-cents="item.priceCents"
          :cover-path="item.coverPath"
          :categories="item.categories"
          :musical="item.musical"
          :artist-name="item.artist.name"
          :layout="true"
          v-bind="rise(i * 0.05, 18)"
        />
      </div>

      <!-- Paginação tradicional (decisão registrada no PROGRESS.md) -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="page <= 1" @click="page--">← Anterior</button>
        <span class="muted">Página {{ page }} de {{ totalPages }} ({{ total }} itens)</span>
        <button class="page-btn" :disabled="page >= totalPages" @click="page++">Próxima →</button>
      </div>
    </MotionConfig>
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
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  // Fundo OPACO (o mixin deixa transparente e o backdrop de anéis
  // atravessava): mesmo tom do fundo; ativo usa a versão sólida do fill.
  background: $color-back;

  &.active {
    background: $fill-active-solid;
  }

  &.small {
    padding: 0.4rem 0.85rem;
    font-size: 0.7rem;
  }

  // Matiz da categoria para o ícone do chip (mesma disciplina dos cards).
  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }
}

// Ícone na tinta da categoria (lightness por tema, como as tags); o chip
// "Todos" fica sem slug e cai na matiz padrão dourada.
.chip-icon {
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));
  flex-shrink: 0;
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
