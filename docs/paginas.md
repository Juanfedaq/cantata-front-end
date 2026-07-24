# Páginas do Frontend (spec §9)

| Rota | View | Acesso |
|---|---|---|
| `/` | `ComingSoonView.vue` | público — **INTOCÁVEL até o lançamento (spec §9.1)** |
| `/inicio` | `HomeView.vue` — banner, destaque do sócio, categorias, últimos lançamentos | público |
| `/biblioteca` | `BibliotecaView.vue` — catálogo, busca, filtros, paginação | público |
| `/artistas` | `ArtistasView.vue` — vitrine | público |
| `/artistas/:id` | `ArtistProfileView.vue` — perfil público | público |
| `/conteudo/:id` | `ContentDetailView.vue` — detalhe, prévia, comprar | público (compra exige login) |
| `/privacidade` | `PrivacidadeView.vue` — política de privacidade (LGPD, cookies) | público |
| `/login`, `/register`, etc. | views de auth (cartão no `AuthShell.vue`; fundo é o `AppBackdrop` global) | convidado |
| `/dashboard` | **aposentada (2026-07-09)** — redirect para `/perfil`; as entradas viraram o dropdown do usuário no header (`AppLayout.vue`) | — |
| `/compras` | `MinhasComprasView.vue` — histórico + download | logado |
| `/perfil` | `ProfileView.vue` — foto de perfil (trocar/remover) + biografia; para não-artista mostra o convite "Torne-se um artista" (upgrade) | logado |
| `/artista/conteudos` | `ArtistContentsView.vue` — status, motivo de reprovação, Stripe | artista |
| `/contrato` | `ContratoView.vue` — Termos do Artista (markdown + "Li e aceito"; obrigatório p/ publicar) | artista |
| `/artista/publicar` | `ContentUploadView.vue` — ASSISTENTE em 4 passos (1 Detalhes → 2 Conteúdo → 3 Capa e preço → 4 Revisão), com stepper de progresso; upload/edição (`?editar=<id>`) + simulador de repasse + bloqueio sem contrato/Stripe no passo 4 | artista |
| `/artista/stripe` | `ArtistStripeView.vue` — retorno do onboarding | artista |
| `/admin` | `AdminView.vue` — moderação, usuários, compras, subcategorias | admin |

## Troca da home no lançamento (manual, spec §9.1)
Em `src/router/index.ts`: apontar `path: '/'` para `HomeView.vue` e mover/remover a
rota da ComingSoon. Nada mais depende da ComingSoonView.

## Convenções
- Toda chamada HTTP via `src/services/api.ts` (`request`, FormData suportado).
- Papéis no store: `auth.isAdmin` / `auth.isArtist`; guards de rota
  `requiresAuth` / `requiresArtist` / `requiresAdmin`.
- Layout compartilhado: `components/AppLayout.vue` (a ComingSoon NÃO o usa).
  O botão do usuário no header abre um dropdown blocado com Meu Perfil,
  Minhas Compras, Meus Conteúdos (artista) e Sair.
- Aviso de cookies: `components/CookieConsent.vue`, global no App.vue (exceto
  ComingSoon); aceite salvo em `localStorage` (`cantata-cookies-aceitos`) —
  só armazenamento essencial, sem rastreadores.
- `VITE_API_URL` aponta para o backend (default `http://localhost:3000`).
