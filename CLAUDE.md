# Cantata — site (instruções para o Claude)

> **A documentação do projeto vive no OUTRO repositório**, em
> `cantata-back-end/docs/projeto/`. Se você só clonou este, clone o outro
> também — sem ele faltam a especificação, o estado do projeto e as regras de
> negócio. Os dois ficam lado a lado na mesma pasta.

## ⛔ Antes de qualquer coisa

1. **`../cantata-back-end/docs/projeto/estado.md`** — o checkpoint. Diz o que
   foi feito, o que estava em andamento e o próximo passo.
2. **`../cantata-back-end/docs/projeto/spec.md`** — a especificação mestre.
3. **`docs/guia-de-estilo.md`** — obrigatório antes de escrever qualquer CSS.
4. **`docs/paginas.md`** — o mapa de rotas e telas.

O protocolo de checkpoint (atualizar `estado.md` ao concluir tarefa) está no
`CLAUDE.md` do backend e vale igual aqui.

## Manutenção da documentação (obrigatório)

> **Regra de ouro: mudou o comportamento, o documento muda no MESMO commit.**
> Documentação que descreve um sistema que não existe mais é pior que
> documentação nenhuma — é confiável o bastante para alguém agir e errar.

O protocolo completo (o que criar, o que mover para o histórico, o que apagar,
como escrever) está em `../cantata-back-end/CLAUDE.md` e vale para os dois
repositórios. O que é específico daqui:

| O que você mudou | Onde registrar |
|---|---|
| Rota nova, tela nova, mudança de navegação | `docs/paginas.md` |
| Cor, tipografia, componente, espaçamento, movimento | `docs/guia-de-estilo.md` |
| Qualquer coisa | `../cantata-back-end/docs/projeto/estado.md` |
| Contrato da API que o site consome | o `.md` da feature, em `../cantata-back-end/docs/` |

Bandeira nova em `src/flags.ts` **documenta a si mesma**: escreva no comentário
o que ela fecha, por que, e onde está o par no servidor, se houver.

Antes de dar a tarefa por concluída: nenhum documento pode continuar afirmando
o que deixou de ser verdade.

## Regras deste repositório

- **Vue 3 + TypeScript + Pinia + vue-router**, SCSS. `<script setup>`.
- **Toda chamada HTTP passa por `src/services/api.ts`** (função `request`).
  Nada de `fetch` solto numa view — é ali que moram a URL base, o token, o
  tratamento de 401 e os tipos da API.
- Views em `src/views/`, componentes em `src/components/`, stores em
  `src/stores/`.
- Comentários **em português**, explicando o **porquê**. Se um trecho existe
  por causa de um bug ou de um achado de QA, diga qual.

## Estilo — o que mais quebra

- Leia `docs/guia-de-estilo.md` **antes** de escrever CSS. A identidade é
  blocada: sem `border-radius`, moldura de 1px, rótulos em maiúscula com
  espaçamento, transições longas com a curva da marca.
- **Cor de categoria vem do banco**, como `--cat-hue` inline (helper
  `src/utils/categoryStyle.ts`). Não recrie mapa de cor por slug em SCSS: ele é
  resolvido no build e categoria criada depois do deploy ficaria sem cor.
- **`<button>` não herda `font-family`** — o navegador força a fonte do sistema
  em controle de formulário. Botão com texto precisa de `font: inherit` (ou
  `font-family: inherit`, se já define o próprio tamanho).
- Respeite `prefers-reduced-motion` em toda animação.

## Verificação

```bash
npm run dev
npm run build      # ⚠️ é o que vale
```

⚠️ **`npx vue-tsc --noEmit` pode passar enquanto `npm run build` acusa erro de
tipo real.** Já aconteceu duas vezes. Rode sempre o build antes de dar algo
como pronto.

## Fora de escopo por decisão

- **`ComingSoonView.vue` é intocável**: continua sendo a rota `/` até o
  lançamento. A home real vive em `/inicio`. Nunca remover nem sobrescrever.
- Bandeiras de produto em `src/flags.ts`. `ARTIST_SIGNUP_OPEN` tem **par no
  servidor** — abrir só de um lado deixa o botão visível com a rota recusando,
  ou o caminho invisível com a rota aberta.
- A rota `/artistas` (vitrine de vários artistas) está comentada de propósito.
