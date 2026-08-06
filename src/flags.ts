/**
 * Chaves de produto — o que está aberto ao público neste momento.
 *
 * Ficam aqui, num lugar só, para não virarem `v-if` espalhados que ninguém
 * acha quando chega a hora de abrir.
 */

/**
 * O cadastro de novos artistas está aberto?
 *
 * `false` no beta: a plataforma abre com um artista só. Quem JÁ é artista não
 * é afetado — isto governa apenas o convite para virar um.
 *
 * ⚠️ **Existe um par disto no servidor**: a variável `ARTIST_SIGNUP_OPEN` no
 * `.env` do backend, que fecha a rota `POST /artists/upgrade`. Ao abrir, mude
 * nos DOIS. Se só o site abrir, o botão aparece e a rota recusa; se só o
 * servidor abrir, ninguém vê o caminho.
 *
 * O botão desabilitado é o aviso ao visitante. A porta é a rota — esconder
 * controle na tela não fecha nada, porque a API continua alcançável.
 */
export const ARTIST_SIGNUP_OPEN = false

/**
 * A aba "Subcategorias" aparece no painel do admin?
 *
 * `false` no beta (2026-08-05). As subcategorias são as etiquetas de filtro da
 * Biblioteca — instrumento, gênero, dificuldade. O recurso está pronto e
 * testado, mas **nenhuma foi cadastrada**, nem em produção nem em dev.
 *
 * Esconder, e não apagar, foi decisão do Juan: o resultado visível é o mesmo
 * (com zero cadastradas, o filtro da Biblioteca e o campo do formulário de
 * publicar já não renderizam nada), e a única coisa que a aba fazia era ocupar
 * espaço no painel e pedir explicação. Apagar custaria 136 linhas em 11
 * arquivos, incluindo duas tabelas — e filtrar partitura por instrumento e
 * dificuldade é justamente o que um professor procura, então a chance de
 * precisar de volta é alta.
 *
 * Para trazer de volta: `true` aqui. Nada mais precisa mudar — as rotas
 * (`POST/PUT /categories/subcategories`) continuam no ar.
 *
 * A decisão de apagar de vez fica para depois do beta, quando houver catálogo
 * real para dizer se o filtro faz falta.
 */
export const SUBCATEGORIES_ENABLED = false
