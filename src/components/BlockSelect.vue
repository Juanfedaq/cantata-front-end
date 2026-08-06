<script setup lang="ts" generic="T extends string | number | null">
/**
 * Dropdown blocado — o "select" da plataforma.
 *
 * O `<select>` nativo não aceita estilo no painel de opções: o sistema
 * operacional desenha aquela lista, e ela destoa de tudo (cantos arredondados,
 * fonte do sistema, azul do Windows). Este componente troca o painel por um
 * blocado nosso, mantendo o comportamento de teclado e leitor de tela.
 *
 * Nasceu da linha de filtros da Biblioteca ("Ordenar por…" e "Tema…"), onde o
 * padrão foi desenhado. Virou componente em 2026-08-05, ao chegar a vez do
 * painel do admin: copiar pela terceira vez garantiria três versões
 * divergindo com o tempo.
 *
 * Duas decisões herdadas de lá, e o porquê:
 *
 * - **Largura fixa.** Todos os rótulos possíveis são renderizados invisíveis
 *   na mesma célula de grid do rótulo atual, então o botão fica sempre com a
 *   largura do MAIOR. Sem isso, escolher uma opção mais curta encolhe o botão
 *   e empurra os vizinhos da linha — a barra de filtros "pula" a cada clique.
 * - **Fecha no `pointerdown`, não no `click`.** Um item que se re-renderiza no
 *   clique chega ao `document` com o alvo já fora do DOM, e o `contains`
 *   falharia — o painel fecharia sozinho em situações erradas.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface BlockSelectOption<V> {
  value: V
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: T
    options: BlockSelectOption<T>[]
    /** Rótulo quando nada está escolhido. Some se toda opção tiver valor. */
    placeholder?: string
    /** Descrição para leitor de tela (o botão não tem <label> associado). */
    ariaLabel?: string
    /** Destaca o botão em dourado quando há escolha — usado nos filtros. */
    highlightWhenSet?: boolean
    /**
     * Valor que significa "nada escolhido".
     *
     * Existe para o caso do filtro de tema: a LISTA traz "Todos os temas",
     * mas o BOTÃO precisa continuar dizendo "Tema…" — a opção existe para
     * desfazer a escolha, não para virar rótulo. Sem isto, escolher "todos"
     * deixaria o filtro parecendo aplicado (rótulo diferente e destaque
     * dourado) quando ele acabou de ser limpo.
     */
    emptyValue?: T
  }>(),
  { placeholder: '', ariaLabel: '', highlightWhenSet: false, emptyValue: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [T] }>()

const open = ref(false)
const raiz = ref<HTMLElement | null>(null)

/** Está no estado "nada escolhido"? */
const vazio = computed(
  () => props.modelValue === props.emptyValue || props.modelValue === undefined,
)

const selecionada = computed(() =>
  vazio.value ? undefined : props.options.find((o) => o.value === props.modelValue),
)
const rotulo = computed(() => selecionada.value?.label ?? props.placeholder)

/**
 * Rótulos que o BOTÃO pode exibir — os "fantasmas" que fixam a largura.
 * A opção "vazia" fica de fora: ela nunca aparece no botão (vira o
 * placeholder), então reservar a largura dela alargaria o controle à toa.
 */
const rotulos = computed(() => {
  const doMenu = props.options
    .filter((o) => o.value !== props.emptyValue)
    .map((o) => o.label)
  return props.placeholder ? [props.placeholder, ...doMenu] : doMenu
})

const destacado = computed(() => props.highlightWhenSet && !vazio.value)

function escolher(value: T) {
  emit('update:modelValue', value)
  open.value = false
}

function onPointerDown(e: PointerEvent) {
  if (open.value && !raiz.value?.contains(e.target as Node)) open.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="raiz" class="bs">
    <button
      type="button"
      class="bs-btn"
      :class="{ active: destacado }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="ariaLabel || undefined"
      @click="open = !open"
    >
      <span class="bs-label">
        <span v-for="l in rotulos" :key="l" class="bs-ghost" aria-hidden="true">{{ l }}</span>
        <span class="bs-current">{{ rotulo }}</span>
      </span>
      <svg
        class="bs-arrow"
        :class="{ open }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <Transition name="drop">
      <ul v-if="open" class="bs-menu" role="listbox" :aria-label="ariaLabel || undefined">
        <li v-for="opt in options" :key="String(opt.value)">
          <button
            type="button"
            class="bs-item"
            :class="{ selected: opt.value === modelValue }"
            role="option"
            :aria-selected="opt.value === modelValue"
            @click="escolher(opt.value)"
          >
            {{ opt.label }}
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.bs {
  position: relative;
  display: inline-flex;
}

.bs-btn {
  @include label-type;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 0.5rem;
  white-space: nowrap;
  padding: 0.55rem 1.1rem;
  border: 1px solid $line;
  border-radius: 0;
  background: $color-back;
  color: $text-secondary;
  cursor: pointer;
  transition:
    color 0.5s $ease-brand,
    background-color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
    background: $fill-hover-solid;
  }

  &.active {
    color: $gold-text;
    background: $fill-active-solid;
  }
}

// Largura fixa: fantasmas e rótulo atual dividem a mesma célula de grid.
.bs-label {
  display: grid;
  justify-items: center;
}

.bs-ghost,
.bs-current {
  grid-area: 1 / 1;
  white-space: nowrap;
}

.bs-ghost {
  visibility: hidden;
}

.bs-arrow {
  flex-shrink: 0;
  transition: transform 0.5s $ease-brand;

  &.open {
    transform: rotate(180deg);
  }
}

// Painel: moldura de 1px, itens colados por linha, fundo OPACO (o backdrop de
// anéis não pode atravessar).
.bs-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 5;
  min-width: 100%;
  margin-top: -1px;
  list-style: none;
  padding: 0;
  border: 1px solid $line;
  background: $color-back;

  li + li {
    border-top: 1px solid $line;
  }
}

.bs-item {
  @include label-type;
  display: block;
  width: 100%;
  padding: 0.6rem 1.1rem;
  border: none;
  background: none;
  color: $text-secondary;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.5s $ease-brand,
    background-color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
    background: $fill-hover-solid;
  }

  &.selected {
    color: $gold-text;
    background: $fill-active-solid;
  }
}

.drop-enter-active,
.drop-leave-active {
  transition:
    opacity 0.35s $ease-brand,
    transform 0.35s $ease-brand;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .bs-btn,
  .bs-arrow,
  .bs-item,
  .drop-enter-active,
  .drop-leave-active {
    transition: none;
  }
}
</style>
