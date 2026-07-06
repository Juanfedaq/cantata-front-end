<script setup lang="ts">
// Moldura visual compartilhada pelas telas de autenticação:
// mesmo fundo animado e marca d'água da landing, com um cartão central.
defineProps<{
  title?: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="shell">
    <div class="bg" aria-hidden="true">
      <div class="color-shift"></div>
      <img src="/icon.svg" alt="" class="watermark" />
    </div>

    <main class="card">
      <img src="/logo.svg" alt="Cantata" class="logo" />
      <h1 v-if="title" class="title">{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>

      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.shell {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background-color: $color-back;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

// Fundo animado numa camada fixa e recortada: o conteúdo pode crescer
// além da viewport e rolar normalmente (ex.: cadastro em tela baixa)
// sem o fundo criar barras de rolagem nem sumir durante o scroll.
.bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.color-shift {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  background: linear-gradient(
    135deg,
    $color-back 0%,
    color.adjust($color-back, $lightness: 8%) 25%,
    $color-back 50%,
    color.adjust($color-back, $lightness: 8%) 75%,
    $color-back 100%
  );
  will-change: transform;
  transform: translateZ(0);
  animation: movePosition 16s ease-in-out infinite;
}

.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(90vw, 90vh);
  height: auto;
  opacity: 0.04;
  pointer-events: none;
  user-select: none;
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
  background: rgba($color-back, 0.85);
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: 16px;
  // backdrop-filter removido: é caro em tempo real, especialmente
  // por cima de um elemento animado. O aumento da opacidade do
  // background (0.6 -> 0.85) compensa visualmente o efeito de "vidro".
}

.logo {
  height: 56px;
  margin-bottom: 0.5rem;
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
  color: rgba($color-white, 0.7);
  text-align: center;
  margin-bottom: 0.75rem;
}

@keyframes movePosition {
  0% {
    transform: translate3d(0, 0, 0);
  }
  25% {
    transform: translate3d(-8%, 4%, 0);
  }
  50% {
    transform: translate3d(-4%, -8%, 0);
  }
  75% {
    transform: translate3d(6%, -4%, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .color-shift {
    animation: none;
  }
}
</style>
