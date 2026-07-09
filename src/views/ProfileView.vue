<script setup lang="ts">
// Meu Perfil: foto de perfil (trocar/remover) e biografia pública do artista.
// Para quem ainda não é artista, mostra o convite "Torne-se um artista"
// (fluxo que morava no dashboard, aposentado em favor do dropdown do header).
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import { artistsApi } from '@/services/api'
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
    error.value = err instanceof Error ? err.message : 'Erro ao fazer o upgrade.'
    upgrading.value = false
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
    error.value = err instanceof Error ? err.message : 'Erro ao enviar a foto.'
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
    error.value = err instanceof Error ? err.message : 'Erro ao remover a foto.'
  } finally {
    avatarSaving.value = false
  }
}

// ---- Biografia ----
const bio = ref('')
const bioSaving = ref(false)

onMounted(async () => {
  // Garante a bio mais recente (o /me devolve bio e avatarPath).
  await auth.refresh().catch(() => {})
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
    error.value = err instanceof Error ? err.message : 'Erro ao salvar a biografia.'
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

.hint {
  width: 100%;
  font-size: 0.8rem;
  color: $text-dim;
}

.avatar-input {
  display: none;
}

.bio-input {
  @include block-input;
  width: 100%;
  resize: vertical;
  line-height: 1.6;
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
