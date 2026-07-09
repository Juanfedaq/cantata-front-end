<script setup lang="ts">
// Aviso de cookies/armazenamento local (global, no App.vue). Só usamos
// armazenamento essencial (sessão, tema, este consentimento), então é um
// aviso informativo com um único aceite. A escolha fica no localStorage
// e o modal não volta a aparecer.
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const STORAGE_KEY = 'cantata-cookies-aceitos'

const visible = ref(!localStorage.getItem(STORAGE_KEY))

function accept() {
  localStorage.setItem(STORAGE_KEY, new Date().toISOString())
  visible.value = false
}
</script>

<template>
  <Transition name="cookie">
    <aside
      v-if="visible"
      class="cookie-modal"
      role="dialog"
      aria-label="Aviso de cookies e privacidade"
    >
      <h2 class="title">Cookies &amp; privacidade</h2>
      <p class="text">
        O Cantata usa apenas armazenamento essencial no seu navegador —
        sessão de login, tema escolhido e este aceite. Sem rastreadores,
        sem publicidade. Detalhes na
        <RouterLink to="/privacidade" class="link">Política de Privacidade</RouterLink>.
      </p>
      <button class="accept" @click="accept">Entendi</button>
    </aside>
  </Transition>
</template>

<style scoped lang="scss">
// Bloco solto sobre a página: moldura completa de 1px, sem radius (guia §3),
// fundo OPACO (o backdrop de anéis não atravessa) e linhas dissolvidas no
// título — destaque especial (guia §4).
.cookie-modal {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  z-index: 100; // acima do header (50)
  width: min(680px, calc(100vw - 2rem));
  padding: 1.5rem 1.75rem;
  border: 1px solid $line;
  background: $color-back;
}

.title {
  @include label-type;
  font-weight: 600;
  color: $gold-text;
  display: inline-block;
  padding: 0.5rem 0;
  @include dissolved-lines(rgba($color-primary, 0.5));
}

.text {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgba(var(--fg-rgb), 0.7);
}

.link {
  color: $gold-text;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $gold-strong;
    text-decoration: underline;
  }
}

.accept {
  @include block-button-primary;
  margin-top: 1.1rem;
  padding: 0.6rem 1.6rem;
}

// Entrada/saída: sobe da base dissolvendo, com o easing da marca.
.cookie-enter-active,
.cookie-leave-active {
  transition:
    opacity 0.5s $ease-brand,
    transform 0.5s $ease-brand;
}

.cookie-enter-from,
.cookie-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}
</style>
