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
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}
