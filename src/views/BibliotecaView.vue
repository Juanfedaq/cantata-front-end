<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
// Filtro ACUMULATIVO (2026-07-22): várias categorias ao mesmo tempo (OR
// entre elas — o pacote contém qualquer uma); "Musicais" entra na mesma
// linha como se fosse categoria (restringe junto: categorias E musical).
const selectedCategories = ref<string[]>(
  String(route.query.categoria || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const selectedSubs = ref<number[]>([])

// Ordenação (2026-07-22): dropdown "Ordenar por…" PERSONALIZADO na linha
// dos chips (painel blocado, mesmo padrão do menu do usuário no header).
// Vazio = padrão do backend (mais recentes). Espelhada na URL (?ordem=).
type Order = '' | 'titulo-az' | 'titulo-za' | 'recentes' | 'preco-desc' | 'preco-asc'
const ORDER_OPTIONS: { value: Order; label: string }[] = [
  { value: 'titulo-az', label: 'A–Z' },
  { value: 'titulo-za', label: 'Z–A' },
  { value: 'recentes', label: 'Data (mais recentes)' },
  { value: 'preco-desc', label: 'Preço: maior → menor' },
  { value: 'preco-asc', label: 'Preço: menor → maior' },
]
const order = ref<Order>(
  ORDER_OPTIONS.some((o) => o.value === route.query.ordem)
    ? (String(route.query.ordem) as Order)
    : '',
)
const orderOpen = ref(false)
const orderRef = ref<HTMLElement | null>(null)

const orderLabel = computed(
  () => ORDER_OPTIONS.find((o) => o.value === order.value)?.label ?? 'Ordenar por…',
)

function pickOrder(value: Order) {
  order.value = value
  orderOpen.value = false
}

// Fecha em clique-fora (pointerdown — ver lição do dropdown do header no
// PROGRESS.md: item que re-renderiza no clique falha o contains no click)
// e em Escape.
function onDocPointerDown(e: PointerEvent) {
  if (orderOpen.value && !orderRef.value?.contains(e.target as Node)) orderOpen.value = false
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') orderOpen.value = false
}

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

/** Espelha os filtros compartilháveis (categorias/tipo/musical) na URL. */
function syncQuery() {
  const query: Record<string, string> = {}
  if (selectedCategories.value.length) query.categoria = selectedCategories.value.join(',')
  if (selectedTipo.value) query.tipo = selectedTipo.value
  if (selectedTipo.value === 'musical' && selectedMusical.value) {
    query.musical = String(selectedMusical.value)
  }
  if (order.value) query.ordem = order.value
  router.replace({ query })
}

function toggleCategory(slug: string) {
  const idx = selectedCategories.value.indexOf(slug)
  if (idx >= 0) selectedCategories.value.splice(idx, 1)
  else selectedCategories.value.push(slug)
  syncQuery()
}

function toggleMusical() {
  selectedTipo.value = selectedTipo.value === 'musical' ? '' : 'musical'
  if (selectedTipo.value !== 'musical') selectedMusical.value = null
  syncQuery()
}

/** "Todos": limpa categorias e musical de uma vez. */
function clearFilters() {
  selectedCategories.value = []
  selectedTipo.value = ''
  selectedMusical.value = null
  syncQuery()
}

const nothingSelected = computed(() => !selectedCategories.value.length && !selectedTipo.value)

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
      category: selectedCategories.value.join(',') || undefined,
      subcategories: selectedSubs.value,
      q: q.value || undefined,
      tipo: selectedTipo.value || undefined,
      musical: selectedTipo.value === 'musical' ? selectedMusical.value ?? undefined : undefined,
      order: order.value || undefined,
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

// Filtros/busca voltam à página 1 e recarregam.
watch([selectedCategories, selectedSubs, q, selectedTipo, selectedMusical, order], () => {
  page.value = 1
  syncQuery()
  fetchItems()
}, { deep: true })

watch(page, fetchItems)

onMounted(async () => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
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

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
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

      <!-- Busca em cima; abaixo, UMA linha de chips ACUMULATIVOS: "Todos"
           limpa tudo, categorias somam entre si (OR) e "Musicais" entra
           como categoria (restringe junto das selecionadas). -->
      <motion.div class="toolbar" v-bind="rise(0.08)">
        <input v-model.lazy="q" type="search" class="search" placeholder="Buscar por título ou artista…" />
        <div class="chips">
          <button
            class="chip"
            :class="{ active: nothingSelected }"
            @click="clearFilters"
          >
            <CategoryIcon class="chip-icon" slug="todos" :size="16" />
            Todos
          </button>
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="chip"
            :class="[cat.slug, { active: selectedCategories.includes(cat.slug) }]"
            @click="toggleCategory(cat.slug)"
          >
            <CategoryIcon class="chip-icon" :slug="cat.slug" :size="16" />
            {{ cat.name }}
          </button>
          <button
            class="chip musicais"
            :class="{ active: selectedTipo === 'musical' }"
            @click="toggleMusical"
          >
            <CategoryIcon class="chip-icon" slug="musicais" :size="16" />
            Musicais
          </button>
          <!-- Ordenação: dropdown personalizado blocado (padrão do menu do
               usuário no header: painel colado, fecha fora/Escape) -->
          <div ref="orderRef" class="order">
            <button
              type="button"
              class="order-btn"
              :class="{ active: order !== '' }"
              aria-haspopup="listbox"
              :aria-expanded="orderOpen"
              @click="orderOpen = !orderOpen"
            >
              {{ orderLabel }}
              <svg
                class="order-arrow"
                :class="{ open: orderOpen }"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <Transition name="drop">
              <ul v-if="orderOpen" class="order-menu" role="listbox" aria-label="Ordenar por">
                <li v-for="opt in ORDER_OPTIONS" :key="opt.value">
                  <button
                    type="button"
                    role="option"
                    class="order-item"
                    :class="{ selected: order === opt.value }"
                    :aria-selected="order === opt.value"
                    @click="pickOrder(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </li>
              </ul>
            </Transition>
          </div>
        </div>
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

// Busca numa linha; a linha única de chips vem logo abaixo.
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.search {
  @include block-input;
  width: 100%;
}

// Grupo blocado (guia §3): chips colados, sem pílulas; bordas de 1px
// sobrepostas pelo mixin block-chip. A linha ocupa o contêiner INTEIRO e
// os botões dividem a largura por igual (flex: 1).
.chips {
  display: flex;
  flex-wrap: wrap;
  width: 100%;

  // 1 0 auto: crescem para preencher a linha inteira, mas nunca ficam
  // menores que o próprio rótulo (nada cortado; no estreito quebram).
  > .chip {
    flex: 1 0 auto;
    justify-content: center;
  }
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

// Dropdown de ordenação personalizado: gatilho com o desenho dos chips
// (blocado, colado no grupo) e painel blocado ancorado abaixo (mesmo
// padrão do menu do usuário no header).
.order {
  position: relative;
  margin: 0 -1px -1px 0;
  flex: 1 0 auto;
  display: flex;
}

.order-btn {
  @include label-type;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 0.5rem;
  white-space: nowrap;
  padding: 0.55rem 1.1rem;
  border: 1px solid $line;
  border-radius: 0;
  background: $color-back;
  color: $text-secondary;
  cursor: pointer;
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
    background: $fill-hover-solid;
  }

  &.active {
    color: $gold-text;
    background: $fill-active-solid;
  }
}

// Seta da família dos ícones do sistema; gira com o painel aberto.
.order-arrow {
  transition: transform 0.5s $ease-brand;

  &.open {
    transform: rotate(180deg);
  }
}

// Painel: moldura 1px, itens colados separados por linha, fundo OPACO
// (vitrine — o backdrop de anéis não pode atravessar), acima do grid.
.order-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 5;
  min-width: 100%;
  margin-top: -1px;
  list-style: none;
  padding: 0;
  border: 1px solid $line;
  background: $color-back;

  li + li {
    border-top: 1px solid $line;
  }
}

.order-item {
  @include label-type;
  display: block;
  width: 100%;
  padding: 0.6rem 1.1rem;
  border: none;
  background: none;
  color: $text-secondary;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
    background: $fill-hover-solid;
  }

  &.selected {
    color: $gold-text;
    background: $fill-active-solid;
  }
}

// Entrada/saída do painel: véu + descida leve (padrão dos dropdowns).
.drop-enter-active,
.drop-leave-active {
  transition: opacity 0.35s $ease-brand, transform 0.35s $ease-brand;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
