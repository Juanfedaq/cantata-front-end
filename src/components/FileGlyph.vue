<script setup lang="ts">
// Ícone de um arquivo pela extensão do nome (área de upload e afins):
// áudio = nota musical, vídeo = play, resto = folha de documento; com o
// selo da extensão embaixo. Imagem não passa por aqui (mostra a thumb).
const props = defineProps<{ name: string | null | undefined }>()

const ext = (props.name ?? '').toLowerCase().split('.').pop() ?? ''
const kind = ext === 'mp3' ? 'audio' : ext === 'mp4' ? 'video' : 'doc'
const label = ext.length <= 4 ? ext.toUpperCase() : ''
</script>

<template>
  <span class="glyph" aria-hidden="true">
    <svg
      v-if="kind === 'audio'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
    <svg
      v-else-if="kind === 'video'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    >
      <path d="M6 2.5h8L19 7.5V21.5H6z" />
      <path d="M14 2.5v5h5" />
      <path d="M9 12h6M9 15.5h6" stroke-linecap="round" />
    </svg>
  </span>
  <span v-if="label" class="glyph-ext">{{ label }}</span>
</template>

<style scoped lang="scss">
.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--fg-rgb), 0.55);

  svg {
    width: 30px;
    height: 30px;
  }
}

// Selo da extensão: rótulo blocado minúsculo (guia §5).
.glyph-ext {
  @include label-type;
  font-size: 0.56rem;
  font-weight: 600;
  color: $gold-text;
}
</style>
