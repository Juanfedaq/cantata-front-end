// Scroll suave global (Lenis — https://lenis.darkroom.engineering).
// Instanciado uma vez no main.ts; NÃO é criado quando:
//  - prefers-reduced-motion está ativo, ou
//  - a resolução é MOBILE (≤1080px, mesmo breakpoint do header): no toque
//    o scroll nativo (com momentum) é melhor e o Lenis pode brigar com ele.
// Em ambos os casos fica o scroll nativo. A decisão é feita no carregamento.
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

export let lenis: Lenis | null = null

// Breakpoint mobile do app (o header vira hambúrguer a partir daqui).
const MOBILE_QUERY = '(max-width: 1080px)'

export function setupSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia(MOBILE_QUERY).matches) return // mobile: scroll nativo
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
