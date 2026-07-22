# Guia de Estilo — Cantata

> Linguagem visual da plataforma inteira. Toda view/componente novo (e todo
> restyle dos existentes) deve seguir este guia. Primeiro caso aplicado:
> header (`AppLayout.vue`, 2026-07-08). Raiz da identidade: `ComingSoonView.vue`.

---

## 1. Identidade

Tom **editorial de luxo, escuro e dourado**: interface sóbria, tipografia
espaçada, linhas finas, luz como acento. Nada de cantos arredondados, sombras
pesadas ou cores fora da paleta.

## 2. Tokens (fonte: `assets/styles/_variables.scss`)

> Desde 2026-07-08 os derivados e os mixins do padrão blocado vivem no próprio
> `_variables.scss` (injetado em todo `<style lang="scss">` pelo Vite):
> `$ease-brand`, `$line`, `$text-secondary`, `$text-dim`, `$fill-hover`,
> `$fill-active`, `$gold-text`, `$gold-strong`, `$color-error`,
> `$color-success`, e os mixins `dissolved-lines`, `hover-arc`, `label-type`,
> `block-button`, `block-button-primary`, `block-chip`, `block-input`,
> `artist-waves` (§5.1). **Use-os — não redefina.**
>
> **Tema claro/escuro (2026-07-08):** a plataforma usa o sistema da
> ComingSoonView — `--bg-rgb`/`--fg-rgb` no `:root` (main.scss), trocadas por
> `data-theme="light"` no `<html>` pela store `stores/theme.ts` (mesma chave
> `cantata-theme` no localStorage; toggle no header). Por isso:
> **alfas sobre figura/fundo usam `rgba(var(--fg-rgb), x)` /
> `rgba(var(--bg-rgb), x)`** — nunca `rgba($color-white, x)`, que não compila
> mais. `$color-white`/`$color-back` seguem valendo para uso direto
> (`color: $color-white`). O dourado `$color-primary` é o mesmo nos dois temas;
> `$gold-text`/`$gold-strong` clareiam no escuro e escurecem no claro.
> Logomarcas por tema: `theme.logoSrc`/`theme.iconSrc` da store.

| Token | Valor | Uso |
|---|---|---|
| `$color-back` | `#11100d` | Fundo de tudo |
| `$color-white` | `#ece6d8` | Texto e superfícies claras |
| `$color-primary` | `#7a5f0e` | Dourado — acento, nunca em área grande |
| `$font-display` | Playfair Display (serif) | Títulos |
| `$font-body` | Inter | Corpo e UI |

Derivados padronizados (usar sempre estes, não inventar novos):

| Derivado | Valor | Uso |
|---|---|---|
| Linha | `rgba($color-white, 0.1)` | Toda borda e separador |
| Texto secundário | `rgba($color-white, 0.55)` | Labels, itens inativos |
| Texto apagado | `rgba($color-white, 0.4–0.5)` | Legendas, notas |
| Preenchimento hover | `rgba($color-white, 0.03)` | Fundo de item em hover |
| Preenchimento ativo | `rgba($color-white, 0.05)` | Item selecionado/ativo |
| Preench. hover/ativo **opacos** | `$fill-hover-solid` / `$fill-active-solid` (color-mix com o fundo) | Cards/vitrines que não podem deixar o backdrop de anéis atravessar |
| Dourado claro (texto) | `color.adjust($color-primary, $lightness: 22–28%)` | Links ativos, destaques |
| Easing da marca | `cubic-bezier(0.22, 1, 0.36, 1)` · 0.5s | Toda transição |

## 3. O padrão "blocado" (regra central)

Vale para **toda a plataforma** — navegações, grupos de botões, filtros,
cards, tabelas, formulários:

1. **Sem border-radius.** Blocos retos, sempre.
2. **Grupos emoldurados** por linha de 1px (`rgba($color-white, 0.1)`); itens
   internos **colados (sem gap)**, separados por bordas de 1px.
3. **Gap somente entre grupos/zonas**, nunca dentro deles.
4. **Bordas só verticais** quando o contêiner já delimita em cima/embaixo
   (ex.: itens dentro do header); moldura completa quando o bloco está solto
   na página (ex.: cards, caixas de formulário).
5. **Padding lateral, altura total** — dentro de barras, o item estica na
   vertical (`height: 100%` / `align-items: stretch`) e respira só nos lados.
6. **Logomarcas e imagens não levam borda.**

## 4. Interação e movimento

- **Hover "arco"** (padrão para item interativo blocado; substituiu a antiga
  hover-luz em 2026-07-08): um arco dourado de 1px nasce na base do elemento
  e expande para cima até se dissolver — a onda sonora da marca (§5.1) em
  gesto único. Implementação: mixin global `hover-arc` (`_variables.scss`) —
  círculo `::after` centrado na base, `scale(0.08) → scale(2.3)` com fade,
  recortado por `overflow: hidden`; só transform/opacity (GPU). Duração 2s
  com curva própria `cubic-bezier(0.35, 0.1, 0.35, 1)` — exceção registrada
  à $ease-brand, que é acelerada demais no início para animação de percurso
  (o arco cruzaria o box em ~0.3s). Texto clareia junto (`0.55` → branco).
  Guarda de `prefers-reduced-motion` inclusa.
- **Ativo/selecionado**: texto dourado-claro + preenchimento branco 5%.
- **Transições**: sempre `0.5s cubic-bezier(0.22, 1, 0.36, 1)`; propriedades
  baratas (color, opacity, background-color, transform). Nada de "pisca-pisca".
- **Linhas que se dissolvem** (motivo da ComingSoon): em destaques especiais,
  linhas de 1px cujas pontas somem em gradiente
  (`linear-gradient(90deg, transparent, $color 30%, $color 70%, transparent)`).

## 5. Tipografia

- **Títulos**: `$font-display`, peso 600. Hierarquia por tamanho
  (h1 ~1.8rem nas páginas, maior só em banners).
- **Rótulos/nav/botões**: `$font-body` `0.78rem`, uppercase,
  `letter-spacing: 0.16em`, peso 500–600.
- **Corpo**: `$font-body` normal; secundário em `rgba($color-white, 0.55)`.
- **Dados** (nomes, e-mails, preços): sem uppercase — caixa alta é só para rótulo.

## 5.1 Blocos de artista (padrão de identidade)

Padrão para **qualquer vitrine de artista** (aplicado na Home "Últimos
artistas" e nos cards de `/artistas` — usar sempre que um artista aparecer
em bloco):

1. **Cor por nome** (estilo avatares do Google): `artistHue(name)` em
   `src/utils/avatar.ts` — hash do nome → matiz 0–359, aplicada **inline**
   no bloco como `--artist-hue`. Saturação/luminosidade nunca variam
   (ficam fixas nos usos abaixo), para toda cor gerada conviver com a
   paleta editorial.
2. **Fundo tintado OPACO**: `color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 7%, rgb(var(--bg-rgb)))`
   → `13%` no hover. Mesma cor percebida da antiga versão em `hsla`, mas
   misturada com o fundo em vez de translúcida — itens de vitrine
   (artistas, categorias, cards de conteúdo) **não podem ter fundo com
   opacidade**, senão o backdrop global de anéis atravessa (2026-07-08).
3. **Avatar**: componente `ArtistAvatar.vue` — foto (`avatarPath`) quando o
   artista enviou; padrão = inicial sobre `hsl(var(--artist-hue), 42%, 46%)`.
4. **Onda sonora**: mixin `artist-waves($avatar, $center-top)` do
   `_variables.scss` — 16 anéis concêntricos de 1px na cor do artista,
   centrados no avatar, esmaecendo até a moldura (passo 22px, opacidade
   0.42 → ~0.03). Markup: `.waves > .wave.wave-1..16` (aria-hidden).
   O bloco precisa de `position: relative` + `overflow: hidden`.
5. **Hover**: além do hover-arco e do nome em `$gold-text`, os anéis expandem
   em cascata — `.wave { animation: sound-wave 1.8s $ease-brand infinite; }`
   (atrasos negativos já vêm do mixin; guarda de `prefers-reduced-motion`
   inclusa).
6. **Texto acima dos anéis**: conteúdo do bloco com `position: relative`.
7. Blocos **colados** no grid (sem gap, `margin: 0 -1px -1px 0`), como todo
   grupo blocado (§3).

Referência de implementação: `HomeView.vue` (seção "Últimos artistas") e
`ArtistasView.vue`.

## 6. Componentes (estado do restyle)

| Componente | Regra | Status |
|---|---|---|
| Header (`AppLayout.vue`) | **sem logomarca** (2026-07-08): menu blocado único centralizado, hover-arco; o botão do usuário (avatar `ArtistAvatar` 26px + nome + seta) abre um **dropdown blocado** (2026-07-09: Meu Perfil, Minhas Compras, Meus Conteúdos, Sair — painel com moldura 1px, itens colados separados por linha, vidro do header, entra com véu + descida leve em transform/opacity); ao lado, switch de tema de duas células (lua \| sol) com indicador deslizante (fill ativo + linha dourada na base, easing da marca) | ✅ aplicado |
| Cards (`ContentCard.vue`, categorias da Home, Artistas) | moldura completa 1px, sem radius. Hover-arco só nos cards de categoria — **ContentCard e blocos de artista ficam SEM o arco** (2026-07-09; nos artistas a onda sonora já é o gesto do hover) | ✅ aplicado |
| Botões (primário/secundário) | mixins `block-button(-primary)`; primário `rgba($color-primary, 0.1)` → `0.22` no hover | ✅ aplicado (2026-07-08) |
| Filtros da Biblioteca (chips) + abas do Admin | mixin `block-chip`: grupo colado, bordas de 1px sobrepostas | ✅ aplicado (2026-07-08) |
| Formulários (inputs) | mixin `block-input`: fundo `rgba(white, 0.05)`, borda linha, sem radius | ✅ aplicado (2026-07-08) |
| Banner da Home | destaque especial: linhas que se dissolvem + luz na base | ✅ aplicado (2026-07-08) |
| Blocos de artista (Home + `/artistas`) | cor por nome + onda sonora + `ArtistAvatar` (§5.1) | ✅ aplicado (2026-07-08) |
| Badges/pills (status) | quadrados, uppercase; "pendente/em revisão" em dourado (amarelo antigo saiu da paleta) | ✅ aplicado (2026-07-08) |
| Tabelas (Admin) | separadores de linha `rgba(white, 0.08)`, headers uppercase `0.16em` | ✅ aplicado (2026-07-08) |
| Footer | linha superior 1px, texto apagado | ✅ ok |
| Views de auth (`_auth.scss` + `AuthShell.vue`) | blocado completo: `block-input`/`block-button-primary`, alertas com cores funcionais, cartão com moldura 1px, logo entre linhas dissolvidas | ✅ aplicado (2026-07-08) |
| Fundo global (`AppBackdrop.vue`, no `App.vue`) | onda sonora do §5.1 em escala de página no **dourado da marca** (`--gold-text`, adapta por tema), bem suave, com **centro no canto superior direito**; 18 anéis individuais com **parallax pelo scroll do Lenis** (menor anel = mais rápido `--speed: 0.55`, maior = mais lento `~0.07`; `--scroll` no backdrop → transform por anel, GPU); luz dourada segue o cursor; pulso do canto a cada 9s; **persiste entre TODAS as views** (fora do RouterView; `z-index: -1`). ComingSoon fica sem ele (spec §9.1) | ✅ aplicado (2026-07-08) |
| Capa em destaque no fundo (`CoverSpotlight.vue`, no `App.vue`) | hover/foco em card de obra (`ContentCard`) publica a capa na store `spotlight`; o layer global (fixed, z-index -1, DEPOIS do AppBackdrop — paira sobre os anéis, atrás do conteúdo) mostra a imagem GRANDE encostada à ESQUERDA em **perspectiva lateral 3D** (`perspective` no contêiner + `rotateY(24deg)`, origin left, `min(80vw, 1280px)`), opacidade baixa por tema (0.17 escuro / 0.12 claro) e bordas dissolvidas em gradiente (motivo §4). Entrada/saída pelo `<Transition>` (0.9s/0.55s, $ease-brand, só transform/opacity); troca entre cards faz crossfade (key por URL, hide com atraso de 90ms para não piscar); reduced-motion fica só com o fade | ✅ aplicado (2026-07-22) |
| ComingSoonView | **NÃO TOCAR** (spec §9.1) | 🔒 |

## 7. Responsivo

- Breakpoint principal do header: `1080px` (nav desce para linha própria).
- Grids de cards: `repeat(auto-fill, minmax(220px, 1fr))`.
- Blocos mantêm o padrão em qualquer largura — nunca degradar para pílulas.

## 8. O que é proibido

- `border-radius` (exceto avatares circulares já existentes — revisar depois).
- Cores fora da paleta (exceções: as funcionais — erro `#e07a5f` e sucesso
  `#81b29a` —, a cor por nome dos blocos de artista (regra do §5.1) e as
  cores por categoria das tags de conteúdo: matizes FIXAS em
  `$category-hues` no `_variables.scss` — partituras 215/azul, músicas
  42/âmbar, cifras 150/verde, coreografias 335/rosé — sempre via mixin
  `category-tag` (S/L travadas; texto adapta por tema via `--cat-tag-l`)).
- Sombras (`box-shadow`) — profundidade vem de translucidez e linhas.
  **Exceção registrada (2026-07-22, pedido do time):** `ContentCard.vue`
  leva sombra DIFUSA "premium" — preta, baixa e espalhada
  (`0 14px 32px -18px rgba(0,0,0,0.45)`), **FIXA no conteúdo padrão**
  (sem efeito de hover na sombra). **No tema escuro** a sombra preta some
  sobre o fundo `#11100d`, então a profundidade vem de um halo dourado bem
  fraco (`rgba($color-primary, 0.18)`, também fixo) via
  `[data-theme='dark'] &`. **Card de MUSICAL** (`.is-musical`): a sombra
  inteira vira o dourado da marca (`rgba($color-primary, 0.4–0.45)`) e é o
  ÚNICO que aprofunda no hover (`0.55–0.6`) — segundo diferenciador do
  card, junto com o badge. A capa do musical também "RESPIRA": zoom em
  loop lento e fino (`scale 1 → 1.06` em 9s, alternate, só
  transform/GPU; recorte por `overflow: hidden` no `.cover`; guarda de
  `prefers-reduced-motion` inclusa). Sombra dura/deslocada segue proibida;
  sem `translateY` no hover (o transform inline dos cards é do motion-v —
  a animação da capa fica no `img`, que o motion-v não toca).
- Gradientes roxos/azuis, glassmorphism genérico, uppercase em dados.
- Transições lineares ou instantâneas em elementos interativos.
