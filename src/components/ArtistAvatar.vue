<script setup lang="ts">
// Avatar de artista: mostra a foto de perfil quando existe; o padrão é a
// inicial do nome sobre a cor determinística derivada dele (utils/avatar.ts).
import { computed } from 'vue'
import { fileUrl } from '@/services/api'
import { artistHue } from '@/utils/avatar'

const props = withDefaults(
  defineProps<{
    name: string | null
    avatarPath?: string | null
    size?: number
  }>(),
  { avatarPath: null, size: 56 },
)

const photo = computed(() => fileUrl(props.avatarPath))
const hue = computed(() => artistHue(props.name))
const initial = computed(() => (props.name || '?').charAt(0).toUpperCase())
</script>

<template>
  <span
    class="avatar"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.45)}px`,
      '--artist-hue': hue,
    }"
  >
    <img v-if="photo" :src="photo" :alt="name || 'Artista'" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<style scoped lang="scss">
// Avatar circular: exceção prevista no guia (§8). Imagem sem borda (§3.6).
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: hsl(var(--artist-hue), 42%, 46%);
  color: rgba(255, 255, 255, 0.95);
  font-family: $font-display;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}
</style>
