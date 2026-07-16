<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import {
  adminApi,
  catalogApi,
  purchasesApi,
  fileUrl,
  formatPrice,
  type AdminContent,
  type AdminPurchase,
  type AdminUser,
  type ContentStatus,
  type Subcategory,
  type SubcategoryType,
} from '@/services/api'

type Tab = 'moderacao' | 'usuarios' | 'compras' | 'subcategorias'
const tab = ref<Tab>('moderacao')
const error = ref('')

// ---- Moderação ----
const modStatus = ref<ContentStatus>('em_revisao')
const contents = ref<AdminContent[]>([])
const loadingContents = ref(false)
const rejectingId = ref<number | null>(null)
const rejectReason = ref('')

async function loadContents() {
  loadingContents.value = true
  error.value = ''
  try {
    contents.value = (await adminApi.contents(modStatus.value)).contents
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar a fila.'
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
    error.value = err instanceof Error ? err.message : 'Erro ao baixar o arquivo.'
  } finally {
    downloadingFile.value = null
  }
}

async function approve(c: AdminContent) {
  try {
    await adminApi.approve(c.id)
    contents.value = contents.value.filter((x) => x.id !== c.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao aprovar.'
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
    error.value = err instanceof Error ? err.message : 'Erro ao reprovar.'
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
    error.value = err instanceof Error ? err.message : 'Erro ao listar usuários.'
  } finally {
    loadingUsers.value = false
  }
}

// ---- Compras ----
const purchases = ref<AdminPurchase[]>([])
const loadingPurchases = ref(false)

async function loadPurchases() {
  loadingPurchases.value = true
  error.value = ''
  try {
    purchases.value = (await adminApi.purchases()).purchases
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao listar compras.'
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
    error.value = err instanceof Error ? err.message : 'Erro ao listar subcategorias.'
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
    error.value = err instanceof Error ? err.message : 'Erro ao criar subcategoria.'
  }
}

async function deactivateSub(sub: Subcategory) {
  try {
    await adminApi.updateSubcategory(sub.id, { active: false })
    subcategories.value = subcategories.value.filter((s) => s.id !== sub.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao desativar.'
  }
}

watch(tab, (t) => {
  error.value = ''
  if (t === 'moderacao') loadContents()
  else if (t === 'usuarios') loadUsers()
  else if (t === 'compras') loadPurchases()
  else loadSubcategories()
})

watch(modStatus, loadContents)

onMounted(loadContents)
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Painel Admin</h1>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'moderacao' }" @click="tab = 'moderacao'">Moderação</button>
      <button class="tab" :class="{ active: tab === 'usuarios' }" @click="tab = 'usuarios'">Usuários</button>
      <button class="tab" :class="{ active: tab === 'compras' }" @click="tab = 'compras'">Compras</button>
      <button class="tab" :class="{ active: tab === 'subcategorias' }" @click="tab = 'subcategorias'">Subcategorias</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <!-- ================= Moderação ================= -->
    <section v-if="tab === 'moderacao'">
      <div class="filter-row">
        <label>Status:</label>
        <select v-model="modStatus">
          <option value="em_revisao">Em revisão</option>
          <option value="aprovado">Aprovados</option>
          <option value="reprovado">Reprovados</option>
        </select>
      </div>

      <p v-if="loadingContents" class="muted">Carregando…</p>
      <p v-else-if="!contents.length" class="muted">Nada aqui. 🎉</p>

      <ul v-else class="mod-list">
        <li v-for="c in contents" :key="c.id" class="mod-item">
          <div class="mod-head">
            <strong class="mod-title">{{ c.title }}</strong>
            <span class="muted">{{ c.items.map((i) => i.category.name).join(' · ') }} ·
              {{ formatPrice(c.priceCents) }} · {{ c.artist.name || c.artist.email }}</span>
          </div>
          <p v-if="c.description" class="mod-desc">{{ c.description }}</p>
          <!-- Um bloco de avaliação por item do pacote; download por arquivo -->
          <div v-for="item in c.items" :key="item.id" class="muted small">
            <p>
              {{ item.category.name }} ({{ item.files.length }} arquivo{{ item.files.length === 1 ? '' : 's' }})
              · <a v-if="fileUrl(item.previewPath)" :href="fileUrl(item.previewPath)!" target="_blank" class="link">ver prévia</a>
            </p>
            <p v-for="file in item.files" :key="file.id" class="file-row">
              — {{ file.fileName }}
              ({{ file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(1) : '?' }} MB)
              · <button class="link inline-btn" :disabled="downloadingFile === file.id" @click="downloadFull(c, file)">
                {{ downloadingFile === file.id ? 'baixando…' : 'baixar' }}
              </button>
            </p>
          </div>
          <p v-if="c.rejectionReason" class="reject-reason">Motivo anterior: {{ c.rejectionReason }}</p>

          <div v-if="c.status === 'em_revisao'" class="mod-actions">
            <button class="ok-btn" @click="approve(c)">Aprovar</button>
            <button class="no-btn" @click="rejectingId = rejectingId === c.id ? null : c.id">Reprovar</button>
          </div>

          <div v-if="rejectingId === c.id" class="reject-box">
            <textarea v-model="rejectReason" rows="2" placeholder="Motivo da reprovação (obrigatório — o artista verá isto)" />
            <button class="no-btn" @click="reject(c)">Confirmar reprovação</button>
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
            <tr><th>Nome</th><th>E-mail</th><th>Papéis</th><th>Stripe</th><th>Cadastro</th></tr>
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
              <td>{{ new Date(u.createdAt).toLocaleDateString('pt-BR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ================= Compras ================= -->
    <section v-else-if="tab === 'compras'">
      <p v-if="loadingPurchases" class="muted">Carregando…</p>
      <p v-else-if="!purchases.length" class="muted">Nenhuma compra registrada.</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Data</th><th>Conteúdo</th><th>Comprador</th><th>Artista</th><th>Valor</th><th>Comissão</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in purchases" :key="p.id">
              <td>{{ new Date(p.createdAt).toLocaleDateString('pt-BR') }}</td>
              <td>{{ p.content.title }}</td>
              <td>{{ p.buyer.name || p.buyer.email }}</td>
              <td>{{ p.artist.name || '—' }}</td>
              <td>{{ formatPrice(p.amountCents) }}</td>
              <td>{{ formatPrice(p.platformFeeCents) }}</td>
              <td><span class="pill" :class="p.status">{{ p.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ================= Subcategorias ================= -->
    <section v-else>
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

.mod-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mod-item {
  padding: 1.1rem 1.3rem;
  border: 1px solid $line;
}

.mod-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mod-title {
  font-family: $font-display;
  font-size: 1.1rem;
}

.mod-desc {
  margin-top: 0.5rem;
  color: rgba(var(--fg-rgb), 0.7);
  font-size: 0.9rem;
}

.mod-actions {
  margin-top: 0.9rem;
  display: flex;
  gap: 0.75rem;
}

// Botões funcionais blocados: retos, fundo translúcido, cores funcionais
// (únicas exceções à paleta — guia §8).
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

.reject-box {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  textarea {
    @include block-input;
    padding: 0.6rem 0.8rem;
  }
}

.reject-reason {
  margin-top: 0.5rem;
  color: $color-error;
  font-size: 0.85rem;
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
  font-size: inherit;
  cursor: pointer;
  text-decoration: underline;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.error {
  color: $color-error;
  margin-bottom: 1rem;
}
</style>
