<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Musical } from '@/services/api'

// Bloco de MUSICAL (data especial) das vitrines — leva à Biblioteca já
// filtrada naquele musical. Como no ContentCard, o componente é só o card:
// o grid/grupo blocado (blocos colados, sem gap) fica no pai.
defineProps<{
  musical: Musical
}>()
</script>

<template>
  <RouterLink :to="`/biblioteca?tipo=musical&musical=${musical.id}`" class="musical-card">
    <span class="kicker">Musical</span>
    <span class="name">{{ musical.name }}</span>
  </RouterLink>
</template>

<style scoped lang="scss">
// Bloco colado do grupo (guia §3) na tinta DOURADA da marca — a cor da
// identidade dos musicais (badge e sombra dos cards) — OPACA via color-mix
// (o backdrop de anéis não pode atravessar, disciplina do §5.1).
.musical-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  text-align: center;
  padding: 1.65rem 1rem 1.4rem;
  border: 1px solid $line;
  margin: 0 -1px -1px 0;
  text-decoration: none;
  background: color-mix(in srgb, $color-primary 6%, rgb(var(--bg-rgb)));
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;
  @include hover-light;

  &:hover {
    background: color-mix(in srgb, $color-primary 13%, rgb(var(--bg-rgb)));

    .name {
      color: $gold-strong;
    }
  }
}

// Rótulo pequeno acima do nome — mesma voz do badge dos cards de conteúdo.
.kicker {
  @include label-type;
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(var(--fg-rgb), 0.45);
}

.name {
  font-family: $font-display;
  font-size: 1.15rem;
  color: $gold-text;
  transition: color 0.5s $ease-brand;
}
</style>
