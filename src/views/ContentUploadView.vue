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
import {
  ApiError,
  artistsApi,
  catalogApi,
  contentsApi,
  fileUrl,
  formatPrice,
  type Category,
  type FeeSimulation,
  type Musical,
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

// Musicais (2026-07-22): classificação ACIMA das categorias. Antes de tudo,
// o artista escolhe se a obra é conteúdo PADRÃO ou um MUSICAL (data especial
// — Natal, Dia das Mães, …); se musical, seleciona qual. O pacote por dentro
// (categorias/arquivos/preço) continua idêntico.
const musicals = ref<Musical[]>([])
const contentKind = ref<'padrao' | 'musical'>('padrao')
const musicalId = ref<number | null>(null)

// Em edição, o musical salvo pode ter sido desativado pelo admin depois —
// ele não vem em GET /categories, mas precisa aparecer no select (o backend
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

/** Arquivos que a categoria terá após o envio (existentes mantidos + novos). */
function finalFileCount(a: CatArea) {
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
          contentKind.value = 'musical'
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

  const priceCents = Math.round(Number(priceReais.value.replace(',', '.')) * 100)
  if (!title.value.trim()) return (error.value = 'Informe o título.')
  if (contentKind.value === 'musical' && !musicalId.value) {
    return (error.value = 'Selecione qual musical (data especial) esta obra pertence.')
  }

  // Validação por categoria: nova precisa de arquivos + prévia; mantida
  // não pode terminar sem arquivos.
  for (const cat of categories.value) {
    const a = areas.value[cat.slug]
    if (!a || a.remove) continue
    if (!a.existing) {
      if (a.newFiles.length && !a.preview) {
        return (error.value = `A categoria "${cat.name}" precisa da prévia pública (o trecho que o visitante vê antes de comprar).`)
      }
      if (!a.newFiles.length && a.preview) {
        return (error.value = `A categoria "${cat.name}" precisa de ao menos um arquivo para o comprador.`)
      }
    } else if (finalFileCount(a) === 0) {
      return (error.value = `A categoria "${cat.name}" ficaria sem arquivos — remova a categoria inteira ou mantenha ao menos um.`)
    }
  }
  if (!includedCount.value) {
    return (error.value = 'Inclua ao menos uma categoria no pacote (arquivos + prévia).')
  }
  if (!Number.isInteger(priceCents) || priceCents < 100)
    return (error.value = 'Preço mínimo de R$ 1,00.')

  const form = new FormData()
  form.set('title', title.value.trim())
  form.set('description', description.value.trim())
  form.set('priceCents', String(priceCents))
  form.set('subcategoryIds', JSON.stringify(selectedSubs.value))
  // Vazio = conteúdo padrão (na edição, limpa um musical antes escolhido).
  form.set('musicalId', contentKind.value === 'musical' && musicalId.value ? String(musicalId.value) : '')
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

    <!-- Sem onboarding do Stripe: só rascunho (a revisão fica bloqueada) -->
    <div v-if="stripeOk === false" class="contract-warn">
      <p>
        💳 Sem seu <strong>cadastro de pagamentos (Stripe)</strong>, a obra só pode ser salva
        como rascunho — complete o cadastro para enviar à revisão e vender.
      </p>
      <RouterLink to="/artista/stripe" class="contract-btn">Completar cadastro</RouterLink>
    </div>

    <form class="form" @submit.prevent="submit(false)">
      <!-- Tipo de conteúdo (acima de tudo): padrão × musical (data especial) -->
      <div class="field">
        <span>Tipo de conteúdo *</span>
        <div class="chips">
          <button
            type="button"
            class="chip"
            :class="{ active: contentKind === 'padrao' }"
            @click="contentKind = 'padrao'"
          >
            Conteúdo padrão
          </button>
          <button
            type="button"
            class="chip"
            :class="{ active: contentKind === 'musical' }"
            @click="contentKind = 'musical'"
          >
            Musical
          </button>
        </div>
      </div>

      <label v-if="contentKind === 'musical'" class="field narrow">
        <span>Qual musical? * — cada um corresponde a uma data especial do ano</span>
        <select v-model="musicalId">
          <option :value="null" disabled>Selecione…</option>
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
          </fieldset>
        </div>
      </div>

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

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button
          type="submit"
          class="primary"
          :disabled="sending || contractOk === false || stripeOk === false"
        >
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
