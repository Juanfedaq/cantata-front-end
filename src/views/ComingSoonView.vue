<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

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

<style scoped lang="scss">
.bg-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: $color-back;
  display: flex;
  align-items: center;
  justify-content: center;
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
  transform: translateZ(0); // promove pra própria layer/compositor
  animation: movePosition 16s ease-in-out infinite;
}

.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(90vw, 90vh);
  height: auto;
  opacity: 0.05;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

.bg-image {
  height: 96px;
  object-fit: contain;
}

.message {
  font-family: $font-body;
  font-weight: 300;
  font-size: 1.5rem;
  letter-spacing: 0.06em;
  color: $color-primary;
}

.divider {
  width: 240px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, $color-primary 50%, transparent 100%);
  opacity: 0.7;
}

.enter-link {
  font-family: $font-body;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba($color-white, 0.7);
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: $color-primary;
  }
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
