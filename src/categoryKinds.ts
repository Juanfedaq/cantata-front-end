/**
 * Naturezas de categoria — espelho de `cantata-back-end/src/categoryKinds.js`.
 * Mudou lá, mude aqui.
 *
 * O servidor é quem MANDA: ele recusa o arquivo que não bate. O que está aqui
 * serve para o formulário avisar antes, filtrar o seletor de arquivo do
 * sistema e escrever a dica embaixo do campo — trabalho de interface, não de
 * segurança.
 */

export type CategoryKind = 'documento' | 'audio' | 'video' | 'imagem'

export const CATEGORY_KINDS: CategoryKind[] = ['documento', 'audio', 'video', 'imagem']

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp'

/** O que o seletor de arquivo oferece nos arquivos completos. */
export const KIND_ACCEPT: Record<CategoryKind, string> = {
  documento: `.pdf,.docx,${IMAGE_ACCEPT}`,
  audio: '.mp3',
  video: '.mp4',
  imagem: IMAGE_ACCEPT,
}

/** Prévia: `.docx` sai porque o navegador não renderiza — viraria download. */
export const KIND_PREVIEW_ACCEPT: Record<CategoryKind, string> = {
  documento: `.pdf,${IMAGE_ACCEPT}`,
  audio: '.mp3',
  video: '.mp4',
  imagem: IMAGE_ACCEPT,
}

/** Dica embaixo do campo, na voz do site. */
export const KIND_HINT: Record<CategoryKind, string> = {
  documento: '.pdf, .docx ou imagem',
  audio: 'áudio .mp3',
  video: 'vídeo .mp4',
  imagem: 'imagem .jpg, .png ou .webp',
}

/** Rótulo da natureza no painel do admin ("o que esta categoria recebe"). */
export const KIND_LABEL: Record<CategoryKind, string> = {
  documento: 'Documentos e imagens',
  audio: 'Áudio',
  video: 'Vídeo',
  imagem: 'Imagens',
}

/**
 * Plural → singular, o suficiente para o português dos nomes de categoria.
 *
 * Serve à frase "Este produto contém: 2 arquivos de partitura". O nome da
 * categoria vem no plural ("Partituras"), e repetir o plural ali soaria
 * errado. As regras cobrem as terminações que aparecem de verdade; nome que
 * escapar delas só perde o "s" final, o que erra pouco e nunca quebra a tela.
 */
export function noSingular(nome: string): string {
  const s = nome.toLowerCase()
  if (s.endsWith('ões')) return `${s.slice(0, -3)}ão` // canções → canção
  if (s.endsWith('ãos')) return s.slice(0, -1) // mãos → mão
  if (s.endsWith('ais')) return `${s.slice(0, -3)}al` // corais → coral
  if (s.endsWith('éis')) return `${s.slice(0, -3)}el` // papéis → papel
  if (s.endsWith('ns')) return `${s.slice(0, -2)}m` // armazéns → armazém
  if (s.endsWith('res') || s.endsWith('ses') || s.endsWith('zes')) return s.slice(0, -2)
  if (s.endsWith('s')) return s.slice(0, -1)
  return s
}

/**
 * Como chamar UM arquivo desta categoria.
 *
 * Áudio e vídeo ganham o nome da natureza: "2 arquivos de áudio" diz mais ao
 * comprador do que "2 arquivos de música". Nas outras vale o nome que o admin
 * deu à categoria, no singular — "partitura" é melhor que "documento".
 */
export function substantivoDoArquivo(cat: { kind?: string | null; name: string }): string {
  if (cat.kind === 'audio') return 'áudio'
  if (cat.kind === 'video') return 'vídeo'
  return noSingular(cat.name)
}
