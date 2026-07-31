# Deploy e rollback — frontend

> O backend tem o próprio `DEPLOY.md`. **A ordem entre os dois importa**:
> migrar o banco → subir o backend → subir o front. Ver lá o porquê.

## Como o front vai ao ar

**`git push` para a `main` publica sozinho** — auto-deploy pelo hPanel, igual ao
backend (confirmado pelo Juan em 2026-07-28; a evidência de 27/jul apontava
para isso, mas era indireta). **Não é preciso rodar `rsync`.**

⚠️ A consequência disso é que **não existe push "só para guardar"**: qualquer
push na `main` vai ao ar na hora. Trabalho em andamento fica em branch, ou
fica local.

## 1. Build

```bash
npm run build
```

O build faz quatro coisas (ver `docs/paginas.md`):

1. **type-check estrito** — mais rigoroso que `npx vue-tsc --noEmit` avulso.
   Rode `npm run build`, não só o `vue-tsc`, antes de considerar o front pronto;
2. **pré-renderização** de 7 rotas públicas;
3. **sitemap** — busca obras e perfis na API;
4. **`dist/200.html`** — o shell vazio das rotas não pré-renderizadas.

> **Pegadinha do sitemap:** se a API estiver reiniciando (auto-deploy do backend
> em curso), ela responde 503 e o sitemap sai só com as rotas estáticas. O build
> **não falha** — só avisa. Espere a API responder 200 e **rebuilde** antes de
> publicar.

## 2. Publicar

`git push` para a `main`. Em segundos o `public_html` é reescrito.

O caminho manual abaixo fica documentado só para **emergência** (auto-deploy
fora do ar, ou necessidade de republicar um build antigo sem mexer no git):

```bash
rsync -av --delete -e "ssh -p 65002 -i ~/.ssh/cantata_hostinger" \
  dist/ u609374472@46.202.145.147:~/domains/cantata.com.br/public_html/
```

## 3. Conferir no ar — obrigatório

```bash
# o .htaccess chegou? (arquivo com PONTO na frente costuma ser pulado)
curl -sI https://cantata.com.br/biblioteca | head -1        # 200, não 404

# o canonical é o da própria página, não o da home?
curl -s https://cantata.com.br/biblioteca | grep -o '<link rel="canonical"[^>]*>'

# o shell existe?
curl -sI https://cantata.com.br/200.html | head -1
```

O canonical é o teste que importa. Se `/biblioteca` responder com
`canonical href="https://cantata.com.br/"`, o `.htaccess` **não** subiu e todas
as rotas estão servindo o pré-render da ComingSoon de novo — que é exatamente o
problema que o `200.html` veio resolver.

Depois: abrir `/inicio` e `/biblioteca` **logado** e conferir o console. Elas
são pré-renderizadas no estado deslogado, e o header muda conforme a sessão.

---

## Rollback

O front é estático: voltar é republicar o build anterior.

```bash
git revert <commit> && git push      # com auto-deploy
# ou, no manual:
git checkout <commit-bom> && npm run build && rsync ...   # e depois volte para a main
```

**Não precisa mexer no banco nem no backend** — o front não tem estado próprio.
Se o problema for o backend, reverta lá; o front antigo continua funcionando
contra a API antiga.
