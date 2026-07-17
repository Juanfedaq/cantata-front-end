// Scroll suave global (Lenis — https://lenis.darkroom.engineering).
// Instanciado uma vez no main.ts; com prefers-reduced-motion ativo,
// o Lenis nem é criado e fica o scroll nativo.
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export let lenis: Lenis | null = null

export function setupSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // autoRaf: o próprio Lenis mantém o loop de requestAnimationFrame.
  lenis = new Lenis({ autoRaf: true })
}

// Volta ao topo (usado na troca de rota): imediato, sem animar o caminho —
// navegação não é rolagem, o suave fica para o scroll do usuário.
export function scrollToTop() {
  if (typeof window === 'undefined') return // pré-renderização (SSG): sem scroll
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}

// Trava/destrava a rolagem da página (ex.: menu mobile aberto). O
// overflow:hidden sozinho não basta — o Lenis rola programaticamente e
// passa por cima dele; precisa parar o próprio Lenis.
export function lockScroll(locked: boolean) {
  if (typeof window === 'undefined') return
  document.documentElement.style.overflow = locked ? 'hidden' : ''
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  }
}
