<script setup lang="ts">
// Fundo global do sistema (todas as views, exceto a ComingSoon — spec §9.1):
// arcos "onda sonora" no dourado da marca com centro no canto superior
// direito; a luz é fixa (--light-angle no CSS): arcos acesos de um lado,
// em sombra do outro, com um feixe cônico dando volume atrás deles.
// Vive no App.vue, FORA do RouterView — não reinicia ao trocar de view.
//
// Parallax (2026-07-08): cada anel é um elemento próprio e reage ao scroll
// do Lenis com velocidade decrescente pelo tamanho — o MENOR anel é o mais
// rápido, o MAIOR o mais lento (profundidade). O scroll suavizado do Lenis
// vira a var --scroll no backdrop; cada anel aplica seu --speed no
// transform (só transform/opacity — GPU, sem repaint). Sob
// prefers-reduced-motion o Lenis nem existe e os anéis ficam parados.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type Lenis from 'lenis'
import { lenis } from '@/scroll'

// Precisa bater com o @for do SCSS.
const RING_COUNT = 18

const backdrop = ref<HTMLElement | null>(null)

// O Lenis já emite no ritmo do rAF, com o valor suavizado — basta repassar.
function onScroll(e: Lenis) {
  backdrop.value?.style.setProperty('--scroll', String(e.scroll))
}

onMounted(() => {
  lenis?.on('scroll', onScroll)
})

onBeforeUnmount(() => {
  lenis?.off('scroll', onScroll)
})
</script>

<template>
  <!-- z-index -1: atrás de todo o conteúdo, acima do fundo do body. -->
  <div ref="backdrop" class="backdrop" aria-hidden="true">
    <div class="beam"></div>
    <div class="rings">
      <div v-for="i in RING_COUNT" :key="i" :class="['ring', `ring-${i}`]"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  // Scroll suavizado do Lenis (px, sem unidade) — alimenta o parallax.
  --scroll: 0;
  // Ângulo de luz (deg, convenção conic-gradient: 0 = topo, horário):
  // fixo, apontando do canto para dentro da tela — o único knob para
  // reposicionar a luz dos arcos e do feixe.
  --light-angle: 225deg;
}

.rings {
  position: absolute;
  inset: 0;
}

// Feixe de luz: véu cônico suave que aponta do canto dos anéis na direção
// de --light-angle — é o "volume" da luz atrás dos arcos; o lado oposto
// fica naturalmente em sombra. Esmaece com a distância via mask radial.
.beam {
  position: absolute;
  top: 0;
  right: 0;
  width: 3200px;
  height: 3200px;
  border-radius: 50%;
  transform: translate(50%, -50%);
  background: conic-gradient(
    from calc(var(--light-angle, 45deg) - 40deg),
    transparent 0deg,
    color-mix(in srgb, var(--gold-text) 8%, transparent) 40deg,
    transparent 80deg
  );
  -webkit-mask: radial-gradient(circle closest-side, #000 0%, transparent 72%);
  mask: radial-gradient(circle closest-side, #000 0%, transparent 72%);
}

// Arcos no dourado da marca (--gold-text adapta por tema), centrados no
// canto superior direito e esmaecendo com o tamanho. Em vez de uma linha
// uniforme, cada anel é pintado com um conic-gradient que acende só o lado
// voltado para --light-angle e apaga o lado oposto — luz de um lado,
// sombra do outro. A linha em si é recortada por uma mask radial com
// meia-pixel de rampa nas duas bordas (antialias); a espessura (--stroke)
// afina com a profundidade. O parallax entra no transform: cada anel sobe
// com o scroll na própria velocidade (--speed).
.ring {
  position: absolute;
  top: 0;
  right: 0;
  border-radius: 50%;
  background: conic-gradient(
    from var(--light-angle, 45deg),
    color-mix(in srgb, var(--gold-text) 90%, transparent) 0deg,
    color-mix(in srgb, var(--gold-text) 3%, transparent) 140deg,
    color-mix(in srgb, var(--gold-text) 3%, transparent) 220deg,
    color-mix(in srgb, var(--gold-text) 90%, transparent) 360deg
  );
  -webkit-mask: radial-gradient(
    circle closest-side,
    transparent calc(100% - var(--stroke, 1.5px) - 0.5px),
    #000 calc(100% - var(--stroke, 1.5px)),
    #000 100%,
    transparent calc(100% + 0.5px)
  );
  mask: radial-gradient(
    circle closest-side,
    transparent calc(100% - var(--stroke, 1.5px) - 0.5px),
    #000 calc(100% - var(--stroke, 1.5px)),
    #000 100%,
    transparent calc(100% + 0.5px)
  );
  transform: translate(50%, -50%)
    translate3d(0, calc(var(--scroll, 0) * var(--speed, 0) * -1px), 0);
  // Onda de brilho (substitui o antigo pulso que crescia do canto): cada
  // arco clareia e volta ao tom base, um por um, do menor para o maior —
  // o escalonamento vem do animation-delay por índice (--i); a opacidade
  // base (--o) é a referência que o keyframe multiplica.
  opacity: var(--o, 0.5);
  animation: ring-glow 9s $ease-brand infinite;
  animation-delay: calc(var(--i, 0) * 0.35s);
  will-change: transform, opacity;
}

// Menor anel = mais opaco, mais espesso e MAIS RÁPIDO; maior = mais
// apagado, mais fino e mais lento (profundidade).
@for $i from 1 through 18 {
  .ring-#{$i} {
    $d: $i * 110px;
    width: $d;
    height: $d;
    --o: #{0.9 - ($i - 1) * 0.048}; // 0.9 → ~0.08
    --i: #{$i - 1}; // índice do escalonamento da onda de brilho
    --speed: #{0.55 - ($i - 1) * 0.028}; // 0.55 → ~0.07
    --stroke: #{1.8 - ($i - 1) * 0.035}px; // 1.8px → ~1.2px
  }
}

// O brilho sobe rápido e assenta devagar (~1.5s do ciclo de 9s por arco);
// com o delay de 0.35s/arco a onda leva ~6s para varrer os 18 e o resto
// do ciclo é repouso. calc sobre --o mantém a hierarquia de profundidade
// (arcos apagados clareiam na mesma proporção, com um piso de +0.12).
@keyframes ring-glow {
  0%,
  16%,
  100% {
    opacity: var(--o, 0.5);
  }
  6% {
    opacity: calc(var(--o, 0.5) * 1.6 + 0.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ring {
    animation: none;
  }
}
</style>
