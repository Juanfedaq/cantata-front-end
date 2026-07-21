import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { safeStorage } from '@/utils/safeStorage'

// Tema claro/escuro da plataforma — mesmo sistema (e mesma chave de
// localStorage) da ComingSoonView, para a escolha valer nos dois lados.
type Theme = 'dark' | 'light'
const THEME_KEY = 'cantata-theme'

// Prioridade: ?theme= na URL > escolha salva > preferência do sistema.
// Na pré-renderização (Node, sem window) fica o escuro padrão — o valor
// real é resolvido no browser assim que o app monta.
function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const fromQuery = new URLSearchParams(window.location.search).get('theme')
  const stored = safeStorage.getItem(THEME_KEY)
  return fromQuery === 'light' || fromQuery === 'dark'
    ? fromQuery
    : stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(resolveInitialTheme())

  const isDark = computed(() => theme.value === 'dark')

  // Logomarcas por tema (as versões pretas existem em /public).
  const logoSrc = computed(() => (isDark.value ? '/logo.svg' : '/logo-black.svg'))
  const iconSrc = computed(() => (isDark.value ? '/icon.svg' : '/icon-black.svg'))

  function toggle() {
    theme.value = isDark.value ? 'light' : 'dark'
    safeStorage.setItem(THEME_KEY, theme.value)
  }

  // Aplica o tema no <html> (troca as CSS vars --bg-rgb/--fg-rgb do main.scss)
  // e mantém a UI do browser (barra mobile) na cor do tema.
  watch(
    theme,
    (t) => {
      if (typeof document === 'undefined') return // SSG: não há DOM global
      document.documentElement.dataset.theme = t
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', t === 'dark' ? '#11100D' : '#ECE6D8')
    },
    { immediate: true },
  )

  return { theme, isDark, logoSrc, iconSrc, toggle }
})
