// Cor determinística a partir do nome (como os avatares do Google):
// hash simples do texto → matiz 0–359. Saturação/luminosidade ficam fixas
// no CSS para toda cor gerada conviver com a paleta editorial.
export function artistHue(name: string | null | undefined): number {
  let hash = 0
  for (const ch of name || '?') {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360
  }
  return hash
}
