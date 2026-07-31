# cantata-front-end

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

O build faz mais do que compilar (ver `docs/paginas.md`):

1. **type-check estrito** — mais rigoroso que `npx vue-tsc --noEmit` avulso;
   rode `npm run build` antes de considerar o front pronto;
2. **pré-renderização (vite-ssg)** de 7 rotas públicas;
3. `scripts/generate-sitemap.mjs` — sitemap com as rotas estáticas + as obras e
   perfis buscados na API (se ela não responder, o build **não** falha: sai só
   com as estáticas e avisa);
4. `scripts/generate-spa-shell.mjs` — `dist/200.html`, o shell vazio para onde
   o `.htaccess` manda as rotas não pré-renderizadas.

⚠️ **No deploy**, conferir que `.htaccess` e `200.html` chegaram ao servidor.

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
