<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { contentsApi, artistsApi, fileUrl, formatPrice, type MyContent } from '@/services/api'

// Destino do card: obra publicada abre a página pública; rascunho e
// reprovado abrem a edição (ajustar e reenviar).
function cardTo(c: MyContent) {
  return c.status === 'aprovado' ? `/conteudo/${c.id}` : `/artista/publicar?editar=${c.id}`
}

// Entrada dos cards em CSS puro (véu + subida com stagger, keyframes no
// <style>). Aqui NÃO usamos motion-v de propósito (2026-07-15): esta tela
// muda estado nos cards (ocultar/excluir) e o motion reaplicava o estado
// inicial (opacity 0) a cada patch, sumindo com os cards — animação CSS
// roda uma vez na inserção do nó e patches não a reiniciam.

const contents = ref<MyContent[]>([])
const loading = ref(true)
const error = ref('')
const stripeStatus = ref<'carregando' | 'completo' | 'pendente' | 'indisponivel'>('carregando')
const stripeLoading = ref(false)

const STATUS_LABELS: Record<MyContent['status'], string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aprovado: 'Publicado',
  reprovado: 'Reprovado',
}

onMounted(async () => {
  try {
    contents.value = (await contentsApi.mine()).contents
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao listar seus conteúdos.'
  } finally {
    loading.value = false
  }

  try {
    const status = await artistsApi.stripeStatus()
    stripeStatus.value = status.onboardingComplete ? 'completo' : 'pendente'
  } catch {
    stripeStatus.value = 'indisponivel'
  }
})

async function startOnboarding() {
  stripeLoading.value = true
  try {
    const { url } = await artistsApi.stripeOnboarding()
    window.location.href = url
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao iniciar o onboarding.'
    stripeLoading.value = false
  }
}

// ---- Confirmação DENTRO do card (sem confirm() do navegador) ----
// Excluir (rascunho/reprovado) e ocultar (publicada) confirmam no card;
// REEXIBIR é imediato — voltar à vitrine não tem consequência.
const confirming = ref<{ id: number; action: 'excluir' | 'ocultar' } | null>(null)
const busyId = ref<number | null>(null)

async function remove(content: MyContent) {
  busyId.value = content.id
  try {
    await contentsApi.remove(content.id)
    contents.value = contents.value.filter((c) => c.id !== content.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao excluir.'
  } finally {
    busyId.value = null
    confirming.value = null
  }
}

// ---- Ocultar/reexibir obra publicada (compradores mantêm acesso) ----
async function toggleHidden(content: MyContent) {
  busyId.value = content.id
  error.value = ''
  try {
    const { hidden } = await contentsApi.setHidden(content.id, !content.hidden)
    content.hidden = hidden
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao alterar a visibilidade.'
  } finally {
    busyId.value = null
    confirming.value = null
  }
}

// Olho: oculto → reexibe direto; visível → pede confirmação no card.
function onEyeClick(content: MyContent) {
  if (content.hidden) toggleHidden(content)
  else confirming.value = { id: content.id, action: 'ocultar' }
}

function confirmAction(content: MyContent) {
  if (!confirming.value) return
  if (confirming.value.action === 'excluir') remove(content)
  else toggleHidden(content)
}

// A foto de perfil (e a bio) agora são editadas em Meu Perfil (/perfil).
</script>

<template>
  <AppLayout>
    <div class="head">
      <h1 class="page-title">Meus Conteúdos</h1>
      <RouterLink to="/artista/publicar" class="new-btn">+ Publicar conteúdo</RouterLink>
    </div>

    <!-- Aviso do Stripe: sem onboarding completo, as vendas ficam bloqueadas -->
    <div v-if="stripeStatus === 'pendente' || stripeStatus === 'indisponivel'" class="stripe-warn">
      <p v-if="stripeStatus === 'pendente'">
        ⚠️ Complete o cadastro de recebimentos (Stripe) para que seus conteúdos possam ser vendidos.
      </p>
      <p v-else>⚠️ Não foi possível verificar seu cadastro de recebimentos agora.</p>
      <button class="stripe-btn" :disabled="stripeLoading" @click="startOnboarding">
        {{ stripeLoading ? 'Redirecionando…' : 'Configurar recebimentos' }}
      </button>
    </div>
    <p v-else-if="stripeStatus === 'completo'" class="stripe-ok">✅ Recebimentos habilitados via Stripe.</p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="!contents.length" class="muted">Você ainda não enviou nenhum conteúdo.</p>

    <!-- Grid de cards no mesmo desenho da Biblioteca (ContentCard), com o
         badge de status sobre a capa e as ações num rodapé blocado. -->
    <div v-if="contents.length" class="grid">
      <RouterLink
        v-for="(c, i) in contents"
        :key="c.id"
        :to="cardTo(c)"
        class="card"
        :style="{ '--rise-delay': `${i * 0.06}s` }"
      >
          <div class="cover" :class="{ dimmed: c.hidden }">
            <img v-if="c.coverPath" :src="fileUrl(c.coverPath) ?? undefined" :alt="c.title" />
            <span v-else class="cover-placeholder">🎵</span>
            <span class="badge" :class="c.status">{{ STATUS_LABELS[c.status] }}</span>
            <span v-if="c.hidden" class="badge hidden-badge">Oculta</span>

            <!-- Publicada: ocultar (confirma no card) / reexibir (direto).
                 Rascunho/reprovado: excluir (confirma no card). Nenhum navega. -->
            <button
              v-if="c.status === 'aprovado'"
              type="button"
              class="corner-btn"
              :disabled="busyId === c.id"
              :aria-label="c.hidden ? `Mostrar ${c.title} na biblioteca` : `Ocultar ${c.title} da biblioteca`"
              :title="c.hidden ? 'Mostrar na biblioteca' : 'Ocultar da biblioteca'"
              @click.prevent.stop="onEyeClick(c)"
            >
              <!-- olho / olho cortado -->
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.6" />
                <path v-if="c.hidden" d="M4 20 20 4" />
              </svg>
            </button>
            <button
              v-else
              type="button"
              class="corner-btn danger"
              :aria-label="`Excluir ${c.title}`"
              title="Excluir"
              @click.prevent.stop="confirming = { id: c.id, action: 'excluir' }"
            >
              ✕
            </button>

            <!-- Confirmação (excluir/ocultar) dentro do próprio card -->
            <Transition name="confirm">
              <div
                v-if="confirming?.id === c.id"
                class="confirm"
                role="alertdialog"
                :aria-label="`Confirmar ação em ${c.title}`"
                @click.prevent.stop
              >
                <p class="confirm-text">
                  {{ confirming.action === 'excluir' ? 'Excluir esta obra?' : 'Ocultar da biblioteca?' }}
                </p>
                <p v-if="confirming.action === 'ocultar'" class="confirm-hint">
                  Quem já comprou continua com acesso.
                </p>
                <div class="confirm-actions">
                  <button
                    type="button"
                    class="confirm-btn"
                    :class="{ danger: confirming.action === 'excluir' }"
                    :disabled="busyId === c.id"
                    @click.prevent.stop="confirmAction(c)"
                  >
                    {{
                      confirming.action === 'excluir'
                        ? busyId === c.id ? 'Excluindo…' : 'Excluir'
                        : busyId === c.id ? 'Ocultando…' : 'Ocultar'
                    }}
                  </button>
                  <button
                    type="button"
                    class="confirm-btn"
                    :disabled="busyId === c.id"
                    @click.prevent.stop="confirming = null"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <div class="body">
            <span class="tags">
              <span
                v-for="cat in c.categories"
                :key="cat.slug"
                class="category"
                :class="cat.slug"
                role="img"
                :aria-label="cat.name"
                :title="cat.name"
              >
                <CategoryIcon :slug="cat.slug" :size="18" />
              </span>
            </span>
            <h3 class="title">{{ c.title }}</h3>
            <p class="price">{{ formatPrice(c.priceCents) }}</p>
            <!-- Resumo de vendas (só faz sentido em obra publicada) -->
            <p v-if="c.status === 'aprovado'" class="sales">
              <template v-if="c.salesCount">
                {{ c.salesCount }} {{ c.salesCount === 1 ? 'venda' : 'vendas' }} ·
                {{ formatPrice(c.salesNetCents) }} líquido
              </template>
              <template v-else>Nenhuma venda ainda</template>
            </p>
            <p v-if="c.status === 'reprovado' && c.rejectionReason" class="reason">
              Motivo: {{ c.rejectionReason }}
            </p>
          </div>
      </RouterLink>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
}

.new-btn {
  @include block-button-primary;
  padding: 0.6rem 1.4rem;
}

// Aviso solto na página: moldura completa, sem radius (guia §3);
// borda na cor funcional de erro (exceção prevista no guia §8).
.stripe-warn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
  border: 1px solid rgba($color-error, 0.4);
  margin-bottom: 1.5rem;
  color: rgba(var(--fg-rgb), 0.85);
}

.stripe-btn {
  @include block-button-primary;
  padding: 0.6rem 1.2rem;
}

.stripe-ok {
  color: $color-success;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

// Grid idêntico ao da Biblioteca (guia §6).
.grid {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

// Card no desenho do ContentCard: moldura 1px, sem radius, fundo opaco
// (o backdrop de anéis não atravessa), hover só com preenchimento +
// título dourado. Aqui ganha o badge de status na capa e um rodapé
// blocado de ações.
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid $line;
  overflow: hidden;
  color: $color-white;
  text-decoration: none;
  background: $color-back;
  transition: background-color 0.5s $ease-brand;
  // Entrada: véu + subida com stagger (--rise-delay por índice, no template).
  animation: card-rise 0.7s $ease-brand both;
  animation-delay: var(--rise-delay, 0s);

  &:hover {
    background: $fill-hover-solid;

    .title {
      color: $gold-text;
    }

    .corner-btn {
      opacity: 1;
    }
  }
}

.cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: rgba(var(--fg-rgb), 0.06);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.cover-placeholder {
  font-size: 2.5rem;
  opacity: 0.4;
}

// Badge blocado sobre a capa: fundo OPACO (mistura com o fundo do tema)
// para ler bem em cima da foto; cores funcionais por status — "em revisão"
// no dourado da paleta (guia §5/§8).
.badge {
  @include label-type;
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;

  &.rascunho {
    background: color-mix(in srgb, rgb(var(--fg-rgb)) 12%, rgb(var(--bg-rgb)));
    color: rgba(var(--fg-rgb), 0.8);
  }
  &.em_revisao {
    background: color-mix(in srgb, $color-primary 22%, rgb(var(--bg-rgb)));
    color: $gold-text;
  }
  &.aprovado {
    background: color-mix(in srgb, $color-success 20%, rgb(var(--bg-rgb)));
    color: $color-success;
  }
  &.reprovado {
    background: color-mix(in srgb, $color-error 20%, rgb(var(--bg-rgb)));
    color: $color-error;
  }
}

.body {
  flex: 1;
  padding: 0.9rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

// Ícones das categorias do pacote na tinta de cada uma (guia §5.1).
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.category {
  display: inline-flex;
  color: hsl(var(--cat-hue, 45), 45%, var(--cat-tag-l, 64%));

  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }
}

.title {
  font-family: $font-display;
  font-size: 1.05rem;
  font-weight: 600;
  transition: color 0.5s $ease-brand;
}

// Preço é dado, não rótulo: sem uppercase (guia §5).
.price {
  margin-top: 0.35rem;
  font-weight: 600;
}

// Resumo de vendas: dado acompanhando o preço — apagado, sem uppercase (guia §5).
.sales {
  font-size: 0.82rem;
  color: $text-dim;
}

.reason {
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: $color-error;
}

// Obra oculta: capa apagada (só a capa — o corpo do card segue legível).
.cover.dimmed {
  img,
  .cover-placeholder {
    opacity: 0.35;
    filter: grayscale(0.6);
    transition: opacity 0.5s $ease-brand, filter 0.5s $ease-brand;
  }
}

// Badge extra de obra oculta, ao lado do badge de status.
.hidden-badge {
  left: auto;
  right: 0.6rem;
  top: auto;
  bottom: 0.6rem;
  background: color-mix(in srgb, rgb(var(--fg-rgb)) 14%, rgb(var(--bg-rgb)));
  color: rgba(var(--fg-rgb), 0.75);
}

// Ação no canto da capa (ocultar/reexibir ou excluir): bloco quadrado
// opaco sobre a foto; discreto até o hover do card. Não navega.
.corner-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--fg-rgb), 0.3);
  background: color-mix(in srgb, rgb(var(--fg-rgb)) 6%, rgb(var(--bg-rgb)));
  color: rgba(var(--fg-rgb), 0.8);
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.5s $ease-brand, background-color 0.5s $ease-brand,
    color 0.5s $ease-brand;

  &:hover,
  &:focus-visible {
    background: color-mix(in srgb, rgb(var(--fg-rgb)) 14%, rgb(var(--bg-rgb)));
    color: $color-white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &.danger {
    border-color: rgba($color-error, 0.4);
    color: $color-error;

    &:hover,
    &:focus-visible {
      background: color-mix(in srgb, $color-error 18%, rgb(var(--bg-rgb)));
      color: $color-error;
    }
  }

  // Teclado/touch: sempre visível quando focado (e em telas sem hover).
  &:focus-visible {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
}

// Confirmação de exclusão dentro do card: véu opaco sobre a capa, no
// estilo blocado (moldura fica por conta do próprio card).
.confirm {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 1rem;
  background: color-mix(in srgb, rgb(var(--fg-rgb)) 4%, rgb(var(--bg-rgb)));
  cursor: default;
}

.confirm-text {
  font-family: $font-display;
  font-size: 1rem;
}

// Nota curta sob a pergunta (ex.: compradores mantêm acesso ao ocultar).
.confirm-hint {
  margin-top: -0.5rem;
  font-size: 0.75rem;
  color: $text-dim;
  text-align: center;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

.confirm-btn {
  @include block-button;
  padding: 0.45rem 1.1rem;
  font-size: 0.72rem;

  &.danger {
    color: $color-error;
    border-color: rgba($color-error, 0.4);

    &:hover {
      background: color-mix(in srgb, $color-error 14%, rgb(var(--bg-rgb)));
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

// Entrada/saída da confirmação: só véu (transform/opacity, easing da marca).
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.35s $ease-brand;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

@keyframes card-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
  }
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
  margin-bottom: 1rem;
}
</style>
