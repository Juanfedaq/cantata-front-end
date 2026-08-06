import type { CSSProperties } from 'vue'

/**
 * Matiz de uma categoria como variável CSS inline.
 *
 * Até 2026-08-05 a cor vinha de um mapa SCSS (`$category-hues`) que gerava uma
 * classe por slug — `.partituras { --cat-hue: 215 }` — em oito arquivos. Isso
 * deixou de funcionar quando as categorias viraram editáveis: o mapa é
 * resolvido no BUILD, e uma categoria criada pelo painel depois do deploy
 * nunca teria classe. Ela cairia no dourado de fallback, igual a todas as
 * outras sem cor — e o admin não teria como corrigir.
 *
 * Agora a matiz vem do banco e desce como `style="--cat-hue: 215"`. A
 * disciplina continua no CSS: saturação e luminância seguem travadas lá, e só
 * a matiz varia — é o que mantém as cores geradas convivendo com a paleta
 * editorial (mesma regra da cor por nome dos artistas).
 *
 * O 45 de reserva é o dourado da marca, para o caso de uma resposta antiga em
 * cache chegar sem `hue`.
 */
export function catHue(cat: { hue?: number | null } | null | undefined): CSSProperties {
  return { '--cat-hue': String(cat?.hue ?? 45) } as CSSProperties
}
