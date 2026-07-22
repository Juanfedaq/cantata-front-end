<script setup lang="ts">
// Ícone de linha por categoria (slug vindo da API). Mesma família dos
// ícones do sistema (switch de tema): traço 1.5, pontas/cantos redondos,
// herda currentColor. Slug desconhecido cai na nota musical genérica.
defineProps<{
  slug: string
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
    <template v-if="slug === 'partituras'">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <circle cx="9.8" cy="15.9" r="1.5" />
      <path d="M11.3 15.9v-4.7l3.2 1.1" />
    </template>

    <!-- Músicas: par de colcheias unidas -->
    <template v-else-if="slug === 'musicas'">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="18.5" cy="16" r="2.5" />
    </template>

    <!-- Cifras: diagrama de acorde (braço com trastes e pestana) -->
    <template v-else-if="slug === 'cifras'">
      <path d="M6.5 5v14M11 5v14M15.5 5v14M20 5v14" />
      <path d="M6.5 5H20M6.5 9.7H20M6.5 14.4H20M6.5 19H20" />
      <circle cx="13.25" cy="7.35" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.75" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </template>

    <!-- Coreografias: figura dançando (braços e pernas em movimento) -->
    <template v-else-if="slug === 'coreografias'">
      <circle cx="12.5" cy="4.2" r="1.9" />
      <path d="M12.2 7v5" />
      <path d="M12.2 8.6 7.4 6" />
      <path d="M12.2 8.8l4.7 1.6" />
      <path d="M12.2 12l-3.4 6.4" />
      <path d="M12.2 12l3.9 3 1.3 3.8" />
    </template>

    <!-- Musicais: máscara de teatro (datas especiais do ano) -->
    <template v-else-if="slug === 'musicais'">
      <path d="M5.5 4.6c3.2 1.5 9.8 1.5 13 0v6.6c0 5.2-3 8.8-6.5 8.8s-6.5-3.6-6.5-8.8V4.6Z" />
      <path d="M8.7 10c.6-.8 1.7-.8 2.3 0" />
      <path d="M13 10c.6-.8 1.7-.8 2.3 0" />
      <path d="M9 13.6c1.7 1.9 4.3 1.9 6 0" />
    </template>

    <!-- Todos: grade de quadrados — todas as categorias -->
    <template v-else-if="slug === 'todos'">
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
