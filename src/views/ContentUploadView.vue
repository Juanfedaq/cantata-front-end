<script setup lang="ts">
// Publicação de OBRA/pacote (2026-07-09): cada categoria (Música, Partitura,
// Cifra, Coreografia) tem a própria área — preencher arquivo + prévia inclui
// a categoria no pacote; ao menos uma é obrigatória. Preço é ÚNICO e fica
// por último, junto do simulador de repasse.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import {
  ApiError,
  artistsApi,
  catalogApi,
  contentsApi,
  formatPrice,
  type Category,
  type FeeSimulation,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'

const route = useRoute()
const router = useRouter()

// ?editar=<id> → edição/reenvio de uma obra existente (reabre a revisão).
const editingId = computed(() => {
  const id = Number(route.query.editar)
  return Number.isInteger(id) && id > 0 ? id : null
})

const categories = ref<Category[]>([])
const subcategories = ref<Subcategory[]>([])

const title = ref('')
const description = ref('')
const priceReais = ref('')
const selectedSubs = ref<number[]>([])
const cover = ref<File | null>(null)

// Estado por categoria do pacote. `existing` = já está no pacote (edição);
// `remove` = tirar do pacote no reenvio.
interface CatArea {
  file: File | null
  preview: File | null
  existing: boolean
  remove: boolean
}
const areas = ref<Record<string, CatArea>>({})

const sending = ref(false)
const error = ref('')

// Aceite do contrato de artista: sem a versão vigente aceita, a publicação
// é bloqueada (o backend também bloqueia — isto é só a UX).
const contractOk = ref<boolean | null>(null) // null = carregando

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

/** A categoria está (ou vai ficar) no pacote? */
function isIncluded(slug: string) {
  const a = areas.value[slug]
  if (!a) return false
  if (a.remove) return false
  return a.existing || (!!a.file && !!a.preview)
}

const includedCount = computed(() =>
  categories.value.filter((c) => isIncluded(c.slug)).length,
)

// ---- Simulação de repasse (transparência de preço) ----
// A conta é feita no BACKEND (mesma função do checkout — fonte única).
const simulation = ref<FeeSimulation | null>(null)
const simulating = ref(false)
let simulateTimer: ReturnType<typeof setTimeout> | undefined

const priceCentsInput = computed(() => {
  const cents = Math.round(Number(priceReais.value.replace(',', '.')) * 100)
  return Number.isInteger(cents) && cents >= 100 ? cents : null
})

watch(priceCentsInput, (cents) => {
  clearTimeout(simulateTimer)
  if (cents === null) {
    simulation.value = null
    return
  }
  simulating.value = true
  simulateTimer = setTimeout(async () => {
    try {
      const result = await artistsApi.simulateFees(cents)
      // Ignora resposta atrasada se o preço já mudou de novo.
      if (priceCentsInput.value === cents) simulation.value = result
    } catch {
      simulation.value = null
    } finally {
      simulating.value = false
    }
  }, 350)
})

onMounted(async () => {
  // Contrato vigente aceito? Sem aceite, mostra o bloqueio com link.
  try {
    contractOk.value = (await artistsApi.contract()).upToDate
  } catch {
    contractOk.value = null // indefinido: deixa o backend decidir no envio
  }

  try {
    const cats = await catalogApi.categories()
    categories.value = cats.categories
    subcategories.value = cats.subcategories
    for (const cat of cats.categories) {
      areas.value[cat.slug] = { file: null, preview: null, existing: false, remove: false }
    }
  } catch {
    error.value = 'Erro ao carregar as categorias. Recarregue a página.'
  }

  // Em edição, pré-carrega os metadados e marca as categorias já no pacote.
  if (editingId.value) {
    try {
      const mine = (await contentsApi.mine()).contents
      const current = mine.find((c) => c.id === editingId.value)
      if (current) {
        title.value = current.title
        description.value = current.description ?? ''
        priceReais.value = (current.priceCents / 100).toFixed(2)
        for (const item of current.items) {
          const area = areas.value[item.category.slug]
          if (area) area.existing = true
        }
      }
    } catch {
      // Sem os dados atuais, o formulário funciona como novo envio.
    }
  }
})

function pickArea(slug: string, kind: 'file' | 'preview') {
  return (e: Event) => {
    const input = e.target as HTMLInputElement
    const area = areas.value[slug]
    if (area) {
      area[kind] = input.files?.[0] ?? null
      if (area[kind]) area.remove = false // enviar arquivo desfaz a remoção
    }
  }
}

function pickCover(e: Event) {
  const input = e.target as HTMLInputElement
  cover.value = input.files?.[0] ?? null
}

function toggleRemove(slug: string) {
  const area = areas.value[slug]
  if (!area?.existing) return
  area.remove = !area.remove
  if (area.remove) {
    area.file = null
    area.preview = null
  }
}

function toggleSub(id: number) {
  const idx = selectedSubs.value.indexOf(id)
  if (idx >= 0) selectedSubs.value.splice(idx, 1)
  else selectedSubs.value.push(id)
}

async function submit(asDraft: boolean) {
  error.value = ''

  const priceCents = Math.round(Number(priceReais.value.replace(',', '.')) * 100)
  if (!title.value.trim()) return (error.value = 'Informe o título.')

  // Cada categoria NOVA precisa do par completo (arquivo + prévia).
  for (const cat of categories.value) {
    const a = areas.value[cat.slug]
    if (!a || a.existing || a.remove) continue
    if ((a.file && !a.preview) || (!a.file && a.preview)) {
      return (error.value = `A categoria "${cat.name}" precisa do arquivo completo E da prévia (ou deixe os dois vazios).`)
    }
  }
  if (!includedCount.value) {
    return (error.value = 'Inclua ao menos uma categoria no pacote (arquivo completo + prévia).')
  }
  if (!Number.isInteger(priceCents) || priceCents < 100)
    return (error.value = 'Preço mínimo de R$ 1,00.')

  const form = new FormData()
  form.set('title', title.value.trim())
  form.set('description', description.value.trim())
  form.set('priceCents', String(priceCents))
  form.set('subcategoryIds', JSON.stringify(selectedSubs.value))
  if (asDraft) form.set('draft', '1')

  const removeSlugs: string[] = []
  for (const cat of categories.value) {
    const a = areas.value[cat.slug]
    if (!a) continue
    if (a.remove && a.existing) removeSlugs.push(cat.slug)
    if (a.file) form.set(`file_${cat.slug}`, a.file)
    if (a.preview) form.set(`preview_${cat.slug}`, a.preview)
  }
  if (removeSlugs.length) form.set('removeCategorySlugs', JSON.stringify(removeSlugs))
  if (cover.value) form.set('cover', cover.value)

  sending.value = true
  try {
    if (editingId.value) await contentsApi.update(editingId.value, form)
    else await contentsApi.create(form)
    router.push('/artista/conteudos')
  } catch (err) {
    // Sem aceite do contrato vigente, o backend nega — manda para o aceite.
    if (err instanceof ApiError && err.code === 'CONTRACT_REQUIRED') {
      router.push({ path: '/contrato', query: { redirect: route.fullPath } })
      return
    }
    error.value = err instanceof Error ? err.message : 'Erro ao enviar a obra.'
    sending.value = false
  }
}
</script>

<template>
  <AppLayout>
    <h1 class="page-title">{{ editingId ? 'Editar e reenviar obra' : 'Publicar obra' }}</h1>
    <p class="muted intro">
      Uma obra é um pacote: preencha as categorias que ela inclui (só as que quiser) — quem
      comprar leva tudo por um preço único. A obra passa pela revisão da equipe antes de ser
      publicada.
    </p>

    <!-- Bloqueio de publicação sem o aceite do contrato vigente -->
    <div v-if="contractOk === false" class="contract-warn">
      <p>
        📜 Antes de publicar, você precisa ler e aceitar os
        <strong>Termos do Artista</strong> (comissões, repasses e direitos autorais).
      </p>
      <RouterLink :to="{ path: '/contrato', query: { redirect: route.fullPath } }" class="contract-btn">
        Ler e aceitar os termos
      </RouterLink>
    </div>

    <form class="form" @submit.prevent="submit(false)">
      <label class="field">
        <span>Título *</span>
        <input v-model="title" type="text" maxlength="190" required />
      </label>

      <label class="field">
        <span>Descrição</span>
        <textarea v-model="description" rows="4" />
      </label>

      <div v-for="group in subsByType" :key="group.type" class="field">
        <span>{{ group.label }}</span>
        <div class="chips">
          <button
            v-for="sub in group.items"
            :key="sub.id"
            type="button"
            class="chip small"
            :class="{ active: selectedSubs.includes(sub.id) }"
            @click="toggleSub(sub.id)"
          >
            {{ sub.name }}
          </button>
        </div>
      </div>

      <!-- Áreas por categoria: preencher arquivo + prévia inclui no pacote -->
      <div class="field">
        <span>O que este pacote inclui * <em class="count">({{ includedCount }} de {{ categories.length }} categorias)</em></span>
        <div class="cat-areas">
          <fieldset
            v-for="cat in categories"
            :key="cat.id"
            class="cat-area"
            :class="{ included: isIncluded(cat.slug), removed: areas[cat.slug]?.remove }"
          >
            <legend class="cat-head">
              <span class="cat-name">{{ cat.name }}</span>
              <span v-if="areas[cat.slug]?.remove" class="cat-state removed">será removida</span>
              <span v-else-if="isIncluded(cat.slug)" class="cat-state">no pacote</span>
            </legend>

            <template v-if="!areas[cat.slug]?.remove">
              <label class="cat-input">
                <span>
                  Arquivo completo
                  {{ areas[cat.slug]?.existing ? '(vazio = manter o atual)' : '' }}
                  — .mp3, .mp4, .pdf ou .docx (máx. 50MB)
                </span>
                <input type="file" accept=".mp3,.mp4,.pdf,.docx" @change="pickArea(cat.slug, 'file')($event)" />
              </label>
              <label class="cat-input">
                <span>
                  Prévia {{ areas[cat.slug]?.existing ? '(vazio = manter a atual)' : '' }}
                  — trecho que qualquer visitante pode ver/ouvir
                </span>
                <input
                  type="file"
                  accept=".mp3,.mp4,.pdf,.jpg,.jpeg,.png,.webp"
                  @change="pickArea(cat.slug, 'preview')($event)"
                />
              </label>
            </template>

            <button
              v-if="areas[cat.slug]?.existing"
              type="button"
              class="cat-remove"
              @click="toggleRemove(cat.slug)"
            >
              {{ areas[cat.slug]?.remove ? 'Desfazer remoção' : 'Remover do pacote' }}
            </button>
          </fieldset>
        </div>
      </div>

      <label class="field">
        <span>Capa da obra (opcional) — imagem</span>
        <input type="file" accept=".jpg,.jpeg,.png,.webp" @change="pickCover($event)" />
      </label>

      <!-- Preço por último, junto do simulador de repasse -->
      <label class="field narrow">
        <span>Preço do pacote (R$) *</span>
        <input v-model="priceReais" type="text" inputmode="decimal" placeholder="19,90" required />
      </label>

      <div v-if="simulation" class="simulation">
        <h3 class="sim-title">Se vender por {{ formatPrice(simulation.valorBrutoCents) }}</h3>
        <dl class="sim-rows">
          <div class="sim-row destaque">
            <dt>Você recebe</dt>
            <dd>{{ formatPrice(simulation.valorLiquidoArtistaCents) }}</dd>
          </div>
          <div class="sim-row">
            <dt>
              Comissão do Cantata
              ({{ simulation.pisoAplicado ? `piso de ${formatPrice(simulation.config.minFeeCents)}` : `${simulation.percentAplicado}%` }})
            </dt>
            <dd>{{ formatPrice(simulation.comissaoPlataformaCents) }}</dd>
          </div>
          <div class="sim-row">
            <dt>Processador de pagamento (estimativa)</dt>
            <dd>{{ formatPrice(simulation.taxaProcessamentoCents) }}</dd>
          </div>
        </dl>
        <p v-if="simulation.pisoAplicado" class="sim-note">
          Neste preço, {{ simulation.percentAplicado }}% renderia menos que o piso de
          {{ formatPrice(simulation.config.minFeeCents) }} — o piso é aplicado.
        </p>
        <p v-if="simulation.assinaturaAtiva" class="sim-note ok">
          Comissão reduzida de assinante ({{ simulation.config.subscribedPercent }}%) aplicada.
        </p>
      </div>
      <p v-else-if="simulating" class="muted">Calculando repasse…</p>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="submit" class="primary" :disabled="sending || contractOk === false">
          {{ sending ? 'Enviando…' : 'Enviar para revisão' }}
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="sending || contractOk === false"
          @click="submit(true)"
        >
          Salvar como rascunho
        </button>
      </div>
    </form>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
}

.intro {
  margin: 0.5rem 0 2rem;
  max-width: 640px;
}

.form {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  > span {
    font-size: 0.88rem;
    color: rgba(var(--fg-rgb), 0.75);
  }

  input[type='text'],
  textarea {
    @include block-input;
  }

  input[type='file'] {
    color: rgba(var(--fg-rgb), 0.7);
  }

  &.narrow input {
    max-width: 160px;
  }
}

.count {
  font-style: normal;
  color: $text-dim;
}

// Áreas por categoria: grupos blocados colados (guia §3), moldura 1px;
// incluída no pacote = borda dourada.
.cat-areas {
  display: flex;
  flex-direction: column;
}

.cat-area {
  border: 1px solid $line;
  margin: 0 0 -1px;
  padding: 1rem 1.25rem 1.1rem;
  transition: border-color 0.5s $ease-brand, background-color 0.5s $ease-brand;

  &.included {
    border-color: rgba($color-primary, 0.45);
    background: $fill-hover-solid;
    position: relative;
    z-index: 1; // a borda dourada vence a sobreposição de -1px
  }

  &.removed {
    opacity: 0.6;
  }
}

.cat-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.4rem;
}

.cat-name {
  font-family: $font-display;
  font-size: 1.05rem;
}

// Tag de estado da categoria: badge blocado (guia §5).
.cat-state {
  @include label-type;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  background: rgba($color-primary, 0.18);
  color: $gold-text;

  &.removed {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}

.cat-input {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.75rem;

  > span {
    font-size: 0.8rem;
    color: rgba(var(--fg-rgb), 0.6);
  }

  input[type='file'] {
    color: rgba(var(--fg-rgb), 0.7);
  }
}

.cat-remove {
  background: none;
  border: none;
  padding: 0;
  margin-top: 0.75rem;
  cursor: pointer;
  font-size: 0.82rem;
  color: $color-error;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
  }
}

// Grupo blocado (guia §3): chips colados, sem pílulas.
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

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.primary {
  @include block-button-primary;
}

.secondary {
  @include block-button;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
}

// Aviso de contrato pendente: bloco solto com moldura dourada (guia §3).
.contract-warn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  max-width: 640px;
  padding: 1rem 1.25rem;
  border: 1px solid rgba($color-primary, 0.45);
  background: $fill-active-solid;
  margin-bottom: 1.5rem;
  color: rgba(var(--fg-rgb), 0.85);
}

.contract-btn {
  @include block-button-primary;
  padding: 0.6rem 1.2rem;
}

// Simulação de repasse: grupo blocado, linhas separadas por 1px.
.simulation {
  border: 1px solid $line;
  background: $fill-hover-solid;
  padding: 1.1rem 1.25rem;
}

.sim-title {
  @include label-type;
  color: $text-secondary;
  margin-bottom: 0.75rem;
}

.sim-rows {
  display: flex;
  flex-direction: column;
}

.sim-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);
  font-size: 0.9rem;
  color: rgba(var(--fg-rgb), 0.7);

  &:last-child {
    border-bottom: none;
  }

  dd {
    font-weight: 600;
    color: rgba(var(--fg-rgb), 0.85);
  }

  &.destaque {
    dt {
      color: $gold-text;
    }
    dd {
      color: $gold-strong;
      font-size: 1.05rem;
    }
  }
}

.sim-note {
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: $text-dim;

  &.ok {
    color: $color-success;
  }
}
</style>
