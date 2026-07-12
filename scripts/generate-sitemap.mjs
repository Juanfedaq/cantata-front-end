// Gera dist/sitemap.xml após o build (postbuild-only no package.json).
//
// Rotas estáticas públicas entram sempre; as dinâmicas (perfis de artista e
// páginas de obra) são buscadas na API quando ela estiver acessível — se não
// estiver (build local sem backend, pré-lançamento), o sitemap sai só com as
// estáticas e o build NÃO falha, apenas avisa.
//
// URL da API: SITEMAP_API_URL > VITE_API_URL (ambiente ou .env do projeto).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_URL = 'https://cantata.com.br'

// Espelho das rotas públicas indexáveis do src/router/index.ts.
const STATIC_ROUTES = [
  '/',
  '/inicio',
  '/biblioteca',
  '/artistas',
  '/privacidade',
  '/login',
  '/register',
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// .env do Vite não é carregado em scripts Node — lê na mão, só a chave usada.
function envApiUrl() {
  if (process.env.SITEMAP_API_URL) return process.env.SITEMAP_API_URL
  if (process.env.VITE_API_URL) return process.env.VITE_API_URL
  for (const file of ['.env.production', '.env']) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const match = readFileSync(path, 'utf8').match(/^\s*VITE_API_URL\s*=\s*(.+)\s*$/m)
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '')
  }
  return null
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

async function dynamicRoutes(apiUrl) {
  const routes = []

  // Perfis de artista.
  const { artists } = await fetchJson(`${apiUrl}/artists`)
  for (const artist of artists) routes.push(`/artistas/${artist.id}`)

  // Obras aprovadas do catálogo (paginado).
  let page = 1
  let totalPages = 1
  do {
    const data = await fetchJson(`${apiUrl}/catalog?page=${page}&perPage=100`)
    totalPages = data.totalPages ?? 1
    for (const item of data.items) routes.push(`/conteudo/${item.id}`)
    page++
  } while (page <= totalPages)

  return routes
}

function toXml(paths) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = paths
    .map(
      (path) =>
        `  <url>\n    <loc>${SITE_URL}${path === '/' ? '' : path}${path === '/' ? '/' : ''}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const paths = [...STATIC_ROUTES]
const apiUrl = envApiUrl()

if (apiUrl) {
  try {
    paths.push(...(await dynamicRoutes(apiUrl.replace(/\/$/, ''))))
  } catch (err) {
    console.warn(`[sitemap] API indisponível (${err.message}) — sitemap só com rotas estáticas.`)
  }
} else {
  console.warn('[sitemap] VITE_API_URL não definida — sitemap só com rotas estáticas.')
}

const out = join(root, 'dist', 'sitemap.xml')
writeFileSync(out, toXml(paths))
console.log(`[sitemap] ${paths.length} URLs -> ${out}`)
