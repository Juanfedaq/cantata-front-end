<template>
  <div class="bg-wrapper">
    <div class="color-shift"></div>
    <img src="/bg.svg" alt="Background" class="bg-image" />
  </div>
</template>

<script setup>
// Nenhuma lógica adicional necessária — o efeito é feito em CSS
</script>

<style>
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
}

/* Camada de cor animada, atrás da imagem */
.color-shift {
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    135deg,
    #ece6d8 0%,
    #c3a342 25%,
    #ece6d8 50%,
    #c3a342 75%,
    #ece6d8 100%
  );
  background-size: 200% 200%;
  animation: movePosition 12s ease-in-out infinite;
}

/* Imagem por cima, ocupando 100% */
.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
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
