<script setup lang="ts">
// Meu Perfil: foto de perfil (trocar/remover) e biografia pública do artista.
// Para quem ainda não é artista, mostra o convite "Torne-se um artista"
// (fluxo que morava no dashboard, aposentado em favor do dropdown do header).
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import { ApiError, artistsApi, authApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const error = ref('')
const success = ref('')

// ---- Upgrade para artista ----
// Mesmo usuário, papel adicional (spec §3.2).
const upgrading = ref(false)

async function upgrade() {
  upgrading.value = true
  error.value = ''
  success.value = ''
  try {
    await artistsApi.upgrade()
    await auth.refresh()
    router.push('/artista/conteudos')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos atualizar sua conta agora. Tente de novo em instantes.'
    upgrading.value = false
  }
}

// ---- Exclusão de conta (LGPD) ----
// Ação irreversível: pede confirmação explícita (senha, ou o e-mail quando a
// conta é só-Google). O backend anonimiza os dados pessoais e mantém o
// histórico de compras, que é obrigação fiscal — o texto abaixo diz isso ao
// titular ANTES de ele confirmar, não depois.
const deleting = ref(false)
const deleteOpen = ref(false)
const deletePassword = ref('')
const deleteEmail = ref('')
// Conta sem senha = criada pelo Google (o backend pede o e-mail como confirmação).
const isGoogleOnly = ref(false)

async function deleteAccount() {
  deleting.value = true
  error.value = ''
  try {
    await authApi.deleteAccount(
      isGoogleOnly.value ? { confirmEmail: deleteEmail.value } : { password: deletePassword.value },
    )
    auth.logout()
    router.push('/')
  } catch (err) {
    // O backend responde CONFIRM_EMAIL_REQUIRED quando a conta é só-Google:
    // troca o campo em vez de deixar o titular tentando a senha que não tem.
    //
    // Pelo CÓDIGO, não pelo texto (2026-08-05): até aqui isto comparava
    // `message.includes('e-mail da conta')`, e bastaria reescrever a frase no
    // servidor para o campo parar de trocar — sem nada quebrar visivelmente.
    if (err instanceof ApiError && err.code === 'CONFIRM_EMAIL_REQUIRED') {
      isGoogleOnly.value = true
    }
    error.value =
      err instanceof Error ? err.message : 'Não conseguimos encerrar sua conta agora. Tente de novo em instantes.'
    deleting.value = false
  }
}

// ---- Foto de perfil ----
// Padrão sem foto: inicial sobre a cor derivada do nome (ArtistAvatar).
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarSaving = ref(false)

async function onAvatarPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // permite escolher o mesmo arquivo de novo
  if (!file) return
  avatarSaving.value = true
  error.value = ''
  success.value = ''
  try {
    await artistsApi.uploadAvatar(file)
    await auth.refresh() // atualiza o avatarPath do usuário logado
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos guardar sua foto agora. Tente de novo em instantes.'
  } finally {
    avatarSaving.value = false
  }
}

async function removeAvatar() {
  avatarSaving.value = true
  error.value = ''
  success.value = ''
  try {
    await artistsApi.removeAvatar()
    await auth.refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos remover a foto agora. Tente de novo em instantes.'
  } finally {
    avatarSaving.value = false
  }
}

// ---- Nome ----
// Vale para TODA conta, não só artista: comprador também erra ao digitar, e
// quem entra pelo Google recebe o nome que o Google mandar. Até 2026-08-05 não
// havia como corrigir — nenhuma rota atualizava o nome.
const name = ref('')
const nameSaving = ref(false)

// Só habilita o botão quando há mudança de verdade, para "Salvar" não parecer
// quebrado ao ser clicado sem efeito nenhum.
const nameChanged = computed(() => name.value.trim() !== (auth.user?.name ?? '').trim())

async function saveName() {
  nameSaving.value = true
  error.value = ''
  success.value = ''
  try {
    const { user } = await authApi.updateName(name.value.trim())
    auth.setUser(user)
    name.value = user.name ?? ''
    success.value = 'Nome atualizado.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos guardar seu nome agora. Tente de novo em instantes.'
  } finally {
    nameSaving.value = false
  }
}

// ---- Biografia ----
const bio = ref('')
const bioSaving = ref(false)

onMounted(async () => {
  // Garante nome, bio e foto mais recentes (todos vêm do /me).
  await auth.refresh().catch(() => {})
  name.value = auth.user?.name ?? ''
  bio.value = auth.user?.bio ?? ''
})

async function saveBio() {
  bioSaving.value = true
  error.value = ''
  success.value = ''
  try {
    await artistsApi.updateProfile(bio.value.trim())
    await auth.refresh()
    success.value = 'Perfil atualizado.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não conseguimos salvar sua biografia agora. Tente de novo em instantes.'
  } finally {
    bioSaving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Meu Perfil</h1>
    <p class="lead">
      {{
        auth.isArtist
          ? 'É assim que você aparece na vitrine de artistas e no seu perfil público.'
          : `Você está logado como ${auth.user?.email}.`
      }}
    </p>

    <p v-if="error" class="feedback error">{{ error }}</p>
    <p v-if="success" class="feedback ok">{{ success }}</p>

    <!-- Ainda não é artista: convite para o upgrade (ex-dashboard). -->
    <section v-if="!auth.isArtist" class="group upgrade">
      <h2 class="group-label">Torne-se um artista</h2>
      <p class="upgrade-text">
        Publique partituras, músicas, cifras e coreografias e receba pelas vendas.
      </p>
      <button class="save-btn" :disabled="upgrading" @click="upgrade">
        {{ upgrading ? 'Ativando…' : 'Quero vender meus conteúdos' }}
      </button>
    </section>

    <!-- Nome: primeira seção porque é o que aparece em todo lugar (header,
         vitrine, perfil público) e vale para qualquer conta. -->
    <section class="group">
      <h2 class="group-label">Nome</h2>
      <input
        v-model="name"
        type="text"
        class="name-input"
        maxlength="120"
        autocomplete="name"
        placeholder="Seu nome"
        @keyup.enter="nameChanged && !nameSaving && saveName()"
      />
      <div class="group-foot">
        <span class="hint">
          {{ auth.isArtist ? 'É o nome que aparece nas suas obras.' : 'Aparece no seu recibo de compra.' }}
        </span>
        <button class="save-btn" :disabled="nameSaving || !nameChanged" @click="saveName">
          {{ nameSaving ? 'Salvando…' : 'Salvar nome' }}
        </button>
      </div>
    </section>

    <!-- Foto de perfil -->
    <section v-if="auth.isArtist" class="group">
      <h2 class="group-label">Foto de perfil</h2>
      <div class="avatar-row">
        <ArtistAvatar
          :name="auth.user?.name ?? null"
          :avatar-path="auth.user?.avatarPath"
          :size="96"
        />
        <div class="avatar-actions">
          <button class="action" :disabled="avatarSaving" @click="avatarInput?.click()">
            {{ avatarSaving ? 'Salvando…' : auth.user?.avatarPath ? 'Trocar foto' : 'Adicionar foto' }}
          </button>
          <button
            v-if="auth.user?.avatarPath"
            class="action danger"
            :disabled="avatarSaving"
            @click="removeAvatar"
          >
            Remover foto
          </button>
          <p class="hint">JPG, PNG ou WebP, até 5MB. Sem foto, mostramos a inicial do seu nome.</p>
        </div>
      </div>
      <input
        ref="avatarInput"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        class="avatar-input"
        @change="onAvatarPicked"
      />
    </section>

    <!-- Biografia -->
    <section v-if="auth.isArtist" class="group">
      <h2 class="group-label">Biografia</h2>
      <textarea
        v-model="bio"
        class="bio-input"
        rows="6"
        maxlength="2000"
        placeholder="Conte quem você é, sua trajetória musical, influências…"
      ></textarea>
      <div class="group-foot">
        <span class="hint">{{ bio.length }}/2000</span>
        <button class="save-btn" :disabled="bioSaving" @click="saveBio">
          {{ bioSaving ? 'Salvando…' : 'Salvar biografia' }}
        </button>
      </div>
    </section>

    <!-- Exclusão de conta: por último e visualmente separado, para não
         competir com as ações do dia a dia. -->
    <section class="group danger">
      <h2 class="group-label">Excluir minha conta</h2>
      <p class="danger-text">
        Seus dados pessoais — nome, e-mail, foto e biografia — são removidos e a
        conta deixa de existir. <strong>O histórico de compras é mantido</strong>,
        por obrigação fiscal: quem comprou suas obras continua com o download, e
        as suas compras seguem no registro contábil da plataforma. Suas obras
        saem do catálogo e não podem mais ser vendidas. <strong>Não há
        volta.</strong>
      </p>

      <button v-if="!deleteOpen" class="danger-btn" @click="deleteOpen = true">
        Quero excluir minha conta
      </button>

      <div v-else class="danger-confirm">
        <label v-if="isGoogleOnly" class="danger-label">
          Digite o e-mail da conta para confirmar
          <input v-model="deleteEmail" type="email" class="input" autocomplete="off" />
        </label>
        <label v-else class="danger-label">
          Digite sua senha para confirmar
          <input v-model="deletePassword" type="password" class="input" autocomplete="current-password" />
        </label>
        <div class="danger-actions">
          <button class="danger-btn" :disabled="deleting" @click="deleteAccount">
            {{ deleting ? 'Excluindo…' : 'Excluir definitivamente' }}
          </button>
          <button class="cancel-btn" :disabled="deleting" @click="deleteOpen = false">
            Cancelar
          </button>
        </div>
      </div>
    </section>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
}

.lead {
  margin-top: 0.4rem;
  color: $text-secondary;
  font-size: 0.92rem;
}

.feedback {
  margin-top: 1rem;
  font-size: 0.9rem;

  &.error {
    color: $color-error;
  }
  &.ok {
    color: $color-success;
  }
}

// Grupo blocado solto na página: moldura completa de 1px (guia §3).
.group {
  margin-top: 1.5rem;
  padding: 1.5rem;
  border: 1px solid $line;
}

.group-label {
  @include label-type;
  color: $text-secondary;
  margin-bottom: 1.25rem;
}

// Convite ao upgrade: moldura dourada (mesma ênfase do antigo card).
.upgrade {
  border-color: rgba($color-primary, 0.45);
}

.upgrade-text {
  font-size: 0.92rem;
  color: rgba(var(--fg-rgb), 0.65);
  margin-bottom: 1.25rem;
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.avatar-actions {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.action {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.9rem;
  color: $gold-text;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.danger {
    color: $color-error;
  }
}

// Zona de exclusão de conta: mesma linguagem do resto (grupo blocado, sem
// sombra), com a tinta de erro reservada para a ação irreversível.
.danger {
  border-color: rgba($color-error, 0.35);
}

.danger-text {
  margin-bottom: 1rem;
  color: rgba(var(--fg-rgb), 0.75);
  font-size: 0.9rem;
  line-height: 1.6;
}

.danger-btn {
  @include label-type;
  font-weight: 600;
  padding: 0.6rem 1.4rem;
  border: 1px solid rgba($color-error, 0.5);
  background: none;
  color: $color-error;
  cursor: pointer;
  transition: background-color 0.5s $ease-brand;

  &:hover:not(:disabled) {
    background: rgba($color-error, 0.12);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.danger-label {
  display: block;
  margin-bottom: 0.75rem;
  color: rgba(var(--fg-rgb), 0.75);
  font-size: 0.85rem;
}

.danger-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cancel-btn {
  @include label-type;
  padding: 0.6rem 1.4rem;
  border: 1px solid $line;
  background: none;
  color: rgba(var(--fg-rgb), 0.7);
  cursor: pointer;
}

.hint {
  width: 100%;
  font-size: 0.8rem;
  color: $text-dim;
}

.avatar-input {
  display: none;
}

.name-input {
  @include block-input;
  width: 100%;
}

.bio-input {
  @include block-input;
  width: 100%;
  resize: vertical;
  line-height: 1.6;
}

// Botão desabilitado (nada mudou no campo): apagado, sem parecer clicável.
.save-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.group-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;

  .hint {
    width: auto;
  }
}

.save-btn {
  @include block-button-primary;
  padding: 0.6rem 1.4rem;
}
</style>
