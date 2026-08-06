<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { motion, MotionConfig } from 'motion-v'
import AppLayout from '@/components/AppLayout.vue'
import ContentCard from '@/components/ContentCard.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import BlockSelect from '@/components/BlockSelect.vue'
import {
  catalogApi,
  type CatalogItem,
  type Category,
  type Musical,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'
import { catHue } from '@/utils/categoryStyle'

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
const q = ref(String(route.query.busca || ''))
// Filtro ACUMULATIVO (2026-07-22): várias categorias ao mesmo tempo (OR
// entre elas — o pacote contém qualquer uma); "Musicais" entra na mesma
// linha como se fosse categoria (restringe junto: categorias E musical).
const selectedCategories = ref<string[]>(
  String(route.query.categoria || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const selectedSubs = ref<number[]>(parseSubs(route.query.sub))

/** Lê `?sub=1,4,9` como lista de ids, descartando o que não for número. */
function parseSubs(value: unknown): number[] {
  return String(value || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

// Ordenação (2026-07-22): dropdown "Ordenar por…" PERSONALIZADO na linha
// dos chips (painel blocado, mesmo padrão do menu do usuário no header).
// Vazio = padrão do backend (mais recentes). Espelhada na URL (?ordem=).
type Order = '' | 'titulo-az' | 'titulo-za' | 'recentes' | 'preco-desc' | 'preco-asc'
// Rótulos CURTOS de propósito: o botão reserva a largura do maior rótulo
// (largura fixa), então nomes longos empurrariam a linha (o "Ordenar por…"
// cairia para uma 2ª linha). Curtos mantêm tudo numa linha só.
const ORDER_OPTIONS: { value: Order; label: string }[] = [
  { value: 'titulo-az', label: 'A–Z' },
  { value: 'titulo-za', label: 'Z–A' },
  { value: 'recentes', label: 'Recentes' },
  { value: 'preco-desc', label: 'Maior preço' },
  { value: 'preco-asc', label: 'Menor preço' },
]
const order = ref<Order>(
  ORDER_OPTIONS.some((o) => o.value === route.query.ordem)
    ? (String(route.query.ordem) as Order)
    : '',
)
// Tema (2026-07-23): antes "musical" era um tipo (padrão × musical); virou
// um TEMA opcional da obra (Natal, Páscoa, …). Aqui é um DROPDOWN
// personalizado (mesmo estilo do "Ordenar por…"), independente das
// categorias; espelhado na URL (?tema=<id>). O dado mantém o nome interno
// "musical" (id do tema).
const musicals = ref<Musical[]>([])
const selectedMusical = ref<number | null>(
  Number.isInteger(Number(route.query.tema)) && Number(route.query.tema) > 0
    ? Number(route.query.tema)
    : null,
)
// "Todos os temas" é uma OPÇÃO da lista (`emptyValue: null`): o botão segue
// dizendo "Tema…" quando nada está escolhido, mas quem escolheu um tema
// precisa conseguir desfazer.
const temaOptions = computed(() => [
  { value: null as number | null, label: 'Todos os temas' },
  ...musicals.value.map((m) => ({ value: m.id as number | null, label: m.name })),
])

/**
 * Espelha TODO o estado de filtro na URL — categorias, tema, ordem, busca e
 * subcategorias.
 *
 * Busca e subcategorias entraram em 2026-08-05: antes ficavam só em memória,
 * e isso tinha duas consequências. Uma busca não era compartilhável nem
 * sobrevivia ao recarregar; e, pior, não havia como distinguir "o usuário
 * voltou para a Biblioteca limpa" de "a própria tela acabou de sincronizar a
 * URL" — as duas produziam a mesma URL vazia. Com o estado inteiro aqui, a
 * URL passa a ser a fonte da verdade e a comparação abaixo fica sólida.
 */
function syncQuery() {
  router.replace({ query: queryFromState() })
}

/** O que a URL DEVE ser para o estado atual da tela. */
function queryFromState(): Record<string, string> {
  const query: Record<string, string> = {}
  if (selectedCategories.value.length) query.categoria = selectedCategories.value.join(',')
  if (selectedMusical.value) query.tema = String(selectedMusical.value)
  if (order.value) query.ordem = order.value
  if (q.value.trim()) query.busca = q.value.trim()
  if (selectedSubs.value.length) query.sub = selectedSubs.value.join(',')
  return query
}

function toggleCategory(slug: string) {
  const idx = selectedCategories.value.indexOf(slug)
  if (idx >= 0) selectedCategories.value.splice(idx, 1)
  else selectedCategories.value.push(slug)
  syncQuery()
}

/** "Todos": limpa a seleção de categorias (tema/ordem são dropdowns próprios). */
function clearFilters() {
  selectedCategories.value = []
  syncQuery()
}

const nothingSelected = computed(() => !selectedCategories.value.length)

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
      musical: selectedMusical.value ?? undefined,
      order: order.value || undefined,
    })
    items.value = res.items
    totalPages.value = res.totalPages
    total.value = res.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer a biblioteca agora. Tente de novo em instantes.'
  } finally {
    loading.value = false
  }
}

// Retorno da busca (QA 2026-08-05): sem isto, pesquisar não dizia quantos
// resultados vieram — a grade simplesmente mudava. `total` é o total da
// CONSULTA (todas as páginas), não o da página atual, que é o que interessa
// para quem acabou de pesquisar.
const resultsLabel = computed(() => {
  const n = total.value
  const conteudos = `${n} ${n === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'}`
  const termo = q.value.trim()
  return termo ? `${conteudos} para “${termo}”` : conteudos
})

// Mensagem de vazio: com termo de busca, repete o termo — ajuda a perceber
// o erro de digitação, que é a causa mais comum de zero resultado.
const emptyLabel = computed(() => {
  const termo = q.value.trim()
  return termo
    ? `Nenhum conteúdo encontrado para “${termo}”. Tente outra palavra ou revise os filtros.`
    : 'Nada por aqui com esses filtros. Tente afrouxar um deles.'
})

function toggleSub(id: number) {
  const idx = selectedSubs.value.indexOf(id)
  if (idx >= 0) selectedSubs.value.splice(idx, 1)
  else selectedSubs.value.push(id)
}

// Filtros/busca voltam à página 1 e recarregam.
watch([selectedCategories, selectedSubs, q, selectedMusical, order], () => {
  page.value = 1
  syncQuery()
  fetchItems()
}, { deep: true })

watch(page, fetchItems)

// Navegação EXTERNA para a Biblioteca — clicar em "Biblioteca" no header
// estando já nela, no ícone de uma categoria da Home, ou usar o botão voltar
// do navegador. O componente NÃO remonta nesses casos, e os filtros vivem em
// refs lidas da URL só na criação: sem isto, a URL ficava limpa e a seleção
// antiga continuava valendo na tela (QA 2026-08-05).
watch(
  () => route.query,
  (query) => {
    // Guarda contra laço: o syncQuery() também escreve na URL. Comparamos o
    // que a URL DIZ com o que ela DEVERIA dizer para o estado atual — iguais
    // significa que a mudança veio de nós, e não há nada a fazer.
    const atual = queryFromState()
    const chaves = new Set([...Object.keys(atual), ...Object.keys(query)])
    const igual = [...chaves].every((k) => String(query[k] ?? '') === (atual[k] ?? ''))
    if (igual) return

    selectedCategories.value = String(query.categoria || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    selectedMusical.value =
      Number.isInteger(Number(query.tema)) && Number(query.tema) > 0 ? Number(query.tema) : null
    order.value = ORDER_OPTIONS.some((o) => o.value === query.ordem)
      ? (String(query.ordem) as Order)
      : ''
    q.value = String(query.busca || '')
    selectedSubs.value = parseSubs(query.sub)
  },
)

// Os listeners de clique-fora e Escape mudaram de casa: agora vivem dentro do
// BlockSelect, cada instância cuidando do próprio painel.
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
            <CategoryIcon class="chip-icon" icon="todos" :size="16" />
            Todos
          </button>
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="chip"
            :style="catHue(cat)" :class="[{ active: selectedCategories.includes(cat.slug) }]"
            @click="toggleCategory(cat.slug)"
          >
            <CategoryIcon class="chip-icon" :icon="cat.icon" :size="16" />
            {{ cat.name }}
          </button>
          <!-- Tema (2026-07-23): dropdown no lugar do antigo chip "Musicais"
               (reaproveita o estilo .order-* — dropdown blocado idêntico). -->
          <!-- Tema e ordenação: BlockSelect, o dropdown blocado da plataforma
               (src/components/BlockSelect.vue). Era markup duplicado aqui —
               virou componente em 2026-08-05, quando o painel do admin
               precisou do mesmo controle. `class="order"` mantém a colagem
               das bordas no grupo blocado: o Vue repassa a classe à raiz do
               componente filho. -->
          <BlockSelect
            v-if="musicals.length"
            v-model="selectedMusical"
            class="order"
            :options="temaOptions"
            :empty-value="null"
            placeholder="Tema…"
            aria-label="Filtrar por tema"
            highlight-when-set
          />
          <BlockSelect
            v-model="order"
            class="order"
            :options="ORDER_OPTIONS"
            placeholder="Ordenar por…"
            aria-label="Ordenar a biblioteca"
            highlight-when-set
          />
        </div>
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
      <p v-else-if="!items.length" class="muted">{{ emptyLabel }}</p>

      <template v-else>
        <!-- aria-live: quem usa leitor de tela ouve a contagem mudar sem
             precisar varrer a grade de novo a cada busca. -->
        <p class="results" aria-live="polite">{{ resultsLabel }}</p>

        <div class="grid">
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
      </template>

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
// Posição do BlockSelect dentro do grupo blocado de chips: a margem
// negativa cola as bordas de 1px nas vizinhas. O Vue repassa esta classe à
// raiz do componente filho, e o CSS com escopo desta view também a alcança.
.order {
  position: relative;
  margin: 0 -1px -1px 0;
  flex: 1 0 auto;
  display: flex;
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

// Contagem do resultado, entre os filtros e a grade. É dado, não rótulo:
// sem uppercase (guia §5).
.results {
  margin-top: 1.5rem;
  color: $text-secondary;
  font-size: 0.86rem;
}

.grid {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

// Com a contagem acima, a grade não precisa repetir o afastamento.
.results + .grid {
  margin-top: 0.9rem;
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
