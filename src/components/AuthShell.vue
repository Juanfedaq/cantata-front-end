<script setup lang="ts">
// Cartão central compartilhado pelas telas de autenticação.
// O fundo (anéis + luz do cursor) NÃO vive aqui: é o AppBackdrop global
// (App.vue), que persiste entre TODAS as rotas — este componente remonta
// a cada troca de view, só com o cartão.
import { useThemeStore } from '@/stores/theme'

defineProps<{
  title?: string;
  subtitle?: string;
}>();

const theme = useThemeStore()
</script>

<template>
  <div class="shell">
    <main class="card">
      <div class="logo-frame">
        <img :src="theme.logoSrc" alt="Cantata" class="logo" />
      </div>
      <h1 v-if="title" class="title">{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>

      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
// Fundo transparente: os anéis do AppBackdrop global (camada fixa atrás)
// aparecem por aqui; o body já tem $color-back.
.shell {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 2rem;
  background: rgba(var(--bg-rgb), 0.85);
  // Bloco solto na página → moldura completa de 1px, sem radius (guia §3).
  border: 1px solid $line;
  // backdrop-filter removido: é caro em tempo real, especialmente
  // por cima de um elemento animado. O aumento da opacidade do
  // background (0.6 -> 0.85) compensa visualmente o efeito de "vidro".
}

// Logo entre linhas dissolvidas — motivo da marca (guia §4), como no hero.
.logo-frame {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 1.1rem 0;
  margin-bottom: 0.5rem;
  @include dissolved-lines($color-primary);
}

// Logomarca sem borda (guia §3.6).
.logo {
  height: 56px;
}

.title {
  font-family: $font-display;
  font-weight: 600;
  font-size: 1.5rem;
  color: $color-white;
  text-align: center;
}

.subtitle {
  font-weight: 300;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: $text-secondary;
  text-align: center;
  margin-bottom: 0.75rem;
}

</style>
