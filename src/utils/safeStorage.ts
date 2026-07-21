// Acesso a localStorage que NUNCA lança. Em alguns navegadores — Safari no
// iOS com "Bloquear todos os cookies" (ou site data desativado) é o caso
// mais comum — localStorage.getItem/setItem lança SecurityError mesmo com
// `localStorage` existindo como objeto; sem isso, a aplicação inteira
// quebrava no boot só de tentar ler o tema salvo (tela branca no Safari,
// achado numa investigação de bug em produção, 2026-07-21). Também cobre a
// pré-renderização (Node): sem `localStorage` global, o acesso lança
// ReferenceError, capturado do mesmo jeito.
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Sem persistência (modo privado/bloqueio de cookies): a sessão/tema
      // valem só em memória durante a visita — sem erro pro usuário.
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // idem
    }
  },
}
