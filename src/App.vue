<template>
  <div class="bg-wrapper">
    <div class="color-shift"></div>
    <img src="/icon.svg" alt="" aria-hidden="true" class="watermark" />
    <div class="content">
      <img src="/logo.svg" alt="Cantata" class="bg-image" />
      <p class="message">Plataforma em desenvolvimento</p>
      <span class="divider"></span>
    </div>
  </div>
</template>

<script setup>
// Nenhuma lógica adicional necessária — o efeito é feito em CSS
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden; /* opcional, evita scroll */
}
.bg-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: $color-back;

  /* Centraliza o ícone */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Camada de cor animada, atrás do ícone */
.color-shift {
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    135deg,
    $color-back 0%,
    color.adjust($color-back, $lightness: 8%) 25%,
    $color-back 50%,
    color.adjust($color-back, $lightness: 8%) 75%,
    $color-back 100%
  );
  background-size: 200% 200%;
  animation: movePosition 12s ease-in-out infinite;
}

/* Marca d'água: ícone bem grande ao fundo */
.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(90vw, 90vh);
  height: auto;
  object-fit: contain;
  opacity: 0.05;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

/* Conteúdo central: ícone + mensagem empilhados */
.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

/* Ícone pequeno, centralizado por cima do fundo */
.bg-image {
  height: 96px;
  object-fit: contain;
}

/* Mensagem abaixo do ícone */
.message {
  font-family: $font-body;
  font-weight: 300;
  letter-spacing: 0.06em;
  color: $color-primary;
  font-size: 1.5rem;
}

/* Linha elegante abaixo do texto */
.divider {
  width: 240px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, $color-primary 50%, transparent 100%);
  opacity: 0.7;
}

@keyframes movePosition {
  0% {
    background-position: 0% 0%;
  }
  25% {
    background-position: 100% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
  75% {
    background-position: 0% 100%;
  }
  100% {
    background-position: 0% 0%;
  }
}
</style>
