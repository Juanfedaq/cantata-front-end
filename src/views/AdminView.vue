<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import BlockSelect from '@/components/BlockSelect.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { CATEGORY_KINDS, KIND_LABEL, type CategoryKind } from '@/categoryKinds'
import { CATEGORY_ICONS } from '@/categoryIcons'
import { SUBCATEGORIES_ENABLED } from '@/flags'
import {
  adminApi,
  catalogApi,
  purchasesApi,
  fileUrl,
  formatPrice,
  type AdminCategory,
  type AdminContent,
  type AdminDashboard,
  type AdminMusical,
  type AdminPurchase,
  type AdminUser,
  type Category,
  type ContentStatus,
  type DashboardPeriod,
  type Musical,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'
import { catHue } from '@/utils/categoryStyle'

type Tab = 'dashboard' | 'moderacao' | 'usuarios' | 'categorias' | 'subcategorias' | 'temas'
const tab = ref<Tab>('dashboard')
const error = ref('')

// Todas as categorias ATIVAS. O card da moderação mostra todas, sempre —
// inclusive as que a obra não tem, com contagem zero. Assim a linha de ícones
// tem a mesma altura e largura em todo card, e a grade para de ficar
// desalinhada quando uma obra traz três categorias e a vizinha traz uma.
const allCategories = ref<Category[]>([])

async function loadCategories() {
  try {
    allCategories.value = (await catalogApi.categories()).categories
  } catch {
    // Sem a lista, o card cai para as categorias que a própria obra traz.
  }
}

/**
 * As categorias a listar no card de uma obra: as ativas MAIS as que a própria
 * obra usa.
 *
 * A segunda parte existe porque categoria recolhida sai de `GET /categories`.
 * Sem ela, uma obra publicada antes do recolhimento apareceria na moderação
 * sem um pedaço do pacote — e o admin aprovaria sem ver o que estava lá
 * dentro, que é exatamente o que esta tela existe para evitar.
 */
function checkCategories(c: AdminContent) {
  const extras = c.items
    .map((i) => i.category)
    .filter((cat) => !allCategories.value.some((a) => a.slug === cat.slug))
  return [...allCategories.value, ...extras]
}

/** O item do pacote naquela categoria — `undefined` quando a obra não a traz. */
function itemOf(c: AdminContent, slug: string) {
  return c.items.find((i) => i.category.slug === slug)
}

/** Quantos arquivos a obra tem nesta categoria (0 quando não a inclui). */
function fileCount(c: AdminContent, slug: string) {
  return itemOf(c, slug)?.files.length ?? 0
}

// ---- Moderação ----
// Os rótulos vivem aqui porque o BlockSelect precisa deles em lista — e é
// bom: o texto da opção deixa de ficar espalhado pelo template.
const STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'aprovado', label: 'Aprovados' },
  { value: 'reprovado', label: 'Reprovados' },
]

const modStatus = ref<ContentStatus>('em_revisao')
const contents = ref<AdminContent[]>([])
const loadingContents = ref(false)
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')

async function loadContents() {
  loadingContents.value = true
  error.value = ''
  try {
    contents.value = (await adminApi.contents(modStatus.value)).contents
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer a fila de revisão agora. Tente de novo em instantes.'
  } finally {
    loadingContents.value = false
  }
}

// Admin pode baixar os arquivos completos para avaliar antes de aprovar
// (a rota de download libera para admin sem compra) — um por ARQUIVO.
const downloadingFile = ref<number | null>(null)
async function downloadFull(c: AdminContent, file: { id: number; fileName: string | null }) {
  downloadingFile.value = file.id
  error.value = ''
  try {
    await purchasesApi.download(c.id, file.id, file.fileName)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos entregar o arquivo agora. Tente de novo em instantes.'
  } finally {
    downloadingFile.value = null
  }
}

async function approve(c: AdminContent) {
  try {
    await adminApi.approve(c.id)
    contents.value = contents.value.filter((x) => x.id !== c.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos aprovar a obra agora. Tente de novo em instantes.'
  }
}

async function reject(c: AdminContent) {
  if (!rejectReason.value.trim()) {
    error.value = 'Informe o motivo da reprovação.'
    return
  }
  try {
    await adminApi.reject(c.id, rejectReason.value.trim())
    contents.value = contents.value.filter((x) => x.id !== c.id)
    rejectingId.value = null
    rejectReason.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos devolver a obra agora. Tente de novo em instantes.'
  }
}

// ---- Bloqueio de obra publicada (takedown) ----
// Só para obra APROVADA: tira do ar na hora (vitrine, link direto e novas
// compras). Não desfaz venda nenhuma — quem comprou continua baixando.
const blockingId = ref<string | null>(null)
const blockReason = ref('')

async function block(c: AdminContent) {
  if (!blockReason.value.trim()) {
    error.value = 'Informe o motivo do bloqueio.'
    return
  }
  try {
    await adminApi.block(c.id, blockReason.value.trim())
    // A obra CONTINUA na lista (o admin precisa poder desbloquear) — só muda
    // de estado, ao contrário de aprovar/reprovar, que a tiram da fila.
    c.adminBlocked = true
    c.adminBlockedReason = blockReason.value.trim()
    blockingId.value = null
    blockReason.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos tirar a obra do ar agora. Tente de novo em instantes.'
  }
}

async function unblock(c: AdminContent) {
  try {
    await adminApi.unblock(c.id)
    c.adminBlocked = false
    c.adminBlockedReason = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos devolver a obra ao ar agora. Tente de novo em instantes.'
  }
}

// ---- Usuários ----
const users = ref<AdminUser[]>([])
const usersTotal = ref(0)
const userQuery = ref('')
const loadingUsers = ref(false)

async function loadUsers() {
  loadingUsers.value = true
  error.value = ''
  try {
    const res = await adminApi.users({ q: userQuery.value || undefined })
    users.value = res.users
    usersTotal.value = res.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer os usuários agora. Tente de novo em instantes.'
  } finally {
    loadingUsers.value = false
  }
}

// ---- Dashboard ----
// Substituiu a lista crua de compras como visão principal (2026-08-06): o
// admin não compra, então uma tela de transações não era o que ele precisava
// ver primeiro. A lista continua, no rodapé, para o suporte achar UMA venda.
//
// ⚠️ A conta do dinheiro está documentada na rota (`admin/dashboard`) e em
// `DASHBOARD-ADMIN.md`. O resumo: bruto = comissão + taxa do Stripe + repasse,
// e as três têm donos diferentes. Nunca some comissão com gateway.
const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: 'tudo', label: 'Desde o começo' },
]

const period = ref<DashboardPeriod>('30d')
const dash = ref<AdminDashboard | null>(null)
const loadingDash = ref(false)

async function loadDashboard() {
  loadingDash.value = true
  error.value = ''
  try {
    dash.value = await adminApi.dashboard(period.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos montar o painel agora. Tente de novo em instantes.'
  } finally {
    loadingDash.value = false
  }
}

/** Fatia da barra de decomposição, em % do bruto. */
function fatia(cents: number) {
  const bruto = dash.value?.resumo.grossCents ?? 0
  return bruto > 0 ? (cents / bruto) * 100 : 0
}

/** Linhas do bloco "precisa de atenção" — só as que têm algo a dizer. */
const alertas = computed(() => {
  const a = dash.value?.atencao
  if (!a) return []
  const rotulos: Record<string, string> = {
    // Pendente é Pix/boleto esperando confirmação: ainda NÃO é dinheiro que
    // entrou, e por isso fica fora de todos os totais acima.
    pendente: 'aguardando pagamento',
    reembolsado: 'reembolsada(s)',
    falhou: 'não se concluíram',
  }
  return (['pendente', 'reembolsado', 'falhou'] as const)
    .filter((k) => a[k])
    .map((k) => ({ key: k, label: rotulos[k]!, ...a[k]! }))
})

/**
 * Barras do gráfico, já normalizadas.
 *
 * A série vem do servidor só com os períodos QUE TIVERAM venda. Preencher os
 * buracos é trabalho daqui: sem isso, dois dias com venda separados por uma
 * semana parada apareceriam colados, e o gráfico mentiria sobre o ritmo.
 */
const barras = computed(() => {
  const d = dash.value
  if (!d) return []
  const porBucket = new Map(d.serie.map((s) => [s.bucket, s]))
  const chaves: string[] = []
  const hoje = new Date()

  if (d.bucket === 'dia') {
    for (let i = 29; i >= 0; i--) {
      const dia = new Date(hoje)
      dia.setDate(hoje.getDate() - i)
      chaves.push(chaveDoDia(dia))
    }
  } else if (d.period === '12m') {
    for (let i = 11; i >= 0; i--) {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      chaves.push(`${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`)
    }
  } else {
    // "Desde o começo": o intervalo é o que a própria série disser.
    chaves.push(...d.serie.map((s) => s.bucket))
  }

  // Seguro contra desencontro de fuso: se o servidor devolveu um período que
  // as chaves acima não cobrem, ele entra no fim em vez de sumir do gráfico.
  for (const s of d.serie) {
    if (!chaves.includes(s.bucket)) chaves.push(s.bucket)
  }

  const teto = Math.max(1, ...d.serie.map((s) => s.grossCents))
  return chaves.map((chave) => {
    const s = porBucket.get(chave)
    const gross = s?.grossCents ?? 0
    return {
      chave,
      rotulo: rotuloBucket(chave, d.bucket),
      salesCount: s?.salesCount ?? 0,
      grossCents: gross,
      commissionCents: s?.commissionCents ?? 0,
      altura: (gross / teto) * 100,
    }
  })
})

/**
 * Data como "2026-08-06" no fuso LOCAL.
 *
 * `toISOString()` converteria para UTC, e o agrupamento do servidor
 * (`DATE_FORMAT`) usa a hora local dele. Em Brasília isso desloca tudo que
 * acontece depois das 21h para o dia seguinte — uma venda da noite cairia numa
 * coluna que a lista de chaves nem gerou.
 */
function chaveDoDia(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** "2026-08-06" → "6/8"; "2026-08" → "ago/26". */
function rotuloBucket(chave: string, bucket: 'dia' | 'mes') {
  const [ano, mes, dia] = chave.split('-')
  if (bucket === 'dia') return `${Number(dia)}/${Number(mes)}`
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1]}/${ano!.slice(2)}`
}

// ---- Compras (tabela no rodapé do dashboard) ----
const purchases = ref<AdminPurchase[]>([])
const loadingPurchases = ref(false)

async function loadPurchases() {
  loadingPurchases.value = true
  error.value = ''
  try {
    purchases.value = (await adminApi.purchases()).purchases
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer as compras agora. Tente de novo em instantes.'
  } finally {
    loadingPurchases.value = false
  }
}

// ---- Subcategorias ----
const subcategories = ref<Subcategory[]>([])
const newSubType = ref<SubcategoryType>('instrumento')
const newSubName = ref('')

async function loadSubcategories() {
  try {
    subcategories.value = (await catalogApi.categories()).subcategories
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer as etiquetas agora. Tente de novo em instantes.'
  }
}

async function createSub() {
  if (!newSubName.value.trim()) return
  error.value = ''
  try {
    const { subcategory } = await adminApi.createSubcategory(newSubType.value, newSubName.value.trim())
    subcategories.value.push(subcategory)
    newSubName.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos criar a etiqueta agora. Tente de novo em instantes.'
  }
}

async function deactivateSub(sub: Subcategory) {
  try {
    await adminApi.updateSubcategory(sub.id, { active: false })
    subcategories.value = subcategories.value.filter((s) => s.id !== sub.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos salvar a mudança agora. Tente de novo em instantes.'
  }
}

// ---- Temas (datas especiais, etiqueta opcional da obra) ----
// Mesmo desenho da aba Categorias (2026-08-06): lista com marca, resumo e
// ações, e um cartão de criar/editar no lugar do campo solto. Endpoints e
// dados mantêm o nome interno "musical".
//
// Duas diferenças de propósito em relação às categorias:
// - Tema não tem ícone nem cor. A marca é sempre o calendário, na tinta
//   neutra — inventar uma cor por tema seria enfeite sem significado.
// - Não há guarda de "último ativo". O tema é opcional na obra, então a
//   plataforma funciona perfeitamente com nenhum tema no ar.
const musicals = ref<AdminMusical[]>([])
const loadingMusicals = ref(false)
const musicalMessage = ref('')

const editingMusical = ref<AdminMusical | null>(null)
const musicalDraft = ref('')
const creatingMusical = ref(false)
const savingMusical = ref(false)

async function loadMusicals() {
  loadingMusicals.value = true
  error.value = ''
  try {
    musicals.value = (await adminApi.allMusicals()).musicals
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer os temas agora. Tente de novo em instantes.'
  } finally {
    loadingMusicals.value = false
  }
}

function startCreateMusical() {
  creatingMusical.value = true
  editingMusical.value = null
  musicalMessage.value = ''
  musicalDraft.value = ''
}

function startEditMusical(m: AdminMusical) {
  creatingMusical.value = false
  editingMusical.value = m
  musicalMessage.value = ''
  musicalDraft.value = m.name
}

function cancelMusicalEdit() {
  creatingMusical.value = false
  editingMusical.value = null
}

async function saveMusical() {
  const nome = musicalDraft.value.trim()
  if (!nome) {
    error.value = 'Falta o nome do tema.'
    return
  }
  savingMusical.value = true
  error.value = ''
  try {
    if (creatingMusical.value) {
      const { musical } = await adminApi.createMusical(nome)
      // O POST devolve o tema recém-criado, que por definição não marca obra
      // nenhuma ainda — daí o contentCount 0 montado aqui.
      musicals.value.push({ ...musical, active: true, contentCount: 0 })
      musicalMessage.value = `O tema "${musical.name}" está no ar.`
    } else if (editingMusical.value) {
      const { musical } = await adminApi.updateMusical(editingMusical.value.id, { name: nome })
      const i = musicals.value.findIndex((x) => x.id === musical.id)
      if (i >= 0) musicals.value[i] = musical
      musicalMessage.value = 'Tema atualizado.'
    }
    cancelMusicalEdit()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos salvar o tema agora. Tente de novo em instantes.'
  } finally {
    savingMusical.value = false
  }
}

async function toggleMusicalActive(m: AdminMusical) {
  error.value = ''
  musicalMessage.value = ''
  try {
    const { musical } = await adminApi.updateMusical(m.id, { active: !m.active })
    const i = musicals.value.findIndex((x) => x.id === musical.id)
    if (i >= 0) musicals.value[i] = musical
    musicalMessage.value = musical.active
      ? `"${musical.name}" voltou aos formulários e aos filtros.`
      : `"${musical.name}" saiu dos formulários e dos filtros. As obras já marcadas não mudam.`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos salvar a mudança agora. Tente de novo em instantes.'
  }
}

async function removeMusical(m: AdminMusical) {
  const aviso =
    m.contentCount > 0
      ? `"${m.name}" marca ${m.contentCount} obra(s). Ele não será apagado — vai ser recolhido: sai dos formulários e dos filtros, e as obras seguem marcadas. Seguir?`
      : `Apagar o tema "${m.name}"? Ele não marca nenhuma obra, então some de vez.`
  if (!confirm(aviso)) return
  error.value = ''
  try {
    const { deleted, message } = await adminApi.deleteMusical(m.id)
    musicalMessage.value = message
    if (deleted) musicals.value = musicals.value.filter((x) => x.id !== m.id)
    else await loadMusicals()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos remover o tema agora. Tente de novo em instantes.'
  }
}

// ---- Categorias (editáveis desde 2026-08-06) --------------------------------
// Renomear, trocar ícone e matiz, reordenar, criar e recolher. O que NÃO se
// edita depois é a natureza de uma categoria que já tem obra dentro (o
// backend recusa) e o slug, que está em URL pública.
const adminCategories = ref<AdminCategory[]>([])
const loadingCats = ref(false)
const catMessage = ref('')

// Rascunho da edição em curso. Fica separado do item da lista para o admin
// poder desistir: enquanto ele mexe, a lista continua mostrando o que está
// salvo de verdade.
const editingCat = ref<AdminCategory | null>(null)
const catDraft = ref({ name: '', kind: 'documento' as CategoryKind, icon: 'documento', hue: 45 })
const creatingCat = ref(false)
const savingCat = ref(false)

const KIND_OPTIONS = CATEGORY_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))

/**
 * Matizes oferecidas ao admin. Régua fechada, não seletor livre de cor: a
 * plataforma trava saturação e luminância no CSS e deixa só a matiz variar —
 * é o que faz as cores geradas conviverem com a paleta editorial. Um seletor
 * livre devolveria roxo neon e branco puro no meio das tags.
 */
const HUE_OPTIONS = [215, 42, 150, 335, 265, 190, 15, 95, 300, 245, 65, 355]

async function loadAdminCategories() {
  loadingCats.value = true
  error.value = ''
  try {
    adminCategories.value = (await adminApi.allCategories()).categories
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos trazer as categorias agora. Tente de novo em instantes.'
  } finally {
    loadingCats.value = false
  }
}

function startCreate() {
  creatingCat.value = true
  editingCat.value = null
  catMessage.value = ''
  catDraft.value = { name: '', kind: 'documento', icon: 'documento', hue: 215 }
}

function startEdit(c: AdminCategory) {
  creatingCat.value = false
  editingCat.value = c
  catMessage.value = ''
  catDraft.value = { name: c.name, kind: c.kind, icon: c.icon, hue: c.hue }
}

function cancelCatEdit() {
  creatingCat.value = false
  editingCat.value = null
}

async function saveCat() {
  if (!catDraft.value.name.trim()) {
    error.value = 'Falta o nome da categoria.'
    return
  }
  savingCat.value = true
  error.value = ''
  try {
    if (creatingCat.value) {
      const { category, message } = await adminApi.createCategory({
        name: catDraft.value.name.trim(),
        kind: catDraft.value.kind,
        icon: catDraft.value.icon,
        hue: catDraft.value.hue,
      })
      adminCategories.value.push(category)
      catMessage.value = message
    } else if (editingCat.value) {
      // A natureza só vai junto quando a categoria ainda está vazia — mandar
      // `kind` numa que já tem obra devolve 409, e com razão.
      const payload: Parameters<typeof adminApi.updateCategory>[1] = {
        name: catDraft.value.name.trim(),
        icon: catDraft.value.icon,
        hue: catDraft.value.hue,
      }
      if (editingCat.value.contentCount === 0) payload.kind = catDraft.value.kind
      const { category, message } = await adminApi.updateCategory(editingCat.value.id, payload)
      const i = adminCategories.value.findIndex((c) => c.id === category.id)
      if (i >= 0) adminCategories.value[i] = category
      catMessage.value = message
    }
    cancelCatEdit()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos salvar a categoria agora. Tente de novo em instantes.'
  } finally {
    savingCat.value = false
  }
}

async function toggleCatActive(c: AdminCategory) {
  error.value = ''
  catMessage.value = ''
  try {
    const { category } = await adminApi.updateCategory(c.id, { active: !c.active })
    const i = adminCategories.value.findIndex((x) => x.id === category.id)
    if (i >= 0) adminCategories.value[i] = category
    catMessage.value = category.active
      ? `"${category.name}" voltou aos formulários e aos filtros.`
      : `"${category.name}" saiu dos formulários e dos filtros. As obras que já a usam seguem no ar.`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos salvar a mudança agora. Tente de novo em instantes.'
  }
}

/** Sobe ou desce uma casa na ordem, trocando de posição com a vizinha. */
async function moveCat(c: AdminCategory, direcao: -1 | 1) {
  const lista = adminCategories.value
  const i = lista.findIndex((x) => x.id === c.id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= lista.length) return
  const vizinha = lista[j]
  if (!vizinha) return
  error.value = ''
  try {
    // Troca as posições de verdade — a ordem precisa sobreviver ao F5, e ela
    // vale para a Biblioteca e para o formulário de publicar, não só aqui.
    await Promise.all([
      adminApi.updateCategory(c.id, { position: vizinha.position }),
      adminApi.updateCategory(vizinha.id, { position: c.position }),
    ])
    await loadAdminCategories()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos reordenar agora. Tente de novo em instantes.'
  }
}

async function removeCat(c: AdminCategory) {
  const aviso =
    c.contentCount > 0
      ? `"${c.name}" já guarda ${c.contentCount} obra(s). Ela não será apagada — vai ser recolhida: sai dos formulários e dos filtros, e quem comprou continua baixando. Seguir?`
      : `Apagar a categoria "${c.name}"? Ela está vazia, então some de vez.`
  if (!confirm(aviso)) return
  error.value = ''
  try {
    const { deleted, message } = await adminApi.deleteCategory(c.id)
    catMessage.value = message
    if (deleted) adminCategories.value = adminCategories.value.filter((x) => x.id !== c.id)
    else await loadAdminCategories()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos remover a categoria agora. Tente de novo em instantes.'
  }
}

watch(tab, (t) => {
  error.value = ''
  if (t === 'moderacao') loadContents()
  else if (t === 'usuarios') loadUsers()
  else if (t === 'dashboard') {
    loadDashboard()
    loadPurchases()
  }
  else if (t === 'categorias') loadAdminCategories()
  else if (t === 'temas') loadMusicals()
  // Explícito pelo mesmo motivo da seção: `else` solto faria uma aba nova
  // carregar os dados errados em silêncio.
  else if (t === 'subcategorias') loadSubcategories()
})

watch(modStatus, loadContents)
watch(period, loadDashboard)

onMounted(() => {
  loadCategories()
  loadDashboard()
  loadPurchases()
})
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Painel Admin</h1>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'dashboard' }" @click="tab = 'dashboard'">Dashboard</button>
      <button class="tab" :class="{ active: tab === 'moderacao' }" @click="tab = 'moderacao'">Moderação</button>
      <button class="tab" :class="{ active: tab === 'usuarios' }" @click="tab = 'usuarios'">Usuários</button>
      <!-- Escondida no beta (ver src/flags.ts): nenhuma subcategoria foi
           cadastrada, então a aba só ocupava espaço. As rotas seguem no ar. -->
      <button
        v-if="SUBCATEGORIES_ENABLED"
        class="tab"
        :class="{ active: tab === 'subcategorias' }"
        @click="tab = 'subcategorias'"
      >
        Subcategorias
      </button>
      <button class="tab" :class="{ active: tab === 'categorias' }" @click="tab = 'categorias'">Categorias</button>
      <button class="tab" :class="{ active: tab === 'temas' }" @click="tab = 'temas'">Temas</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <!-- ================= Moderação ================= -->
    <!-- ================= Dashboard ================= -->
    <section v-if="tab === 'dashboard'">
      <div class="filter-row">
        <BlockSelect
          v-model="period"
          :options="PERIOD_OPTIONS"
          aria-label="Período do painel"
        />
      </div>

      <p v-if="loadingDash" class="muted">Carregando…</p>

      <template v-else-if="dash">
        <!-- Faixa de números. A comissão vem destacada: é a única linha aqui
             que representa dinheiro que FICA com a plataforma. -->
        <div class="kpis">
          <div class="kpi">
            <span class="kpi-label">Vendas</span>
            <strong class="kpi-value">{{ dash.resumo.salesCount }}</strong>
            <span class="kpi-foot">ticket médio {{ formatPrice(dash.resumo.avgTicketCents) }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-label">Bruto transacionado</span>
            <strong class="kpi-value">{{ formatPrice(dash.resumo.grossCents) }}</strong>
            <span class="kpi-foot">o que os compradores pagaram</span>
          </div>
          <div class="kpi highlight">
            <span class="kpi-label">Comissão da Cantata</span>
            <strong class="kpi-value">{{ formatPrice(dash.resumo.commissionCents) }}</strong>
            <!-- "Receita", não "lucro": não desconta os custos da operação. -->
            <span class="kpi-foot">receita — antes dos custos</span>
          </div>
          <div class="kpi">
            <span class="kpi-label">Taxa do Stripe</span>
            <strong class="kpi-value">{{ formatPrice(dash.resumo.gatewayCents) }}</strong>
            <span class="kpi-foot">sai do repasse do artista</span>
          </div>
          <div class="kpi">
            <span class="kpi-label">Repasse aos artistas</span>
            <strong class="kpi-value">{{ formatPrice(dash.resumo.artistNetCents) }}</strong>
            <span class="kpi-foot">o que eles receberam</span>
          </div>
        </div>

        <!-- Vendas antigas não têm o detalhe de taxa gravado (as colunas
             entraram depois). Avisar é melhor que exibir um total que não
             fecha e não se explica. -->
        <p v-if="dash.resumo.semDetalheCount" class="adm-note">
          {{ dash.resumo.semDetalheCount }} venda(s) deste período são anteriores ao registro
          detalhado de taxas. Elas entram no bruto, mas não na divisão abaixo.
        </p>

        <!-- Como uma venda se divide -->
        <div v-if="dash.resumo.grossCents > 0" class="split">
          <h2 class="block-title">Para onde vai cada real</h2>
          <div class="split-bar">
            <span
              class="split-part comissao"
              :style="{ width: `${fatia(dash.resumo.commissionCents)}%` }"
              :title="`Comissão: ${formatPrice(dash.resumo.commissionCents)}`"
            />
            <span
              class="split-part gateway"
              :style="{ width: `${fatia(dash.resumo.gatewayCents)}%` }"
              :title="`Stripe: ${formatPrice(dash.resumo.gatewayCents)}`"
            />
            <span
              class="split-part artista"
              :style="{ width: `${fatia(dash.resumo.artistNetCents)}%` }"
              :title="`Artista: ${formatPrice(dash.resumo.artistNetCents)}`"
            />
          </div>
          <div class="split-legend">
            <span><i class="dot comissao" />Cantata {{ fatia(dash.resumo.commissionCents).toFixed(1) }}%</span>
            <span><i class="dot gateway" />Stripe {{ fatia(dash.resumo.gatewayCents).toFixed(1) }}%</span>
            <span><i class="dot artista" />Artista {{ fatia(dash.resumo.artistNetCents).toFixed(1) }}%</span>
          </div>
        </div>

        <!-- Evolução -->
        <div v-if="barras.length" class="chart-block">
          <h2 class="block-title">
            Evolução — {{ dash.bucket === 'dia' ? 'por dia' : 'por mês' }}
          </h2>
          <div class="chart">
            <div
              v-for="b in barras"
              :key="b.chave"
              class="bar-slot"
              :title="`${b.rotulo}: ${b.salesCount} venda(s), ${formatPrice(b.grossCents)}`"
            >
              <span class="bar" :class="{ zero: b.grossCents === 0 }" :style="{ height: `${b.altura}%` }" />
            </div>
          </div>
          <div class="chart-axis">
            <span>{{ barras[0]?.rotulo }}</span>
            <span>{{ barras[barras.length - 1]?.rotulo }}</span>
          </div>
        </div>

        <!-- Precisa de atenção. Some inteiro quando não há nada a dizer:
             bloco vazio permanente ensina o olho a ignorar a área. -->
        <div v-if="alertas.length" class="alerts">
          <h2 class="block-title">Precisa de atenção</h2>
          <ul class="alert-list">
            <li v-for="a in alertas" :key="a.key">
              <strong>{{ a.count }}</strong> compra(s) {{ a.label }}
              <span class="muted">— {{ formatPrice(a.cents) }}</span>
            </li>
          </ul>
        </div>

        <div class="two-cols">
          <!-- Ordenado por faturamento. A comissão aparece ao lado porque as
               duas ordens divergem: o piso de R$ 2,00 faz uma obra barata
               render proporcionalmente muito mais. -->
          <div>
            <h2 class="block-title">Artistas que mais venderam</h2>
            <p v-if="!dash.topArtists.length" class="muted">Nenhuma venda no período.</p>
            <div v-else class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Artista</th><th class="num">Vendas</th><th class="num">Bruto</th><th class="num">Comissão</th></tr>
                </thead>
                <tbody>
                  <tr v-for="a in dash.topArtists" :key="a.id">
                    <td>{{ a.name || '—' }}</td>
                    <td class="num">{{ a.salesCount }}</td>
                    <td class="num">{{ formatPrice(a.grossCents) }}</td>
                    <td class="num">{{ formatPrice(a.commissionCents) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 class="block-title">Obras que mais venderam</h2>
            <p v-if="!dash.topContents.length" class="muted">Nenhuma venda no período.</p>
            <div v-else class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Obra</th><th>Artista</th><th class="num">Vendas</th><th class="num">Bruto</th></tr>
                </thead>
                <tbody>
                  <tr v-for="o in dash.topContents" :key="o.id">
                    <td>{{ o.title }}</td>
                    <td>{{ o.artistName || '—' }}</td>
                    <td class="num">{{ o.salesCount }}</td>
                    <td class="num">{{ formatPrice(o.grossCents) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>

      <!-- A lista crua continua, no rodapé: o suporte precisa localizar UMA
           venda quando alguém escreve reclamando. Ela ignora o período de
           cima de propósito — quem procura uma compra específica não sabe de
           que mês ela é. -->
      <h2 class="block-title">Últimas compras</h2>
      <p v-if="loadingPurchases" class="muted">Carregando…</p>
      <p v-else-if="!purchases.length" class="muted">Nenhuma compra registrada ainda.</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Data</th><th>Conteúdo</th><th>Comprador</th><th>Artista</th><th class="num">Valor</th><th class="num">Comissão</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in purchases" :key="p.id">
              <td>{{ new Date(p.createdAt).toLocaleDateString('pt-BR') }}</td>
              <td>{{ p.content.title }}</td>
              <td>{{ p.buyer.name || p.buyer.email }}</td>
              <td>{{ p.artist.name || '—' }}</td>
              <td class="num">{{ formatPrice(p.amountCents) }}</td>
              <td class="num">{{ formatPrice(p.platformFeeCents) }}</td>
              <td><span class="pill" :class="p.status">{{ p.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="tab === 'moderacao'">
      <div class="filter-row">
        <label id="rot-status">Status:</label>
        <BlockSelect
          v-model="modStatus"
          :options="STATUS_OPTIONS"
          aria-label="Filtrar a fila por status"
        />
      </div>

      <p v-if="loadingContents" class="muted">Carregando…</p>
      <p v-else-if="!contents.length" class="muted">Nada esperando revisão.</p>

      <!-- Grade de cards, na mesma gramática da Biblioteca (capa 4/3, ícones
           de categoria, título, artista, preço) — o admin reconhece a obra
           pelo mesmo desenho que o visitante vê. O que muda é o que vem
           DEPOIS: arquivos para conferir e as ações de moderação.
           NÃO é um link: obra em revisão não existe em /conteudo/:id. -->
      <ul v-else class="mod-grid">
        <li v-for="c in contents" :key="c.id" class="mod-card">
          <div class="cover">
            <img v-if="c.coverPath" :src="fileUrl(c.coverPath) ?? undefined" :alt="c.title" />
            <span v-else class="cover-placeholder">🎵</span>
            <span v-if="c.musical" class="tema-badge">{{ c.musical.name }}</span>
            <span v-if="c.adminBlocked" class="status-badge blocked">Fora do ar</span>
            <span v-else-if="c.status === 'aprovado'" class="status-badge ok">Publicada</span>
            <span v-else-if="c.status === 'reprovado'" class="status-badge no">Devolvida</span>
          </div>

          <div class="body">
            <h3 class="title">{{ c.title }}</h3>
            <p class="artist">{{ c.artist.name || c.artist.email }}</p>
            <p class="price">{{ formatPrice(c.priceCents) }}</p>

            <p v-if="c.description" class="desc">{{ c.description }}</p>

            <!-- Conferência: uma linha por categoria, com a prévia e os
                 arquivos completos para baixar antes de decidir. -->
            <!-- As QUATRO categorias, sempre, com a contagem ao lado — as que
                 a obra não traz aparecem apagadas, com zero. Antes só as
                 presentes apareciam, e o bloco mudava de altura a cada obra:
                 uma com três categorias ficava bem mais alta que a vizinha
                 com uma, e a grade desalinhava. -->
            <div class="check">
              <div v-for="cat in checkCategories(c)" :key="cat.slug" class="check-cat">
                <!-- Tudo numa linha só: categoria, contagem, prévia e um
                     "baixar" por arquivo com o tamanho ao lado. O NOME do
                     arquivo saiu da tela — ele é gerado no upload e não diz
                     nada ao admin; fica no `title`, para quem precisar. -->
                <p class="check-head" :class="{ empty: fileCount(c, cat.slug) === 0 }">
                  <CategoryIcon class="check-icon" :style="catHue(cat)" :icon="cat.icon" :size="15" />
                  <span class="check-name">{{ cat.name }}</span>
                  <span class="check-count">
                    {{ fileCount(c, cat.slug) }} arquivo{{ fileCount(c, cat.slug) === 1 ? '' : 's' }}
                  </span>
                  <a
                    v-if="fileUrl(itemOf(c, cat.slug)?.previewPath)"
                    :href="fileUrl(itemOf(c, cat.slug)!.previewPath)!"
                    target="_blank"
                    rel="noopener"
                    class="link"
                  >ver prévia</a>
                  <button
                    v-for="file in itemOf(c, cat.slug)?.files ?? []"
                    :key="file.id"
                    class="link inline-btn dl"
                    :title="file.fileName ?? undefined"
                    :disabled="downloadingFile === file.id"
                    @click="downloadFull(c, file)"
                  >
                    {{ downloadingFile === file.id ? 'baixando…' : 'baixar' }}
                    <span class="dl-size">
                      {{ file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(1) : '?' }} MB
                    </span>
                  </button>
                </p>
              </div>
            </div>

            <p v-if="c.rejectionReason" class="note reject-reason">
              Devolvida antes: {{ c.rejectionReason }}
            </p>
            <p v-if="c.adminBlocked && c.adminBlockedReason" class="note blocked-note">
              Fora do ar: {{ c.adminBlockedReason }}
            </p>
          </div>

          <!-- Ações no rodapé do card, separadas por linha: é a parte que o
               admin procura, e ela não pode se confundir com o conteúdo. -->
          <div class="card-actions">
            <template v-if="c.status === 'em_revisao'">
              <button class="ok-btn" @click="approve(c)">Publicar</button>
              <button class="no-btn" @click="rejectingId = rejectingId === c.id ? null : c.id">
                Devolver
              </button>
            </template>
            <template v-else-if="c.status === 'aprovado'">
              <button v-if="c.adminBlocked" class="ok-btn" @click="unblock(c)">Devolver ao ar</button>
              <button v-else class="no-btn" @click="blockingId = blockingId === c.id ? null : c.id">
                Tirar do ar
              </button>
            </template>
            <span v-else class="muted small">Aguardando o artista reenviar.</span>
          </div>

          <div v-if="rejectingId === c.id" class="reason-box">
            <textarea
              v-model="rejectReason"
              rows="3"
              placeholder="O que precisa mudar? O artista vê este texto."
            />
            <button class="no-btn" @click="reject(c)">Confirmar devolução</button>
          </div>

          <div v-if="blockingId === c.id" class="reason-box">
            <textarea
              v-model="blockReason"
              rows="3"
              placeholder="Por que a obra sai do ar? Fica registrado e o artista vê."
            />
            <p class="block-warning">
              A obra sai da biblioteca e do link direto, e não pode mais ser adquirida.
              Quem já comprou continua com ela.
            </p>
            <button class="no-btn" @click="block(c)">Confirmar</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- ================= Usuários ================= -->
    <section v-else-if="tab === 'usuarios'">
      <div class="filter-row">
        <input v-model.lazy="userQuery" type="search" placeholder="Buscar por nome ou e-mail…" @change="loadUsers" />
        <span class="muted">{{ usersTotal }} usuário(s)</span>
      </div>

      <p v-if="loadingUsers" class="muted">Carregando…</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Papéis</th><th>Stripe</th>
              <th class="num">Obras</th><th class="num">Vendas</th><th class="num">Compras</th>
              <th>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.name || '—' }}</td>
              <td>{{ u.email }}</td>
              <td>
                <span v-if="u.isAdmin" class="pill">admin</span>
                <span v-if="u.isArtist" class="pill">artista</span>
                <span v-if="!u.isAdmin && !u.isArtist" class="muted">usuário</span>
              </td>
              <td>{{ u.isArtist ? (u.stripeOnboardingComplete ? '✅' : '⏳') : '—' }}</td>
              <!-- Traço nas duas colunas de artista para quem não é artista:
                   zero ali sugeriria "publicou/vendeu nada", quando o certo é
                   "não publica". Compras não levam traço — todo mundo compra. -->
              <td class="num">{{ u.isArtist ? u.postedCount : '—' }}</td>
              <td class="num">{{ u.isArtist ? u.salesCount : '—' }}</td>
              <td class="num">{{ u.boughtCount }}</td>
              <td>{{ new Date(u.createdAt).toLocaleDateString('pt-BR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ================= Categorias ================= -->
    <section v-else-if="tab === 'categorias'">
      <p class="muted intro-note">
        Categorias são as partes de uma obra — o artista monta o pacote escolhendo uma ou mais.
        O nome, o ícone e a cor mudam aqui e valem em toda a plataforma na hora. O endereço da
        categoria não muda junto: links já compartilhados continuam abrindo.
      </p>

      <div class="filter-row">
        <button class="ok-btn" @click="startCreate">Nova categoria</button>
        <span class="muted">{{ adminCategories.length }} categoria(s)</span>
      </div>

      <p v-if="catMessage" class="adm-note">{{ catMessage }}</p>

      <!-- Formulário de criar/editar. Aparece no lugar da lista para o admin
           não perder de vista o que está mexendo. -->
      <div v-if="creatingCat || editingCat" class="adm-form">
        <h2 class="adm-form-title">
          {{ creatingCat ? 'Nova categoria' : `Editando ${editingCat?.name}` }}
        </h2>

        <label class="adm-field">
          <span class="adm-label">Nome</span>
          <input v-model="catDraft.name" type="text" maxlength="120" placeholder="Ex.: Playbacks" />
        </label>

        <div class="adm-field">
          <span class="adm-label">O que ela recebe</span>
          <BlockSelect
            v-model="catDraft.kind"
            :options="KIND_OPTIONS"
            aria-label="Natureza dos arquivos"
            :highlight-when-set="false"
          />
          <!-- A natureza trava assim que entra a primeira obra: trocar
               'documento' por 'áudio' deixaria PDFs numa categoria que só
               aceita .mp3, e a página da obra mostraria um player mudo. -->
          <p v-if="editingCat && editingCat.contentCount > 0" class="adm-hint">
            Travado: {{ editingCat.contentCount }} obra(s) já usam esta categoria.
          </p>
        </div>

        <div class="adm-field">
          <span class="adm-label">Ícone</span>
          <div class="icon-grid">
            <button
              v-for="ic in CATEGORY_ICONS"
              :key="ic"
              type="button"
              class="icon-pick"
              :class="{ active: catDraft.icon === ic }"
              :style="catHue(catDraft)"
              :title="ic"
              @click="catDraft.icon = ic"
            >
              <CategoryIcon :icon="ic" :size="22" />
            </button>
          </div>
        </div>

        <div class="adm-field">
          <span class="adm-label">Cor</span>
          <div class="hue-grid">
            <button
              v-for="h in HUE_OPTIONS"
              :key="h"
              type="button"
              class="hue-pick"
              :class="{ active: catDraft.hue === h }"
              :style="{ '--cat-hue': String(h) }"
              :aria-label="`Matiz ${h}`"
              @click="catDraft.hue = h"
            />
          </div>
        </div>

        <div class="adm-actions">
          <button class="ok-btn" :disabled="savingCat" @click="saveCat">
            {{ savingCat ? 'Salvando…' : 'Salvar' }}
          </button>
          <button class="no-btn" @click="cancelCatEdit">Cancelar</button>
        </div>
      </div>

      <p v-if="loadingCats" class="muted">Carregando…</p>
      <ul v-else class="adm-list">
        <li v-for="(c, i) in adminCategories" :key="c.id" class="adm-row" :class="{ off: !c.active }">
          <span class="adm-mark" :style="catHue(c)">
            <CategoryIcon :icon="c.icon" :size="20" />
          </span>

          <span class="adm-info">
            <span class="adm-name">{{ c.name }}</span>
            <span class="adm-meta">
              {{ KIND_LABEL[c.kind] }} ·
              {{ c.contentCount }} obra{{ c.contentCount === 1 ? '' : 's' }}
              <template v-if="!c.active"> · recolhida</template>
            </span>
          </span>

          <span class="adm-buttons">
            <button class="link inline-btn" :disabled="i === 0" @click="moveCat(c, -1)">subir</button>
            <button class="link inline-btn" :disabled="i === adminCategories.length - 1" @click="moveCat(c, 1)">
              descer
            </button>
            <button class="link inline-btn" @click="startEdit(c)">editar</button>
            <button class="link inline-btn" @click="toggleCatActive(c)">
              {{ c.active ? 'recolher' : 'trazer de volta' }}
            </button>
            <button class="link inline-btn danger" @click="removeCat(c)">excluir</button>
          </span>
        </li>
      </ul>
    </section>

    <!-- ================= Temas ================= -->
    <section v-else-if="tab === 'temas'">
      <p class="muted intro-note">
        Temas são datas especiais do ano (Natal, Dia das Mães…). Ao publicar, o artista pode
        marcar a obra com um tema — é opcional. Recolher tira o tema dos formulários e dos
        filtros; as obras já marcadas não mudam.
      </p>

      <div class="filter-row">
        <button class="ok-btn" @click="startCreateMusical">Novo tema</button>
        <span class="muted">{{ musicals.length }} tema(s)</span>
      </div>

      <p v-if="musicalMessage" class="adm-note">{{ musicalMessage }}</p>

      <div v-if="creatingMusical || editingMusical" class="adm-form">
        <h2 class="adm-form-title">
          {{ creatingMusical ? 'Novo tema' : `Editando ${editingMusical?.name}` }}
        </h2>

        <label class="adm-field">
          <span class="adm-label">Nome</span>
          <input
            v-model="musicalDraft"
            type="text"
            maxlength="120"
            placeholder="Ex.: Natal"
            @keyup.enter="saveMusical"
          />
        </label>

        <div class="adm-actions">
          <button class="ok-btn" :disabled="savingMusical" @click="saveMusical">
            {{ savingMusical ? 'Salvando…' : 'Salvar' }}
          </button>
          <button class="no-btn" @click="cancelMusicalEdit">Cancelar</button>
        </div>
      </div>

      <p v-if="loadingMusicals" class="muted">Carregando…</p>
      <ul v-else class="adm-list">
        <li v-for="m in musicals" :key="m.id" class="adm-row" :class="{ off: !m.active }">
          <!-- Marca neutra: tema não tem cor própria, e pintar uma daria
               significado a uma escolha que ninguém fez. -->
          <span class="adm-mark plain">
            <CategoryIcon icon="calendario" :size="20" />
          </span>

          <span class="adm-info">
            <span class="adm-name">{{ m.name }}</span>
            <span class="adm-meta">
              {{ m.contentCount }} obra{{ m.contentCount === 1 ? '' : 's' }}
              <template v-if="!m.active"> · recolhido</template>
            </span>
          </span>

          <span class="adm-buttons">
            <button class="link inline-btn" @click="startEditMusical(m)">editar</button>
            <button class="link inline-btn" @click="toggleMusicalActive(m)">
              {{ m.active ? 'recolher' : 'trazer de volta' }}
            </button>
            <button class="link inline-btn danger" @click="removeMusical(m)">excluir</button>
          </span>
        </li>
      </ul>
    </section>

    <!-- ================= Subcategorias =================
         Condição EXPLÍCITA (2026-08-05): isto era um `v-else` solto, o caso
         padrão do encadeamento — qualquer aba nova cairia aqui por acidente,
         mostrando o formulário errado. Hoje a aba está escondida (flags.ts),
         então esta seção não é alcançável; a condição a mantém correta se ela
         voltar. -->
    <section v-else-if="tab === 'subcategorias'">
      <div class="filter-row">
        <select v-model="newSubType">
          <option value="instrumento">Instrumento</option>
          <option value="genero">Gênero</option>
          <option value="dificuldade">Dificuldade</option>
        </select>
        <input v-model="newSubName" type="text" placeholder="Nome da subcategoria" @keyup.enter="createSub" />
        <button class="ok-btn" @click="createSub">Adicionar</button>
      </div>

      <ul class="sub-list">
        <li v-for="sub in subcategories" :key="sub.id">
          <span class="pill">{{ sub.type }}</span> {{ sub.name }}
          <button class="no-btn small-btn" @click="deactivateSub(sub)">desativar</button>
        </li>
      </ul>
    </section>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
  margin-bottom: 1.25rem;
}

// Abas como grupo blocado colado (guia §3): sem pílulas, sem gap interno.
.tabs {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.tab {
  @include block-chip;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;

  label {
    @include label-type;
    font-size: 0.7rem;
    color: $text-dim;
  }

  select,
  input {
    @include block-input;
    padding: 0.5rem 0.8rem;
  }

  input {
    min-width: 240px;
  }

  option {
    color: #111;
  }
}

// ---- Grade da moderação ------------------------------------------------
// Mesma gramática visual do card da Biblioteca (ContentCard): moldura de 1px,
// fundo opaco, capa 4/3, ícones de categoria, título/artista/preço. O admin
// reconhece a obra pelo mesmo desenho que o visitante vê.
//
// Não é o mesmo COMPONENTE de propósito: o card da Biblioteca é um link para
// /conteudo/:id, e obra em revisão não existe naquela rota — daria 404. Além
// disso, o card do admin carrega o que a vitrine não tem: arquivos para
// conferir e as ações de moderação.
// Duas colunas fixas: o card carrega uma linha densa por categoria
// (ícone, nome, contagem, prévia e os "baixar"), e com três ou mais colunas
// ela quebraria em duas alturas. Abaixo de 900px vira coluna única.
.mod-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.mod-card {
  display: flex;
  flex-direction: column;
  border: 1px solid $line;
  overflow: hidden;
  background: $color-back;
  box-shadow: 0 14px 32px -18px rgba(0, 0, 0, 0.45);

  [data-theme='dark'] & {
    box-shadow:
      0 14px 32px -18px rgba(0, 0, 0, 0.8),
      0 10px 28px -16px rgba($color-primary, 0.06);
  }
}

.cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: rgba(var(--fg-rgb), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.cover-placeholder {
  font-size: 2.5rem;
  opacity: 0.4;
}

// Selos sobre a capa: mesmo formato do card da vitrine. O tema à esquerda,
// o estado à direita — assim os dois nunca disputam o mesmo canto.
.tema-badge,
.status-badge {
  @include label-type;
  position: absolute;
  top: 0.6rem;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
}

.tema-badge {
  left: 0.6rem;
  background: color-mix(in srgb, $color-primary 22%, rgb(var(--bg-rgb)));
  color: $gold-text;
}

.status-badge {
  right: 0.6rem;

  &.ok {
    background: color-mix(in srgb, $color-success 24%, rgb(var(--bg-rgb)));
    color: $color-success;
  }

  &.no,
  &.blocked {
    background: color-mix(in srgb, $color-error 24%, rgb(var(--bg-rgb)));
    color: $color-error;
  }
}

.body {
  padding: 0.9rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.title {
  font-family: $font-display;
  font-size: 1.05rem;
  font-weight: 600;
}

.artist {
  font-size: 0.85rem;
  color: $text-secondary;
}

.price {
  margin-top: 0.35rem;
  font-weight: 600;
}

.desc {
  margin-top: 0.6rem;
  font-size: 0.86rem;
  line-height: 1.55;
  color: rgba(var(--fg-rgb), 0.7);
}

// Bloco de conferência: separado do resto por uma linha, porque é ferramenta
// de trabalho e não descrição da obra.
.check {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px solid $line;
  font-size: 0.8rem;
}

.check-cat + .check-cat {
  margin-top: 0.55rem;
}

// Cabeçalho da categoria: ícone na tinta dela, nome, contagem e a prévia.
// `align-items: center` (e não baseline) porque o ícone entrou na linha.
.check-head {
  @include label-type;
  font-size: 0.68rem;
  color: $text-secondary;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 0.7rem;

  // Categoria que a obra NÃO traz: continua na lista, apagada. É ela que
  // mantém as quatro linhas em todo card — e some do caminho do olho.
  &.empty {
    color: rgba(var(--fg-rgb), 0.28);

    .check-icon {
      color: inherit;
    }
  }
}

.check-icon {
  flex-shrink: 0;
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));

}

// O nome empurra a contagem e a prévia para a direita.
.check-name {
  flex: 1;
  min-width: 0;
}

.check-count {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// "baixar 1,2 MB" — o tamanho colado ao verbo, num tom mais apagado: é
// contexto para a decisão de baixar, não a ação em si.
.dl {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  white-space: nowrap;
}

.dl-size {
  // Sem sublinhado: o `.inline-btn` sublinha o botão inteiro, e o tamanho não
  // é parte do link — é a informação ao lado dele. Sublinhar os dois faria
  // "baixar 1,2 MB" parecer um alvo de clique só, mais largo do que precisa.
  text-decoration: none;
  color: rgba(var(--fg-rgb), 0.45);
  font-variant-numeric: tabular-nums;
}

// Avisos dentro do card (motivo anterior, motivo do bloqueio): tarja de 3px
// na cor funcional, sem emoji — o texto e a cor já dizem o que é.
.note {
  margin-top: 0.8rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  line-height: 1.5;
  border-left: 3px solid;
}

.reject-reason {
  border-color: $color-error;
  background: rgba($color-error, 0.08);
  color: rgba(var(--fg-rgb), 0.8);
}

.blocked-note {
  border-color: $color-error;
  background: rgba($color-error, 0.12);
  color: $color-error;
}

// Rodapé de ações: linha de cima separa do conteúdo, e o fundo levemente
// distinto marca que ali é onde se decide.
.card-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.85rem 1rem;
  border-top: 1px solid $line;
  background: rgba(var(--fg-rgb), 0.03);
}

.reason-box {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-top: 1px solid $line;

  textarea {
    @include block-input;
    width: 100%;
    resize: vertical;
    font-size: 0.86rem;
  }

  .no-btn {
    align-self: flex-start;
  }
}

.block-warning {
  font-size: 0.8rem;
  line-height: 1.5;
  color: $color-error;
}

.ok-btn {
  @include label-type;
  font-weight: 600;
  padding: 0.55rem 1.3rem;
  border: 1px solid rgba($color-success, 0.5);
  background: rgba($color-success, 0.12);
  color: $color-success;
  cursor: pointer;
  transition: background-color 0.5s $ease-brand, color 0.5s $ease-brand;

  &:hover {
    background: rgba($color-success, 0.22);
  }
}

.no-btn {
  @include label-type;
  font-weight: 600;
  padding: 0.55rem 1.3rem;
  border: 1px solid rgba($color-error, 0.5);
  background: none;
  color: $color-error;
  cursor: pointer;
  transition: background-color 0.5s $ease-brand, color 0.5s $ease-brand;

  &:hover {
    background: rgba($color-error, 0.12);
  }
}

.small-btn {
  padding: 0.2rem 0.7rem;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.reject-reason {
  margin-top: 0.5rem;
  color: $color-error;
  font-size: 0.85rem;
}

// Takedown: mesmo tom de erro do motivo de reprovação, com fundo para
// destacar que a obra está FORA DO AR agora (não é histórico).
.blocked-note {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba($color-error, 0.4);
  background: rgba($color-error, 0.1);
  color: $color-error;
  font-size: 0.85rem;
}

.block-warning {
  margin: 0.5rem 0;
  color: rgba(var(--fg-rgb), 0.7);
  font-size: 0.8rem;
  line-height: 1.5;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th,
  td {
    text-align: left;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);
  }

  // Headers de tabela: rótulo uppercase espaçado (guia §5/§6).
  th {
    color: rgba(var(--fg-rgb), 0.5);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.68rem;
    letter-spacing: 0.16em;
  }

  // Coluna numérica: à direita e com dígitos de largura fixa, para a lista
  // poder ser lida na vertical sem os números dançando.
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}

// Badge blocado: quadrado, rótulo uppercase (guia §3/§5).
// "Pendente" usa o dourado da paleta (o amarelo antigo estava fora dela).
.pill {
  display: inline-block;
  @include label-type;
  font-size: 0.65rem;
  padding: 0.2rem 0.6rem;
  background: rgba($color-primary, 0.18);
  color: $gold-text;
  margin-right: 0.3rem;

  &.pago {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
  &.pendente {
    background: rgba($color-primary, 0.18);
    color: $gold-text;
  }
  &.reembolsado {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
}

.sub-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

// Nota explicativa no topo da aba Musicais.
.intro-note {
  max-width: 640px;
  margin-bottom: 1rem;
  font-size: 0.88rem;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.small {
  font-size: 0.82rem;
}

.link {
  color: $gold-text;
}

.inline-btn {
  background: none;
  border: none;
  padding: 0;
  // `font-family` TAMBÉM precisa ser herdada: o navegador força a fonte do
  // sistema em controles de formulário, e ela não vem por herança como nos
  // demais elementos. Sem esta linha, "baixar" saía em Arial ao lado de "ver
  // prévia" — mesmo tamanho em rem, aparência visivelmente diferente, porque
  // são tipos com alturas de x distintas.
  font: inherit;
  cursor: pointer;
  text-decoration: underline;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

// ---- Lista administrável (abas Categorias e Temas) ---------------------------
// Uma linha por item: marca à esquerda, nome + resumo no meio, ações à direita.
// Recolhido fica esmaecido em vez de sumir — é justamente o item que o admin
// abriu a aba para trazer de volta.
//
// Nasceu na aba Categorias e virou o padrão das duas (2026-08-06), daí o
// prefixo `adm-` em vez de `cat-`. `icon-grid`/`hue-grid` continuam sendo só de
// categoria: tema não tem ícone nem cor.
.adm-note {
  margin-bottom: 1rem;
  padding: 0.7rem 0.9rem;
  border-left: 2px solid $gold-text;
  background: rgba(var(--fg-rgb), 0.04);
  font-size: 0.88rem;
}

.adm-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  max-width: 520px;
  margin-bottom: 1.6rem;
  padding: 1.2rem;
  border: 1px solid $line;
}

.adm-form-title {
  @include label-type;
  font-size: 0.72rem;
  color: rgba(var(--fg-rgb), 0.6);
}

.adm-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.adm-label {
  @include label-type;
  font-size: 0.65rem;
  color: rgba(var(--fg-rgb), 0.5);
}

.adm-hint {
  font-size: 0.78rem;
  color: rgba(var(--fg-rgb), 0.5);
}

// Grade de ícones: a escolha se pinta com a matiz escolhida ao lado, para o
// admin ver o par ícone+cor como ele vai aparecer, e não como duas decisões
// separadas.
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 0.4rem;
}

.icon-pick {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 1px solid $line;
  background: none;
  color: rgba(var(--fg-rgb), 0.55);
  cursor: pointer;
  transition:
    color 0.4s $ease-brand,
    border-color 0.4s $ease-brand;

  &:hover {
    color: rgba(var(--fg-rgb), 0.9);
  }

  &.active {
    color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));
    border-color: hsla(var(--cat-hue, 45), 45%, 50%, 0.6);
    background: hsla(var(--cat-hue, 45), 45%, 50%, 0.12);
  }
}

.hue-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.hue-pick {
  width: 30px;
  height: 30px;
  border: 1px solid hsla(var(--cat-hue), 45%, 50%, 0.5);
  background: hsla(var(--cat-hue), 45%, 50%, 0.35);
  cursor: pointer;
  transition: transform 0.3s $ease-brand;

  &.active {
    outline: 1px solid hsl(var(--cat-hue), 45%, var(--cat-tag-l, 64%));
    outline-offset: 2px;
  }

  &:hover {
    transform: scale(1.08);
  }
}

.adm-actions {
  display: flex;
  gap: 0.6rem;
}

.adm-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.adm-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);

  // Recolhida continua na lista, apagada: sumir dela esconderia justamente a
  // categoria que o admin abriu a aba para reativar.
  &.off {
    opacity: 0.5;
  }
}

.adm-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 1px solid hsla(var(--cat-hue, 45), 45%, 50%, 0.4);
  background: hsla(var(--cat-hue, 45), 45%, 50%, 0.13);
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));
}

// Tema não tem matiz: a marca fica na tinta neutra do painel.
.adm-mark.plain {
  border-color: rgba(var(--fg-rgb), 0.18);
  background: rgba(var(--fg-rgb), 0.05);
  color: rgba(var(--fg-rgb), 0.6);
}

.adm-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.adm-name {
  font-weight: 600;
}

.adm-meta {
  font-size: 0.75rem;
  color: rgba(var(--fg-rgb), 0.5);
}

.adm-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  font-size: 0.78rem;

  .danger {
    color: $color-error;
  }
}

// ---- Dashboard ---------------------------------------------------------------
.block-title {
  @include label-type;
  font-size: 0.68rem;
  color: rgba(var(--fg-rgb), 0.5);
  margin: 2rem 0 0.8rem;
}

// Cartões de número: blocados, sem radius, como o resto do painel.
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1px;
  background: rgba(var(--fg-rgb), 0.1);
  border: 1px solid rgba(var(--fg-rgb), 0.1);
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 1.1rem 1.2rem;
  background: $color-back;

  // A comissão é a única linha que representa dinheiro que FICA — merece
  // destaque; as outras são volume ou dinheiro de passagem.
  &.highlight {
    background: rgba($color-primary, 0.07);

    .kpi-value {
      color: $gold-text;
    }
  }
}

.kpi-label {
  @include label-type;
  font-size: 0.6rem;
  color: rgba(var(--fg-rgb), 0.5);
}

.kpi-value {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.kpi-foot {
  font-size: 0.72rem;
  color: rgba(var(--fg-rgb), 0.45);
}

// Barra de decomposição da venda. As três cores dizem quem fica com o quê,
// então nenhuma delas é decorativa.
.split-bar {
  display: flex;
  height: 26px;
  border: 1px solid rgba(var(--fg-rgb), 0.12);
}

.split-part {
  display: block;
  height: 100%;

  &.comissao {
    background: rgba($color-primary, 0.75);
  }
  &.gateway {
    background: rgba(var(--fg-rgb), 0.28);
  }
  &.artista {
    background: rgba(var(--fg-rgb), 0.1);
  }
}

.split-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  margin-top: 0.6rem;
  font-size: 0.78rem;
  color: rgba(var(--fg-rgb), 0.6);

  span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
}

.dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;

  &.comissao {
    background: rgba($color-primary, 0.75);
  }
  &.gateway {
    background: rgba(var(--fg-rgb), 0.28);
  }
  &.artista {
    background: rgba(var(--fg-rgb), 0.1);
    border: 1px solid rgba(var(--fg-rgb), 0.2);
  }
}

// Gráfico: barras a partir da base, sem biblioteca. Dia sem venda continua
// ocupando sua fatia — é o vazio que mostra o ritmo real.
.chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 140px;
  padding-top: 0.4rem;
  border-bottom: 1px solid rgba(var(--fg-rgb), 0.15);
}

.bar-slot {
  display: flex;
  flex: 1;
  align-items: flex-end;
  height: 100%;
  min-width: 3px;
}

.bar {
  display: block;
  width: 100%;
  min-height: 2px;
  background: rgba($color-primary, 0.7);
  transition: background-color 0.4s $ease-brand;

  // Sem venda: um traço fantasma na base, para a coluna existir sem fingir
  // que houve movimento.
  &.zero {
    background: rgba(var(--fg-rgb), 0.08);
  }
}

.bar-slot:hover .bar {
  background: $gold-text;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
  font-size: 0.7rem;
  color: rgba(var(--fg-rgb), 0.45);
}

.alert-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.9rem 1.1rem;
  border-left: 2px solid $gold-text;
  background: rgba(var(--fg-rgb), 0.04);
  font-size: 0.88rem;
}

.two-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 0 2rem;
}

.error {
  color: $color-error;
  margin-bottom: 1rem;
}
</style>
