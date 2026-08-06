<script setup lang="ts">
/**
 * Ícone de linha por categoria. Mesma família dos ícones do sistema (switch de
 * tema): traço 1.5, pontas/cantos redondos, herda `currentColor`.
 *
 * Recebe a CHAVE do ícone (`categories.icon`), não mais o slug. Antes o
 * desenho era escolhido pelo slug — o que só funcionava enquanto as quatro
 * categorias eram fixas. Com o admin criando categorias, o ícone virou uma
 * escolha dele dentro deste catálogo (2026-08-06).
 *
 * Chave desconhecida cai na nota musical genérica — inclusive quando o slug
 * antigo chega aqui por engano, o que mantém as telas de pé em vez de deixar
 * um buraco.
 *
 * Ícone novo: acrescente um `<template>` aqui E a chave em
 * `cantata-back-end/src/categoryIcons.js` (é lá que a API valida a escolha).
 */
defineProps<{
  icon: string
  size?: number
}>()
</script>

<template>
  <svg
    :width="size ?? 26"
    :height="size ?? 26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Partituras: folha com dobra e uma nota dentro -->
    <template v-if="icon === 'partituras'">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <circle cx="9.8" cy="15.9" r="1.5" />
      <path d="M11.3 15.9v-4.7l3.2 1.1" />
    </template>

    <!-- Músicas: par de colcheias unidas -->
    <template v-else-if="icon === 'musicas'">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="18.5" cy="16" r="2.5" />
    </template>

    <!-- Cifras: diagrama de acorde (braço com trastes e pestana) -->
    <template v-else-if="icon === 'cifras'">
      <path d="M6.5 5v14M11 5v14M15.5 5v14M20 5v14" />
      <path d="M6.5 5H20M6.5 9.7H20M6.5 14.4H20M6.5 19H20" />
      <circle cx="13.25" cy="7.35" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.75" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </template>

    <!-- Coreografias: figura dançando (braços e pernas em movimento) -->
    <template v-else-if="icon === 'coreografias'">
      <circle cx="12.5" cy="4.2" r="1.9" />
      <path d="M12.2 7v5" />
      <path d="M12.2 8.6 7.4 6" />
      <path d="M12.2 8.8l4.7 1.6" />
      <path d="M12.2 12l-3.4 6.4" />
      <path d="M12.2 12l3.9 3 1.3 3.8" />
    </template>

    <!-- Documento: folha com linhas de texto -->
    <template v-else-if="icon === 'documento'">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7M8.5 16.5h5" />
    </template>

    <!-- Livro: capa aberta com lombada -->
    <template v-else-if="icon === 'livro'">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
    </template>

    <!-- Imagem: moldura com sol e montanha -->
    <template v-else-if="icon === 'imagem'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.4" cy="9.4" r="1.6" />
      <path d="m3.5 17.2 4.8-4.8a1.6 1.6 0 0 1 2.3 0L15 16.8" />
      <path d="m13.6 15.4 2-2a1.6 1.6 0 0 1 2.3 0l2.6 2.6" />
    </template>

    <!-- Vídeo: filmadora -->
    <template v-else-if="icon === 'video'">
      <rect x="2.5" y="5.5" width="13" height="13" rx="2" />
      <path d="m15.5 10 6-3.5v11l-6-3.5" />
    </template>

    <!-- Disco: vinil -->
    <template v-else-if="icon === 'disco'">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </template>

    <!-- Microfone: cápsula, arco e pedestal -->
    <template v-else-if="icon === 'microfone'">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
      <path d="M8.5 21h7" />
    </template>

    <!-- Fone de ouvido: arco e as duas conchas -->
    <template v-else-if="icon === 'fone'">
      <path d="M4 15v-2.6a8 8 0 0 1 16 0V15" />
      <rect x="2" y="14.4" width="4.6" height="6.2" rx="1.9" />
      <rect x="17.4" y="14.4" width="4.6" height="6.2" rx="1.9" />
    </template>

    <!-- Alto-falante: caixa e ondas -->
    <template v-else-if="icon === 'alto-falante'">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M15 9.2a4 4 0 0 1 0 5.6" />
      <path d="M17.8 6.6a8 8 0 0 1 0 10.8" />
    </template>

    <!-- Violão: corpo, boca e braço -->
    <template v-else-if="icon === 'violao'">
      <circle cx="9.5" cy="14.5" r="6.2" />
      <circle cx="9.5" cy="14.5" r="1.8" />
      <path d="M14.8 9.2 20.5 3.5" />
      <path d="M18.8 1.8 22.2 5.2" />
    </template>

    <!-- Piano: teclado com as teclas pretas -->
    <template v-else-if="icon === 'piano'">
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <path d="M7.25 6v12M12 6v12M16.75 6v12" />
      <rect x="6.15" y="6" width="2.2" height="6.6" fill="currentColor" stroke="none" />
      <rect x="10.9" y="6" width="2.2" height="6.6" fill="currentColor" stroke="none" />
      <rect x="15.65" y="6" width="2.2" height="6.6" fill="currentColor" stroke="none" />
    </template>

    <!-- Metrônomo: corpo trapezoidal, haste e peso -->
    <template v-else-if="icon === 'metronomo'">
      <path d="M9.5 3h5l4.5 18h-14L9.5 3Z" />
      <path d="M12 21 15.8 7" />
      <circle cx="14.8" cy="10.4" r="1.1" fill="currentColor" stroke="none" />
    </template>

    <!-- Coro: três figuras lado a lado -->
    <template v-else-if="icon === 'coro'">
      <circle cx="12" cy="6.6" r="2.7" />
      <path d="M7.6 19.5a4.4 4.4 0 0 1 8.8 0" />
      <circle cx="4.8" cy="9.8" r="2" />
      <path d="M1.6 19.5v-1a3.2 3.2 0 0 1 3.2-3.2" />
      <circle cx="19.2" cy="9.8" r="2" />
      <path d="M22.4 19.5v-1a3.2 3.2 0 0 0-3.2-3.2" />
    </template>

    <!-- Calendário: data especial (usado também na lista de temas) -->
    <template v-else-if="icon === 'calendario'">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </template>

    <!-- Estrela: destaque -->
    <template v-else-if="icon === 'estrela'">
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </template>

    <!-- Pasta: coleção -->
    <template v-else-if="icon === 'pasta'">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.6h8.8A1.5 1.5 0 0 1 21 9.1v8.4a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V6.5Z"
      />
    </template>

    <!-- Todos: grade de quadrados — usada no filtro "todas as categorias" -->
    <template v-else-if="icon === 'todos'">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </template>

    <!-- Fallback: nota musical simples -->
    <template v-else>
      <path d="M11 17.5V5l5.5 1.8" />
      <circle cx="8.5" cy="17.5" r="2.5" />
    </template>
  </svg>
</template>
