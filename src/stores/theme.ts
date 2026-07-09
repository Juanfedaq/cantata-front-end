import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

// Tema claro/escuro da plataforma — mesmo sistema (e mesma chave de
// localStorage) da ComingSoonView, para a escolha valer nos dois lados.
type Theme = 'dark' | 'light'
const THEME_KEY = 'cantata-theme'

export const useThemeStore = defineStore('theme', () => {
  // Prioridade: ?theme= na URL > escolha salva > preferência do sistema.
  const fromQuery = new URLSearchParams(window.location.search).get('theme')
  const stored = localStorage.getItem(THEME_KEY)
  const theme = ref<Theme>(
    fromQuery === 'light' || fromQuery === 'dark'
      ? fromQuery
      : stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark',
  )

  const isDark = computed(() => theme.value === 'dark')

  // Logomarcas por tema (as versões pretas existem em /public).
  const logoSrc = computed(() => (isDark.value ? '/logo.svg' : '/logo-black.svg'))
  const iconSrc = computed(() => (isDark.value ? '/icon.svg' : '/icon-black.svg'))

  function toggle() {
    theme.value = isDark.value ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, theme.value)
  }

  // Aplica o tema no <html> (troca as CSS vars --bg-rgb/--fg-rgb do main.scss)
  // e mantém a UI do browser (barra mobile) na cor do tema.
  watch(
    theme,
    (t) => {
      document.documentElement.dataset.theme = t
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', t === 'dark' ? '#11100D' : '#ECE6D8')
    },
    { immediate: true },
  )

  return { theme, isDark, logoSrc, iconSrc, toggle }
})
