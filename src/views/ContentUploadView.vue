<script setup lang="ts">
// Publicação de OBRA/pacote (2026-07-09): cada categoria (Música, Partitura,
// Cifra, Coreografia) tem a própria área — preencher arquivos + prévia inclui
// a categoria no pacote; ao menos uma é obrigatória. Preço é ÚNICO e fica
// por último, junto do simulador de repasse.
// 2026-07-16: área de upload VISUAL — cada categoria aceita VÁRIOS arquivos
// (boxes com preview: imagem mostra a imagem; áudio, nota; vídeo, play;
// documento, folha) + o box de adicionar no fim; regras de tipo POR categoria
// (música só áudio etc.); prévia pública continua única por categoria.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import FileGlyph from '@/components/FileGlyph.vue'
import PublishPreview from '@/components/PublishPreview.vue'
import { useAuthStore } from '@/stores/auth'
import {
  ApiError,
  artistsApi,
  catalogApi,
  contentsApi,
  fileUrl,
  formatPrice,
  type Category,
  type CategoryRef,
  type FeeSimulation,
  type Musical,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// ?editar=<id> → edição/reenvio de uma obra existente (reabre a revisão).
const editingId = computed(() => {
  const id = Number(route.query.editar)
  return Number.isInteger(id) && id > 0 ? id : null
})

const categories = ref<Category[]>([])
const subcategories = ref<Subcategory[]>([])

// Tema (2026-07-23): a obra pode ganhar um TEMA opcional (Natal, Páscoa, …)
// — antes era um "tipo" (padrão × musical), agora é só uma etiqueta a mais,
// não obrigatória. Vazio = sem tema. O dado mantém o nome interno "musical".
const musicals = ref<Musical[]>([])
const musicalId = ref<number | null>(null)

// Em edição, o tema salvo pode ter sido desativado pelo admin depois — ele
// não vem em GET /categories, mas precisa aparecer no select (o backend
// permite MANTER, só não escolher um inativo novo).
const musicalOptions = computed(() => {
  if (musicalId.value && !musicals.value.some((m) => m.id === musicalId.value) && editingMusical.value) {
    return [...musicals.value, editingMusical.value]
  }
  return musicals.value
})
const editingMusical = ref<Musical | null>(null)

const title = ref('')
const description = ref('')
const priceReais = ref('')
const selectedSubs = ref<number[]>([])

// Capa da obra: box visual como os demais — nova capa vira thumb
// (objectURL); em edição, a capa atual do servidor aparece no box.
const cover = ref<File | null>(null)
const coverUrl = ref<string | null>(null)
const existingCoverPath = ref<string | null>(null)

// ---- Estado por categoria do pacote -----------------------------------------
// `newFiles` = arquivos escolhidos agora (com objectURL para thumb de imagem);
// `existingFiles` = já no servidor (edição; `remove` marca p/ removeFileIds);
// prévia é ÚNICA por categoria; `remove` tira a categoria inteira.
interface LocalFile {
  file: File
  url: string | null // objectURL (só imagens — thumb no box)
}
interface ExistingFile {
  id: number
  fileName: string | null
  remove: boolean
}
interface CatArea {
  newFiles: LocalFile[]
  existingFiles: ExistingFile[]
  preview: File | null
  previewUrl: string | null
  hasExistingPreview: boolean
  existing: boolean // categoria já estava no pacote (edição)
  remove: boolean
}
const areas = ref<Record<string, CatArea>>({})

function blankArea(): CatArea {
  return {
    newFiles: [],
    existingFiles: [],
    preview: null,
    previewUrl: null,
    hasExistingPreview: false,
    existing: false,
    remove: false,
  }
}

// Acordeão (passo Conteúdo): cada categoria abre/fecha. Aberto por padrão
// no primeiro (novo envio) e nos que já têm conteúdo (edição).
const expanded = ref<Record<string, boolean>>({})
function toggleExpand(slug: string) {
  expanded.value[slug] = !expanded.value[slug]
}

// Regras de tipo POR categoria (espelham o backend — upload.js).
const CATEGORY_ACCEPT: Record<string, string> = {
  musicas: '.mp3',
  coreografias: '.mp4',
  partituras: '.pdf,.docx,.jpg,.jpeg,.png,.webp',
  cifras: '.pdf,.docx,.jpg,.jpeg,.png,.webp',
}
const CATEGORY_PREVIEW_ACCEPT: Record<string, string> = {
  musicas: '.mp3',
  coreografias: '.mp4',
  partituras: '.pdf,.jpg,.jpeg,.png,.webp',
  cifras: '.pdf,.jpg,.jpeg,.png,.webp',
}
const CATEGORY_HINT: Record<string, string> = {
  musicas: 'áudio .mp3',
  coreografias: 'vídeo .mp4',
  partituras: '.pdf, .docx ou imagem',
  cifras: '.pdf, .docx ou imagem',
}
const MAX_FILES_PER_CATEGORY = 10

/** Natureza visual de um arquivo pelo nome (decide o ícone do box). */
function fileKind(name: string | null | undefined): 'image' | 'audio' | 'video' | 'doc' {
  const ext = (name ?? '').toLowerCase().split('.').pop() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image'
  if (ext === 'mp3') return 'audio'
  if (ext === 'mp4') return 'video'
  return 'doc'
}

/** A extensão é aceita pela categoria? (mesma regra do accept do input) */
function extAllowed(accept: string, name: string) {
  const ext = `.${name.toLowerCase().split('.').pop()}`
  return accept.split(',').includes(ext)
}

const sending = ref(false)
const error = ref('')

// Aceite do contrato de artista: sem a versão vigente aceita, a publicação
// é bloqueada (o backend também bloqueia — isto é só a UX).
const contractOk = ref<boolean | null>(null) // null = carregando

// Cadastro de pagamentos (Stripe): sem o onboarding completo, a obra só
// pode ser salva como RASCUNHO (o backend também bloqueia — isto é só a
// UX). null = indefinido (ex.: Stripe fora do ar) — deixa o backend decidir.
const stripeOk = ref<boolean | null>(null)

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

/** Arquivos que a categoria terá após o envio (existentes mantidos + novos).
 *  Tolera `undefined` (índice pode não estar pronto no template) → 0. */
function finalFileCount(a: CatArea | undefined) {
  if (!a) return 0
  return a.existingFiles.filter((f) => !f.remove).length + a.newFiles.length
}

/** A categoria está (ou vai ficar) no pacote? */
function isIncluded(slug: string) {
  const a = areas.value[slug]
  if (!a || a.remove) return false
  if (a.existing) return finalFileCount(a) > 0
  return a.newFiles.length > 0 && !!a.preview
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

// ---- Assistente em 4 passos --------------------------------------------------
// (1) Detalhes · (2) Conteúdo · (3) Capa e preço · (4) Revisão e envio.
// Os passos são só VISTAS da mesma form (v-show, não v-if) — assim os
// arquivos/prévias já escolhidos não se perdem ao navegar entre eles.
const TOTAL_STEPS = 4
const STEPS = [
  { n: 1, label: 'Detalhes' },
  { n: 2, label: 'Conteúdo' },
  { n: 3, label: 'Capa e preço' },
  { n: 4, label: 'Revisão' },
]
const step = ref(1)

/** Validação do CONTEÚDO (passo 2): categorias e arquivos. Erro ou null.
 *  Ao achar problema numa categoria, ABRE o acordeão dela (senão o artista
 *  não veria onde corrigir se estiver colapsada). */
function validateContent(): string | null {
  for (const cat of categories.value) {
    const a = areas.value[cat.slug]
    if (!a || a.remove) continue
    if (!a.existing) {
      if (a.newFiles.length && !a.preview) {
        expanded.value[cat.slug] = true
        return `A categoria "${cat.name}" precisa da prévia pública (o trecho que o visitante vê antes de comprar).`
      }
      if (!a.newFiles.length && a.preview) {
        expanded.value[cat.slug] = true
        return `A categoria "${cat.name}" precisa de ao menos um arquivo para o comprador.`
      }
    } else if (finalFileCount(a) === 0) {
      expanded.value[cat.slug] = true
      return `A categoria "${cat.name}" ficaria sem arquivos — remova a categoria inteira ou mantenha ao menos um.`
    }
  }
  if (!includedCount.value) {
    return 'Inclua ao menos uma categoria no pacote (arquivos + prévia).'
  }
  return null
}

/** Validação de um passo específico (erro ou null). */
function validateStep(n: number): string | null {
  if (n === 1 && !title.value.trim()) return 'Informe o título.'
  if (n === 2) return validateContent()
  if (n === 3 && priceCentsInput.value === null) return 'Preço mínimo de R$ 1,00.'
  return null
}

function next() {
  const err = validateStep(step.value)
  if (err) return (error.value = err)
  error.value = ''
  if (step.value < TOTAL_STEPS) step.value++
}
function back() {
  error.value = ''
  if (step.value > 1) step.value--
}
/** Clicar no stepper só volta para passos já vistos (avançar é pelo botão). */
function goToStep(n: number) {
  if (n < step.value) {
    error.value = ''
    step.value = n
  }
}
/** Enter/submit da form: avança nos passos, envia no último. */
function handlePrimary() {
  if (step.value < TOTAL_STEPS) next()
  else submit(false)
}

/** Resumo das categorias incluídas (passo de revisão). */
const includedSummary = computed(() =>
  categories.value
    .filter((c) => isIncluded(c.slug))
    .map((c) => ({ name: c.name, count: finalFileCount(areas.value[c.slug]) })),
)

// ---- Dados do preview ao vivo (PublishPreview, à direita) --------------------
const previewCover = computed(() => coverUrl.value || fileUrl(existingCoverPath.value) || null)
const previewCategories = computed<CategoryRef[]>(() =>
  categories.value.filter((c) => isIncluded(c.slug)).map((c) => ({ slug: c.slug, name: c.name })),
)
const previewMusicalName = computed(
  () => (musicalId.value && musicalOptions.value.find((m) => m.id === musicalId.value)?.name) || null,
)
const artistName = computed(() => auth.user?.name || auth.user?.email || null)

onMounted(async () => {
  // Contrato vigente aceito? Sem aceite, mostra o bloqueio com link.
  try {
    contractOk.value = (await artistsApi.contract()).upToDate
  } catch {
    contractOk.value = null // indefinido: deixa o backend decidir no envio
  }

  // Onboarding do Stripe completo? Sem ele, só rascunho.
  try {
    stripeOk.value = (await artistsApi.stripeStatus()).onboardingComplete
  } catch {
    stripeOk.value = null // indefinido: deixa o backend decidir no envio
  }

  try {
    const cats = await catalogApi.categories()
    categories.value = cats.categories
    subcategories.value = cats.subcategories
    musicals.value = cats.musicals
    for (const cat of cats.categories) {
      areas.value[cat.slug] = blankArea()
    }
    // Abre o primeiro acordeão por padrão (há sempre ≥1 a preencher).
    if (cats.categories[0]) expanded.value[cats.categories[0].slug] = true
  } catch {
    error.value = 'Erro ao carregar as categorias. Recarregue a página.'
  }

  // Em edição, pré-carrega metadados, arquivos existentes e prévias.
  if (editingId.value) {
    try {
      const mine = (await contentsApi.mine()).contents
      const current = mine.find((c) => c.id === editingId.value)
      if (current) {
        title.value = current.title
        description.value = current.description ?? ''
        priceReais.value = (current.priceCents / 100).toFixed(2)
        existingCoverPath.value = current.coverPath
        if (current.musical) {
          musicalId.value = current.musical.id
          editingMusical.value = current.musical
        }
        for (const item of current.items) {
          const area = areas.value[item.category.slug]
          if (!area) continue
          area.existing = true
          area.hasExistingPreview = true
          area.existingFiles = item.files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            remove: false,
          }))
          expanded.value[item.category.slug] = true // abre os que já têm conteúdo
        }
      }
    } catch {
      // Sem os dados atuais, o formulário funciona como novo envio.
    }
  }
})

// ---- Seleção de arquivos (input múltiplo escondido no box de adicionar) ----
function addFiles(slug: string, e: Event) {
  const input = e.target as HTMLInputElement
  const area = areas.value[slug]
  const picked = [...(input.files ?? [])]
  input.value = '' // permite escolher os mesmos arquivos de novo
  if (!area || !picked.length) return
  error.value = ''

  const accept = CATEGORY_ACCEPT[slug] ?? ''
  const rejected = picked.filter((f) => !extAllowed(accept, f.name))
  if (rejected.length) {
    error.value = `Tipo não aceito em ${slug}: ${rejected.map((f) => f.name).join(', ')} (aceita ${CATEGORY_HINT[slug]}).`
  }

  const room = MAX_FILES_PER_CATEGORY - finalFileCount(area)
  const accepted = picked.filter((f) => extAllowed(accept, f.name)).slice(0, Math.max(0, room))
  if (picked.length - rejected.length > accepted.length) {
    error.value = `Máximo de ${MAX_FILES_PER_CATEGORY} arquivos por categoria.`
  }

  for (const file of accepted) {
    area.newFiles.push({
      file,
      url: fileKind(file.name) === 'image' ? URL.createObjectURL(file) : null,
    })
  }
  if (accepted.length) area.remove = false // enviar arquivo desfaz a remoção
}

function removeNewFile(slug: string, index: number) {
  const area = areas.value[slug]
  const [gone] = area?.newFiles.splice(index, 1) ?? []
  if (gone?.url) URL.revokeObjectURL(gone.url)
}

function toggleExistingFile(file: ExistingFile) {
  file.remove = !file.remove
}

function pickPreview(slug: string, e: Event) {
  const input = e.target as HTMLInputElement
  const area = areas.value[slug]
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!area || !file) return
  if (!extAllowed(CATEGORY_PREVIEW_ACCEPT[slug] ?? '', file.name)) {
    error.value = `Prévia de ${slug} não aceita este tipo de arquivo.`
    return
  }
  if (area.previewUrl) URL.revokeObjectURL(area.previewUrl)
  area.preview = file
  area.previewUrl = fileKind(file.name) === 'image' ? URL.createObjectURL(file) : null
  area.remove = false
}

function clearPreview(slug: string) {
  const area = areas.value[slug]
  if (!area) return
  if (area.previewUrl) URL.revokeObjectURL(area.previewUrl)
  area.preview = null
  area.previewUrl = null
}

// Limpa os objectURLs criados para as thumbs.
onBeforeUnmount(() => {
  for (const area of Object.values(areas.value)) {
    for (const f of area.newFiles) if (f.url) URL.revokeObjectURL(f.url)
    if (area.previewUrl) URL.revokeObjectURL(area.previewUrl)
  }
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
})

function pickCover(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  cover.value = file
  coverUrl.value = URL.createObjectURL(file)
}

function clearCover() {
  if (coverUrl.value) URL.revokeObjectURL(coverUrl.value)
  cover.value = null
  coverUrl.value = null
}

function toggleRemove(slug: string) {
  const area = areas.value[slug]
  if (!area?.existing) return
  area.remove = !area.remove
  if (area.remove) {
    for (const f of area.newFiles) if (f.url) URL.revokeObjectURL(f.url)
    area.newFiles = []
    clearPreview(slug)
  }
}

function toggleSub(id: number) {
  const idx = selectedSubs.value.indexOf(id)
  if (idx >= 0) selectedSubs.value.splice(idx, 1)
  else selectedSubs.value.push(id)
}

async function submit(asDraft: boolean) {
  error.value = ''

  if (!asDraft && stripeOk.value === false) {
    return (error.value =
      'Complete seu cadastro de pagamentos (Stripe) para enviar obras à revisão. Enquanto isso, salve como rascunho.')
  }

  // Título e conteúdo são obrigatórios em ambos os casos.
  const e1 = validateStep(1)
  if (e1) {
    step.value = 1
    return (error.value = e1)
  }
  const e2 = validateContent()
  if (e2) {
    step.value = 2
    return (error.value = e2)
  }
  // Preço só é obrigatório para ENVIAR à revisão; rascunho pode ficar sem
  // (fica 0 e o artista define ao reenviar). Assim dá para salvar já no
  // passo 2, sem passar pelo preço.
  if (!asDraft) {
    const e3 = validateStep(3)
    if (e3) {
      step.value = 3
      return (error.value = e3)
    }
  }
  const priceCents = priceCentsInput.value ?? 0

  const form = new FormData()
  form.set('title', title.value.trim())
  form.set('description', description.value.trim())
  form.set('priceCents', String(priceCents))
  form.set('subcategoryIds', JSON.stringify(selectedSubs.value))
  // Vazio = sem tema (na edição, limpa um tema antes escolhido).
  form.set('musicalId', musicalId.value ? String(musicalId.value) : '')
  if (asDraft) form.set('draft', '1')

  const removeSlugs: string[] = []
  const removeFileIds: number[] = []
  for (const cat of categories.value) {
    const a = areas.value[cat.slug]
    if (!a) continue
    if (a.remove && a.existing) {
      removeSlugs.push(cat.slug)
      continue
    }
    for (const lf of a.newFiles) form.append(`files_${cat.slug}`, lf.file)
    for (const ef of a.existingFiles) if (ef.remove) removeFileIds.push(ef.id)
    if (a.preview) form.set(`preview_${cat.slug}`, a.preview)
  }
  if (removeSlugs.length) form.set('removeCategorySlugs', JSON.stringify(removeSlugs))
  if (removeFileIds.length) form.set('removeFileIds', JSON.stringify(removeFileIds))
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
    // Sem onboarding do Stripe, o backend nega o envio à revisão — acende
    // o aviso com o link do cadastro (o rascunho continua liberado).
    if (err instanceof ApiError && err.code === 'STRIPE_ONBOARDING_REQUIRED') {
      stripeOk.value = false
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

    <!-- Bloqueios ACIMA de tudo (visíveis desde o início, não só no fim):
         sem contrato aceito não publica nem salva; sem Stripe, só rascunho. -->
    <div v-if="contractOk === false" class="contract-warn">
      <p>
        📜 Antes de publicar, você precisa ler e aceitar os
        <strong>Termos do Artista</strong> (comissões, repasses e direitos autorais).
      </p>
      <RouterLink :to="{ path: '/contrato', query: { redirect: route.fullPath } }" class="contract-btn">
        Ler e aceitar os termos
      </RouterLink>
    </div>
    <div v-if="stripeOk === false" class="contract-warn">
      <p>
        💳 Sem seu <strong>cadastro de pagamentos (Stripe)</strong>, a obra só pode ser salva
        como rascunho — complete o cadastro para enviar à revisão e vender.
      </p>
      <RouterLink to="/artista/stripe" class="contract-btn">Completar cadastro</RouterLink>
    </div>

    <div class="publish-layout">
      <div class="publish-main">
    <!-- Progresso do assistente (4 passos): voltar clicando num já visto -->
    <ol class="stepper">
      <li
        v-for="s in STEPS"
        :key="s.n"
        class="stepper-item"
        :class="{ current: step === s.n, done: step > s.n }"
      >
        <button type="button" class="stepper-btn" :disabled="s.n >= step" @click="goToStep(s.n)">
          <span class="stepper-num">{{ step > s.n ? '✓' : s.n }}</span>
          <span class="stepper-label">{{ s.label }}</span>
        </button>
      </li>
    </ol>

    <!-- novalidate: a validação é NOSSA (por passo). Sem isso, o `required`
         de um campo escondido (outro passo) bloquearia o submit sem foco. -->
    <form class="form" novalidate @submit.prevent="handlePrimary">
      <!-- ============ PASSO 1: Detalhes ============ -->
      <div v-show="step === 1" class="step">
      <!-- Tema (opcional): data especial do ano a que a obra se liga -->
      <label v-if="musicals.length" class="field narrow">
        <span>Tema (opcional) — data especial do ano, se a obra se encaixar</span>
        <select v-model="musicalId">
          <option :value="null">Nenhum</option>
          <option v-for="m in musicalOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </label>

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
      </div>

      <!-- ============ PASSO 2: Conteúdo ============ -->
      <div v-show="step === 2" class="step">
      <!-- Áreas por categoria: preencher arquivo + prévia inclui no pacote -->
      <div class="field">
        <span>O que este pacote inclui * <em class="count">({{ includedCount }} de {{ categories.length }} categorias)</em></span>
        <div class="cat-areas">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="cat-area"
            :class="{ included: isIncluded(cat.slug), removed: areas[cat.slug]?.remove, open: expanded[cat.slug] }"
          >
            <!-- Cabeçalho do acordeão: clica para abrir/fechar a categoria -->
            <button
              type="button"
              class="cat-head"
              :aria-expanded="!!expanded[cat.slug]"
              @click="toggleExpand(cat.slug)"
            >
              <span class="cat-name">{{ cat.name }}</span>
              <span v-if="areas[cat.slug]?.remove" class="cat-state removed">será removida</span>
              <span v-else-if="isIncluded(cat.slug)" class="cat-state">no pacote</span>
              <span v-if="finalFileCount(areas[cat.slug])" class="cat-count">
                {{ finalFileCount(areas[cat.slug]) }} arq.
              </span>
              <svg
                class="cat-chevron"
                width="14"
                height="14"
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

            <!-- Corpo do acordeão (animação de altura via grid 0fr→1fr).
                 O padding vive no .cat-body-inner (padding no elemento com
                 overflow:hidden não colapsaria a 0 quando fechado). -->
            <div class="cat-body-wrap">
              <div class="cat-body">
                <div class="cat-body-inner">
            <template v-if="!areas[cat.slug]?.remove">
              <!-- Arquivos do comprador: boxes visuais + adicionar no FIM -->
              <p class="up-label">
                Arquivos que o comprador baixa — {{ CATEGORY_HINT[cat.slug] }} (máx. 50MB cada)
              </p>
              <div class="up-grid">
                <!-- já no servidor (edição) -->
                <div
                  v-for="ef in areas[cat.slug]?.existingFiles"
                  :key="`e${ef.id}`"
                  class="up-box"
                  :class="{ marked: ef.remove }"
                >
                  <FileGlyph :name="ef.fileName" />
                  <span class="up-name" :title="ef.fileName ?? ''">{{ ef.fileName }}</span>
                  <button
                    type="button"
                    class="up-x"
                    :title="ef.remove ? 'Desfazer remoção' : 'Remover arquivo'"
                    :aria-label="ef.remove ? 'Desfazer remoção' : `Remover ${ef.fileName}`"
                    @click="toggleExistingFile(ef)"
                  >
                    {{ ef.remove ? '↺' : '✕' }}
                  </button>
                </div>

                <!-- escolhidos agora -->
                <div
                  v-for="(lf, i) in areas[cat.slug]?.newFiles"
                  :key="`n${i}-${lf.file.name}`"
                  class="up-box novo"
                >
                  <img v-if="lf.url" :src="lf.url" :alt="lf.file.name" class="up-thumb" />
                  <FileGlyph v-else :name="lf.file.name" />
                  <span class="up-name" :title="lf.file.name">{{ lf.file.name }}</span>
                  <button
                    type="button"
                    class="up-x"
                    :aria-label="`Remover ${lf.file.name}`"
                    title="Remover"
                    @click="removeNewFile(cat.slug, i)"
                  >
                    ✕
                  </button>
                </div>

                <!-- adicionar (sempre no fim) -->
                <label class="up-add" :title="`Adicionar arquivos (${CATEGORY_HINT[cat.slug]})`">
                  <input
                    type="file"
                    multiple
                    class="sr-only"
                    :accept="CATEGORY_ACCEPT[cat.slug]"
                    @change="addFiles(cat.slug, $event)"
                  />
                  <span class="up-plus" aria-hidden="true">+</span>
                  <span class="up-add-label">Adicionar</span>
                </label>
              </div>

              <!-- Prévia pública: box único, mesmo visual -->
              <p class="up-label">
                Prévia pública — o que o visitante vê/ouve antes de comprar
                {{ areas[cat.slug]?.hasExistingPreview && !areas[cat.slug]?.preview ? '(atual mantida)' : '' }}
              </p>
              <div class="up-grid">
                <div v-if="areas[cat.slug]?.preview" class="up-box novo preview">
                  <img
                    v-if="areas[cat.slug]?.previewUrl"
                    :src="areas[cat.slug]!.previewUrl!"
                    :alt="areas[cat.slug]!.preview!.name"
                    class="up-thumb"
                  />
                  <FileGlyph v-else :name="areas[cat.slug]!.preview!.name" />
                  <span class="up-name" :title="areas[cat.slug]!.preview!.name">{{ areas[cat.slug]!.preview!.name }}</span>
                  <button
                    type="button"
                    class="up-x"
                    aria-label="Remover prévia"
                    title="Remover"
                    @click="clearPreview(cat.slug)"
                  >
                    ✕
                  </button>
                </div>
                <label v-else class="up-add" :class="{ kept: areas[cat.slug]?.hasExistingPreview }">
                  <input
                    type="file"
                    class="sr-only"
                    :accept="CATEGORY_PREVIEW_ACCEPT[cat.slug]"
                    @change="pickPreview(cat.slug, $event)"
                  />
                  <span class="up-plus" aria-hidden="true">+</span>
                  <span class="up-add-label">
                    {{ areas[cat.slug]?.hasExistingPreview ? 'Trocar prévia' : 'Prévia' }}
                  </span>
                </label>
              </div>
            </template>

            <button
              v-if="areas[cat.slug]?.existing"
              type="button"
              class="cat-remove"
              @click="toggleRemove(cat.slug)"
            >
              {{ areas[cat.slug]?.remove ? 'Desfazer remoção' : 'Remover do pacote' }}
            </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- ============ PASSO 3: Capa e preço ============ -->
      <div v-show="step === 3" class="step">
      <!-- Capa: box visual 4:3 (mesma linguagem dos uploads por categoria) -->
      <div class="field">
        <span>
          Capa da obra (opcional) — imagem que aparece nos cards
          {{ existingCoverPath && !cover ? '(atual mantida)' : '' }}
        </span>
        <div class="up-grid">
          <!-- Capa nova escolhida agora -->
          <div v-if="cover" class="up-box novo cover-box">
            <img :src="coverUrl ?? undefined" :alt="cover.name" class="up-thumb" />
            <span class="up-name" :title="cover.name">{{ cover.name }}</span>
            <button
              type="button"
              class="up-x"
              aria-label="Remover capa escolhida"
              title="Remover"
              @click="clearCover"
            >
              ✕
            </button>
          </div>
          <!-- Capa atual do servidor (edição), enquanto não trocar -->
          <div v-else-if="existingCoverPath" class="up-box cover-box">
            <img :src="fileUrl(existingCoverPath) ?? undefined" alt="Capa atual" class="up-thumb" />
            <span class="up-name">capa atual</span>
          </div>
          <label class="up-add cover-box" v-if="!cover">
            <input
              type="file"
              class="sr-only"
              accept=".jpg,.jpeg,.png,.webp"
              @change="pickCover($event)"
            />
            <span class="up-plus" aria-hidden="true">+</span>
            <span class="up-add-label">{{ existingCoverPath ? 'Trocar capa' : 'Capa' }}</span>
          </label>
        </div>
      </div>

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
      </div>
      <p v-else-if="simulating" class="muted">Calculando repasse…</p>
      </div>

      <!-- ============ PASSO 4: Revisão e envio ============ -->
      <div v-show="step === 4" class="step">
        <!-- Resumo do que será enviado -->
        <div class="review">
          <h2 class="review-title">Confira antes de enviar</h2>
          <dl class="review-rows">
            <div class="review-row">
              <dt>Título</dt>
              <dd>{{ title || '—' }}</dd>
            </div>
            <div v-if="musicalId" class="review-row">
              <dt>Tema</dt>
              <dd>{{ musicalOptions.find((m) => m.id === musicalId)?.name }}</dd>
            </div>
            <div class="review-row">
              <dt>Inclui</dt>
              <dd>
                <span v-if="!includedSummary.length" class="muted">nenhuma categoria</span>
                <span v-for="it in includedSummary" v-else :key="it.name" class="review-chip">
                  {{ it.name }} ({{ it.count }})
                </span>
              </dd>
            </div>
            <div class="review-row">
              <dt>Preço</dt>
              <dd>{{ priceCentsInput ? formatPrice(priceCentsInput) : '—' }}</dd>
            </div>
            <div v-if="simulation" class="review-row">
              <dt>Você recebe (por venda)</dt>
              <dd class="gold">{{ formatPrice(simulation.valorLiquidoArtistaCents) }}</dd>
            </div>
          </dl>
          <p class="muted small">
            Ao enviar, a obra entra na fila de revisão da equipe. Você acompanha o status em
            "Meus Conteúdos".
          </p>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- Navegação do assistente -->
      <div class="wizard-nav">
        <button v-if="step > 1" type="button" class="secondary" @click="back">← Voltar</button>
        <span class="nav-spacer" />
        <!-- Rascunho disponível a partir do passo 2 (já com conteúdo);
             não exige preço, então dá para salvar sem chegar ao fim. -->
        <button
          v-if="step >= 2"
          type="button"
          class="secondary"
          :disabled="sending || contractOk === false"
          @click="submit(true)"
        >
          Salvar rascunho
        </button>
        <button v-if="step < TOTAL_STEPS" type="submit" class="primary">Continuar →</button>
        <button
          v-else
          type="submit"
          class="primary"
          :disabled="sending || contractOk === false || stripeOk === false"
        >
          {{ sending ? 'Enviando…' : 'Enviar para revisão' }}
        </button>
      </div>
    </form>
      </div>

      <!-- Preview AO VIVO do card, à direita (atualiza a cada passo) -->
      <aside class="publish-preview">
        <p class="preview-label">Prévia da publicação</p>
        <PublishPreview
          :title="title"
          :price-cents="priceCentsInput"
          :cover-url="previewCover"
          :categories="previewCategories"
          :musical-name="previewMusicalName"
          :artist-name="artistName"
        />
      </aside>
    </div>
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

// Duas colunas: assistente à esquerda, preview do card à direita (sticky).
.publish-layout {
  display: grid;
  grid-template-columns: minmax(0, 640px) 260px;
  gap: 2.5rem;
  align-items: start;

  // Empilha em telas estreitas (preview vai para baixo do formulário).
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
}

.publish-main {
  min-width: 0;
}

.publish-preview {
  position: sticky;
  top: 84px; // abaixo do header fixo (64px) + folga

  @media (max-width: 960px) {
    position: static;
    max-width: 260px;
  }
}

.preview-label {
  @include label-type;
  font-size: 0.68rem;
  color: $text-secondary;
  margin-bottom: 0.75rem;
}

.form {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

// ---- Assistente: barra de progresso (stepper) --------------------------------
// Grupo blocado (guia §3): 4 células coladas, atual em dourado, concluídas
// com ✓ e clicáveis para voltar.
.stepper {
  list-style: none;
  display: flex;
  max-width: 640px;
  margin: 1.25rem 0 2rem;
  border: 1px solid $line;
}

.stepper-item {
  flex: 1;

  & + & {
    border-left: 1px solid $line;
  }
}

.stepper-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 0.6rem;
  background: none;
  border: none;
  color: $text-secondary;
  cursor: pointer;
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;

  &:disabled {
    cursor: default;
  }
}

.stepper-num {
  @include label-type;
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $line;
  font-size: 0.68rem;
}

.stepper-label {
  @include label-type;
  font-size: 0.64rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stepper-item.current .stepper-btn {
  color: $gold-text;
  background: $fill-active-solid;

  .stepper-num {
    border-color: rgba($color-primary, 0.6);
    color: $gold-text;
  }
}

.stepper-item.done .stepper-btn {
  color: $gold-text;

  &:hover {
    background: $fill-hover-solid;
  }

  .stepper-num {
    border-color: rgba($color-primary, 0.5);
    color: $gold-text;
  }
}

// Estreito: só os números (some o rótulo).
@media (max-width: 560px) {
  .stepper-label {
    display: none;
  }
}

// Cada passo é uma vista da form (mesma gramática de campos).
.step {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

// Navegação: Voltar à esquerda, Continuar/Enviar à direita.
.wizard-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.nav-spacer {
  flex: 1;
}

// Revisão (passo 4): grupo blocado com as linhas do resumo.
.review {
  border: 1px solid $line;
  background: $fill-hover-solid;
  padding: 1.1rem 1.25rem;
}

.review-title {
  @include label-type;
  color: $text-secondary;
  margin-bottom: 0.75rem;
}

.review-rows {
  display: flex;
  flex-direction: column;
}

.review-row {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);
  font-size: 0.9rem;

  &:last-child {
    border-bottom: none;
  }

  dt {
    color: rgba(var(--fg-rgb), 0.6);
    flex-shrink: 0;
  }

  dd {
    text-align: right;
    color: rgba(var(--fg-rgb), 0.9);
    font-weight: 600;

    &.gold {
      color: $gold-strong;
    }
  }
}

.review-chip {
  display: inline-block;
  margin-left: 0.4rem;
  @include label-type;
  font-size: 0.58rem;
  font-weight: 600;
  padding: 0.2rem 0.45rem;
  border: 1px solid $line;
  color: $text-secondary;
}

.small {
  font-size: 0.82rem;
  margin-top: 0.6rem;
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
  textarea,
  select {
    @include block-input;
  }

  input[type='file'] {
    color: rgba(var(--fg-rgb), 0.7);
  }

  &.narrow input {
    max-width: 160px;
  }

  &.narrow select {
    max-width: 320px;
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

// Cada categoria é um ACORDEÃO: cabeçalho clicável + corpo que expande.
.cat-area {
  border: 1px solid $line;
  margin: 0 0 -1px;
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

// Cabeçalho: botão de largura total (nome + estado + contagem + chevron).
.cat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: inherit;
  transition: background-color 0.5s $ease-brand;

  &:hover {
    background: $fill-hover-solid;
  }
}

// Nome à esquerda; o `auto` empurra estado + contagem + chevron p/ direita.
.cat-name {
  font-family: $font-display;
  font-size: 1.05rem;
  margin-right: auto;
}

.cat-count {
  font-size: 0.78rem;
  color: $text-dim;
}

// Chevron no fim, gira quando o acordeão está aberto.
.cat-chevron {
  color: $text-secondary;
  transition: transform 0.4s $ease-brand;
}
.cat-area.open .cat-chevron {
  transform: rotate(180deg);
}

// Corpo: anima a altura via grid 0fr→1fr (sem saber a altura do conteúdo);
// o overflow do .cat-body recorta quando fechado.
.cat-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.4s $ease-brand;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.cat-area.open .cat-body-wrap {
  grid-template-rows: 1fr;
}

.cat-body {
  overflow: hidden; // BFC + recorte; SEM padding (senão não colapsa a 0)
}

.cat-body-inner {
  padding: 0 1.25rem 1.1rem;
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

// ---- Área visual de upload (boxes) -------------------------------------------
.up-label {
  margin-top: 0.9rem;
  font-size: 0.8rem;
  color: rgba(var(--fg-rgb), 0.6);
}

.up-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

// Box de arquivo: quadrado blocado (guia §3) com o preview do item —
// thumb para imagem; ícone (nota/play/folha) para o resto — e o nome.
.up-box {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.4rem;
  border: 1px solid $line;
  background: $color-back;
  overflow: hidden;
  transition: border-color 0.5s $ease-brand, opacity 0.5s $ease-brand;

  &.novo {
    border-color: rgba($color-primary, 0.45);
  }

  // Arquivo existente marcado para remoção.
  &.marked {
    opacity: 0.45;
    border-color: rgba($color-error, 0.5);

    .up-name {
      text-decoration: line-through;
    }
  }
}

// Thumb de imagem ocupa o box inteiro; o nome vira uma faixa na base.
.up-thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.up-box:has(.up-thumb) .up-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  padding: 0.25rem 0.4rem;
  background: color-mix(in srgb, rgb(var(--bg-rgb)) 78%, transparent);
}

.up-name {
  max-width: 100%;
  font-size: 0.62rem;
  line-height: 1.25;
  color: rgba(var(--fg-rgb), 0.7);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ✕ / ↺ no canto do box.
.up-x {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-left: 1px solid $line;
  border-bottom: 1px solid $line;
  background: color-mix(in srgb, rgb(var(--fg-rgb)) 6%, rgb(var(--bg-rgb)));
  color: $color-error;
  font-size: 0.65rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.5s $ease-brand;

  &:hover {
    background: color-mix(in srgb, $color-error 18%, rgb(var(--bg-rgb)));
  }
}

// Box de ADICIONAR (sempre no fim da lista): tracejado, vira input nativo
// (label envolve o input escondido — clique abre o finder, com `multiple`).
.up-add {
  width: 96px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 1px dashed rgba(var(--fg-rgb), 0.3);
  color: rgba(var(--fg-rgb), 0.55);
  cursor: pointer;
  transition: border-color 0.5s $ease-brand, color 0.5s $ease-brand,
    background-color 0.5s $ease-brand;

  &:hover,
  &:focus-within {
    border-color: rgba($color-primary, 0.6);
    color: $gold-text;
    background: $fill-hover-solid;
  }
}

.up-plus {
  font-size: 1.6rem;
  line-height: 1;
  font-weight: 300;
}

.up-add-label {
  @include label-type;
  font-size: 0.58rem;
}

// Capa: box maior em 4:3 — a proporção real do card do catálogo.
.cover-box {
  width: 152px;
  height: 114px;
}

// Input escondido mas acessível (foco pelo teclado continua funcionando).
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
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
