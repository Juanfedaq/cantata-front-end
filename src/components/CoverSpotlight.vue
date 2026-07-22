<script setup lang="ts">
// Layer global (App.vue, irmão do AppBackdrop): mostra a capa do card em
// hover GRANDE no fundo da página, em perspectiva lateral (3D), com
// entrada/saída animadas. Puramente decorativo (aria-hidden, sem
// pointer-events); a troca entre capas faz crossfade (key por URL).
import { useSpotlightStore } from '@/stores/spotlight'

const spotlight = useSpotlightStore()
</script>

<template>
  <div class="spotlight" aria-hidden="true">
    <Transition name="spot">
      <img
        v-if="spotlight.coverUrl"
        :key="spotlight.coverUrl"
        :src="spotlight.coverUrl"
        alt=""
        class="spot-img"
      />
    </Transition>
  </div>
</template>

<style scoped lang="scss">
// Mesmo empilhamento do AppBackdrop (z-index -1); renderizado DEPOIS dele
// no App.vue, então a capa paira sobre os anéis e atrás do conteúdo.
.spotlight {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  // A perspectiva vive no contêiner — o rotateY do filho ganha profundidade.
  perspective: 1200px;
}

// Capa encostada na borda ESQUERDA, girada "para dentro" da página.
// Opacidade baixa (é fundo, não pode brigar com o conteúdo) e bordas
// dissolvidas em gradiente — o motivo da marca (guia §4).
.spot-img {
  position: absolute;
  top: 50%;
  left: -4vw;
  width: min(80vw, 1280px);
  transform: translateY(-50%) rotateY(24deg);
  transform-origin: left center;
  opacity: 0.17;
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 76%, transparent);

  [data-theme='light'] & {
    opacity: 0.12;
  }
}

// Entrada: a capa "abre" vindo de fora (mais girada e deslocada) até o
// pouso; saída é o gesto inverso, mais curta. Só transform/opacity (GPU).
.spot-enter-active {
  transition: opacity 0.9s $ease-brand, transform 0.9s $ease-brand;
}

.spot-leave-active {
  transition: opacity 0.55s $ease-brand, transform 0.55s $ease-brand;
}

.spot-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(-7%) rotateY(40deg);
}

.spot-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(-4%) rotateY(34deg);
}

// Reduced motion: fica só o véu de opacidade (sem giro/deslize).
@media (prefers-reduced-motion: reduce) {
  .spot-enter-from,
  .spot-leave-to {
    transform: translateY(-50%) rotateY(24deg);
  }
}
</style>
