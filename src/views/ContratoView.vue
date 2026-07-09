<script setup lang="ts">
// Termos do Artista: leitura + aceite obrigatório antes de publicar obras.
// O markdown vem do backend (versionado em platform_fees.contract_version);
// o aceite grava versão + data no perfil. O backend também bloqueia a
// publicação sem aceite (middleware requireContract) — aqui é a UX.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import AppLayout from '@/components/AppLayout.vue'
import { artistsApi, type ArtistContract } from '@/services/api'

const route = useRoute()
const router = useRouter()

const contract = ref<ArtistContract | null>(null)
const loading = ref(true)
const error = ref('')
const agreed = ref(false)
const accepting = ref(false)
const accepted = ref(false)

// O texto é nosso (arquivo do backend), mas sanidade básica: marked sem
// html cru já cobre; o conteúdo não recebe input de usuário.
const html = computed(() =>
  contract.value ? (marked.parse(contract.value.markdown, { async: false }) as string) : '',
)

const redirectTo = computed(() =>
  typeof route.query.redirect === 'string' ? route.query.redirect : '/artista/publicar',
)

onMounted(async () => {
  try {
    contract.value = await artistsApi.contract()
    accepted.value = contract.value.upToDate
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar o contrato.'
  } finally {
    loading.value = false
  }
})

async function accept() {
  if (!contract.value || !agreed.value) return
  accepting.value = true
  error.value = ''
  try {
    await artistsApi.acceptContract(contract.value.version)
    accepted.value = true
    router.push(redirectTo.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao registrar o aceite.'
    accepting.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="contract">
      <h1 class="page-title">Termos do Artista</h1>

      <p v-if="loading" class="muted">Carregando o contrato…</p>
      <p v-if="error" class="error">{{ error }}</p>

      <template v-if="contract">
        <p v-if="accepted" class="status ok">
          ✅ Você aceitou a versão {{ contract.acceptedVersion }} destes termos
          <template v-if="contract.acceptedAt">
            em {{ new Date(contract.acceptedAt).toLocaleDateString('pt-BR') }}</template>.
          Pode publicar normalmente.
        </p>
        <p v-else-if="contract.acceptedVersion" class="status warn">
          Os termos mudaram desde o seu último aceite (você aceitou a versão
          {{ contract.acceptedVersion }}; a vigente é {{ contract.version }}).
          Leia e aceite novamente para continuar publicando.
        </p>

        <!-- Texto do contrato (markdown renderizado) -->
        <div class="doc" v-html="html"></div>

        <!-- Aceite -->
        <div v-if="!accepted" class="accept-box">
          <label class="check">
            <input v-model="agreed" type="checkbox" />
            <span>
              Li e aceito os Termos do Artista (versão {{ contract.version }}), incluindo as
              regras de comissão, repasse e responsabilidade sobre direitos autorais.
            </span>
          </label>
          <button class="accept-btn" :disabled="!agreed || accepting" @click="accept">
            {{ accepting ? 'Registrando…' : 'Li e aceito' }}
          </button>
        </div>
        <RouterLink v-else :to="redirectTo" class="back-link">← Voltar para a publicação</RouterLink>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.contract {
  max-width: 760px;
  margin: 0 auto;
}

.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
  margin-bottom: 1rem;
}

.status {
  padding: 0.8rem 1rem;
  border: 1px solid $line;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;

  &.ok {
    color: $color-success;
    border-color: rgba($color-success, 0.4);
  }

  &.warn {
    color: $gold-text;
    border-color: rgba($color-primary, 0.45);
  }
}

// Documento emoldurado (bloco solto → moldura completa; fundo opaco).
.doc {
  border: 1px solid $line;
  background: $fill-hover-solid;
  padding: 2rem;
  line-height: 1.7;
  font-size: 0.95rem;
  color: rgba(var(--fg-rgb), 0.75);

  :deep(h1) {
    font-family: $font-display;
    font-size: 1.4rem;
    color: $color-white;
    margin-bottom: 1rem;
  }

  :deep(h2) {
    font-family: $font-display;
    font-size: 1.1rem;
    color: $color-white;
    margin: 1.75rem 0 0.6rem;
  }

  :deep(p) {
    margin: 0.6rem 0;
  }

  :deep(ul) {
    padding-left: 1.2rem;
    margin: 0.6rem 0;
  }

  :deep(li) {
    margin: 0.3rem 0;
  }

  :deep(strong) {
    color: rgba(var(--fg-rgb), 0.92);
  }

  :deep(blockquote) {
    border-left: 2px solid rgba($color-primary, 0.5);
    padding-left: 1rem;
    color: $text-dim;
    margin: 0.75rem 0;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid $line;
    margin: 1.5rem 0;
  }
}

// Caixa de aceite: destaque dourado, colada logo abaixo do documento.
.accept-box {
  margin-top: 1.5rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba($color-primary, 0.45);
  background: $fill-active-solid;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.92rem;
  line-height: 1.6;
  color: rgba(var(--fg-rgb), 0.85);

  input {
    margin-top: 0.3rem;
    accent-color: $color-primary;
  }
}

.accept-btn {
  @include block-button-primary;
  align-self: flex-start;
}

.back-link {
  display: inline-block;
  margin-top: 1.5rem;
  color: $gold-text;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $gold-strong;
  }
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
  margin-bottom: 1rem;
}
</style>
