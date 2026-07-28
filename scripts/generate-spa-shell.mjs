// Gera dist/200.html após o build (postbuild-only no package.json).
//
// POR QUÊ: as rotas que NÃO são pré-renderizadas pelo vite-ssg (/conteudo/:id,
// /compras, /perfil, /artistas/:id…) caem no fallback do .htaccess. Se esse
// fallback for o index.html, elas recebem o HTML PRÉ-RENDERIZADO DA COMINGSOON,
// com dois efeitos ruins:
//   1. SEO — <title> e <link rel="canonical"> de TODAS elas apontam para a
//      home, e o buscador tende a deduplicar tudo numa página só;
//   2. desempenho — o Vue hidrata sobre o DOM errado, joga a árvore fora e
//      re-renderiza (custo logo no load, justamente no celular).
//
// O 200.html é o mesmo shell (mesmos assets), mas VAZIO e sem as tags de SEO
// específicas da home. Cada rota passa a montar do zero e o @unhead/vue põe o
// título/canonical certos no cliente.
//
// O nome "200.html" é a convenção de shell de SPA (Netlify, Surge). Aqui quem
// aponta para ele é o RewriteRule final do public/.htaccess.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'dist', 'index.html')
const target = join(root, 'dist', '200.html')

let html = readFileSync(source, 'utf8')

// Cada transformação é obrigatória: se o vite-ssg mudar o formato da saída
// numa atualização, é melhor QUEBRAR O BUILD do que publicar um shell com
// pedaços da home dentro (o bug que este script existe para evitar).
function apply(label, pattern, replacement) {
  if (!pattern.test(html)) {
    throw new Error(
      `[spa-shell] não encontrei "${label}" no dist/index.html — o formato do ` +
        `vite-ssg mudou? Revise scripts/generate-spa-shell.mjs antes de publicar.`,
    )
  }
  html = html.replace(pattern, replacement)
}

// 1. Esvazia o corpo do app (sai o markup pré-renderizado da ComingSoon) e
//    tira o data-server-rendered — sem conteúdo não há o que hidratar.
apply('div#app pré-renderizado', /<div id="app"[^>]*>[\s\S]*<\/div><\/body>/, '<div id="app"></div></body>')

// 2. Tira as tags de SEO que valem só para a home. O restante (título e
//    descrição padrão da marca) fica como fallback de quem não roda JS.
apply('canonical da home', /<link rel="canonical"[^>]*>/, '')
apply('og:url da home', /<meta property="og:url"[^>]*>/, '')

// 3. Tira o preload do chunk da ComingSoon: nas outras rotas ele seria
//    download inútil (a view certa é carregada sob demanda pelo router).
apply(
  'preload do chunk da ComingSoon',
  /<link rel="modulepreload"[^>]*ComingSoonView[^>]*>|<link rel="stylesheet"[^>]*ComingSoonView[^>]*>/g,
  '',
)

writeFileSync(target, html)
console.log(`[spa-shell] ${(html.length / 1024).toFixed(1)} KiB -> ${target}`)
