/**
 * Requisitos da senha — ESPELHO da `validatePassword` do backend
 * (`cantata-back-end/src/routes/auth.js`).
 *
 * POR QUÊ existe: o formulário conferia só "8 caracteres", mas o servidor
 * recusa por cinco motivos diferentes. A lista na tela precisa dizer a mesma
 * coisa que o servidor — uma lista toda verde seguida de erro vermelho é pior
 * do que não ter lista nenhuma (QA 2026-08-05).
 *
 * ⚠️ Ao mexer nas regras do backend, mexa AQUI também. O servidor continua
 * sendo a autoridade: isto é orientação enquanto se digita, não validação.
 */

/** Mesma lista do backend (`SENHAS_COMUNS`), na mesma ordem. */
const SENHAS_COMUNS = new Set([
  '12345678', '123456789', '1234567890', '123456', '1234567', '87654321',
  '11111111', '00000000', '12341234', '123123123', 'abcd1234', 'abc12345',
  'senha123', 'senha1234', 'senha12345', 'senhasenha', 'minhasenha',
  'password', 'password1', 'password123', 'passw0rd', 'qwerty123', 'qwertyui',
  'qwertyuiop', 'asdfghjk', 'zxcvbnm123', '1q2w3e4r', '1qaz2wsx',
  'iloveyou', 'princesa', 'gatinha1', 'amor1234', 'teamo123', 'familia1',
  'brasil123', 'brasil2026', 'flamengo1', 'corinthians', 'palmeiras1',
  'saopaulo1', 'gremio123', 'cruzeiro1', 'vasco123',
  'deusefiel', 'deusnocontrole', 'jesuscristo', 'jesus123', 'aleluia123',
  'admin123', 'administrador', 'adminadmin', 'root1234', 'teste123',
  'cantata123', 'cantata2026', 'musica123', 'musica1234', 'coral123',
  'partitura', 'partitura123', 'maestro123',
])

const PASSWORD_MAX_BYTES = 72

export interface PasswordRule {
  id: string
  /** Texto na lista — afirmação do que a senha JÁ é quando cumprida. */
  label: string
  ok: boolean
}

export interface PasswordContext {
  email?: string
  name?: string
  confirm?: string
}

/** Bytes UTF-8, não caracteres: o bcrypt corta em 72 BYTES, e acento ocupa 2. */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function normalizeEmail(email: string | undefined): string {
  return String(email ?? '').trim().toLowerCase()
}

/**
 * Avalia a senha contra cada requisito. Devolve a lista COMPLETA sempre — a
 * ideia é o usuário ver de antemão o que vai precisar, não descobrir uma
 * regra de cada vez.
 */
export function checkPassword(password: string, contexto: PasswordContext = {}): PasswordRule[] {
  const limpa = password.trim().toLowerCase()
  const email = normalizeEmail(contexto.email)
  const local = email.split('@')[0] ?? ''
  const nome = typeof contexto.name === 'string' ? contexto.name.trim().toLowerCase() : ''

  // Mesmas comparações do backend, na mesma ordem.
  const ehPessoal =
    !!limpa &&
    (limpa === email ||
      (local.length >= 4 && limpa === local) ||
      (nome.length >= 4 && limpa === nome) ||
      (local.length >= 5 && limpa.includes(local)))

  return [
    {
      id: 'min',
      label: 'Pelo menos 8 caracteres',
      ok: password.length >= 8,
    },
    {
      id: 'max',
      label: 'No máximo 72 caracteres (acentos contam como 2)',
      ok: password.length > 0 && byteLength(password) <= PASSWORD_MAX_BYTES,
    },
    {
      id: 'comum',
      label: 'Não é uma senha fácil de adivinhar',
      ok: password.length > 0 && !SENHAS_COMUNS.has(limpa),
    },
    {
      id: 'pessoal',
      label: 'Não é o seu e-mail nem o seu nome',
      ok: password.length > 0 && !ehPessoal,
    },
    {
      id: 'confirma',
      label: 'As duas senhas coincidem',
      ok: password.length > 0 && password === contexto.confirm,
    },
  ]
}

/** Todos os requisitos cumpridos? Usado para liberar o botão de envio. */
export function passwordIsValid(rules: PasswordRule[]): boolean {
  return rules.every((r) => r.ok)
}
