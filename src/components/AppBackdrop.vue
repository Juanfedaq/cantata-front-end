<script setup lang="ts">
// Fundo global do sistema (todas as views, exceto a ComingSoon — spec §9.1):
// anéis "onda sonora" no dourado da marca com centro no canto superior
// direito + luz que segue o cursor. Vive no App.vue, FORA do RouterView —
// não reinicia ao trocar de view.
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

// Diâmetro da luz — precisa bater com o CSS (.cursor-light).
const LIGHT = 620

const backdrop = ref<HTMLElement | null>(null)
const light = ref<HTMLElement | null>(null)

let x = 0
let y = 0
let raf = 0

function apply() {
  raf = 0
  if (light.value) {
    light.value.style.transform = `translate3d(${x - LIGHT / 2}px, ${y - LIGHT / 2}px, 0)`
  }
}

function onPointerMove(e: PointerEvent) {
  x = e.clientX
  y = e.clientY
  // Um frame por vez: se já há um agendado, só atualiza as coordenadas.
  if (!raf) raf = requestAnimationFrame(apply)
}

// O Lenis já emite no ritmo do rAF, com o valor suavizado — basta repassar.
function onScroll(e: Lenis) {
  backdrop.value?.style.setProperty('--scroll', String(e.scroll))
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  lenis?.on('scroll', onScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  cancelAnimationFrame(raf)
  lenis?.off('scroll', onScroll)
})
</script>

<template>
  <!-- z-index -1: atrás de todo o conteúdo, acima do fundo do body. -->
  <div ref="backdrop" class="backdrop" aria-hidden="true">
    <div class="rings">
      <div v-for="i in RING_COUNT" :key="i" :class="['ring', `ring-${i}`]"></div>
    </div>
    <div ref="light" class="cursor-light"></div>
    <div class="pulse"></div>
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
}

.rings {
  position: absolute;
  inset: 0;
}

// Anéis de 1px no dourado da marca (--gold-text adapta por tema), centrados
// no canto superior direito e esmaecendo com o tamanho. O parallax entra no
// transform: cada anel sobe com o scroll na própria velocidade (--speed).
.ring {
  position: absolute;
  top: 0;
  right: 0;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--gold-text) 30%, transparent);
  transform: translate(50%, -50%)
    translate3d(0, calc(var(--scroll, 0) * var(--speed, 0) * -1px), 0);
  will-change: transform;
}

// Menor anel = mais opaco e MAIS RÁPIDO; maior = mais apagado e mais lento.
@for $i from 1 through 18 {
  .ring-#{$i} {
    $d: $i * 110px;
    width: $d;
    height: $d;
    opacity: #{0.9 - ($i - 1) * 0.048}; // 0.9 → ~0.08
    --speed: #{0.55 - ($i - 1) * 0.028}; // 0.55 → ~0.07
  }
}

// Luz dourada que segue o cursor (acento de luz da marca, guia §4).
// Movida só por transform; a transition dá o "perseguir" suave sem JS.
.cursor-light {
  position: absolute;
  top: 0;
  left: 0;
  width: 620px;
  height: 620px;
  background: radial-gradient(circle, rgba($color-primary, 0.09), transparent 66%);
  // Posição inicial: o canto dos anéis, até o cursor mexer.
  transform: translate3d(calc(100vw - 310px), -310px, 0);
  transition: transform 0.8s $ease-brand;
  will-change: transform;
}

// Uma onda que emana do canto de tempos em tempos e se dissolve
// (cascata do §5.1 em pulso único, lento e discreto).
.pulse {
  position: absolute;
  left: 100%;
  top: 0;
  width: 240px;
  height: 240px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--gold-text) 35%, transparent);
  opacity: 0;
  animation: app-pulse 9s $ease-brand infinite;
  will-change: transform, opacity;
}

@keyframes app-pulse {
  0% {
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 0;
  }
  10% {
    opacity: 0.18;
  }
  55%,
  100% {
    transform: translate(-50%, -50%) scale(7);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pulse {
    display: none;
  }
}
</style>
