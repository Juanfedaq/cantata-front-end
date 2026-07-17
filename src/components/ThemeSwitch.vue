<script setup lang="ts">
// Switch de tema blocado: duas células (lua | sol) e um indicador que
// desliza no easing da marca (ícones da ComingSoonView). O POSICIONAMENTO
// fica por conta de quem usa (header: colado à direita; painel mobile:
// linha do rodapé) — aqui mora só o desenho e o comportamento.
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<template>
  <button
    type="button"
    class="theme-switch"
    :class="{ light: !theme.isDark }"
    role="switch"
    :aria-checked="!theme.isDark"
    :aria-label="theme.isDark ? 'Ativar tema claro' : 'Ativar tema escuro'"
    @click="theme.toggle()"
  >
    <span class="knob" aria-hidden="true"></span>
    <span class="cell" :class="{ active: theme.isDark }" aria-hidden="true">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <path d="M20 13.2A8.1 8.1 0 0 1 10.8 4a7.5 7.5 0 1 0 9.2 9.2Z" />
      </svg>
    </span>
    <span class="cell" :class="{ active: !theme.isDark }" aria-hidden="true">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      >
        <circle cx="12" cy="12" r="4.5" />
        <path
          d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"
        />
      </svg>
    </span>
  </button>
</template>

<style scoped lang="scss">
$ease-brand: cubic-bezier(0.22, 1, 0.36, 1);

.theme-switch {
  position: relative;
  display: flex;
  align-items: stretch;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}

.cell {
  position: relative; // acima do indicador
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  color: rgba(var(--fg-rgb), 0.45);
  transition: color 0.5s $ease-brand;

  svg {
    display: block;
  }

  &.active {
    color: $gold-text;
  }
}

.theme-switch:hover .cell:not(.active) {
  color: $color-white;
}

// Indicador: metade do trilho, desliza dark (esquerda) ⇄ light (direita).
.knob {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50%;
  background: rgba(var(--fg-rgb), 0.05);
  border-bottom: 1px solid $gold-text;
  transition: transform 0.5s $ease-brand;
}

.theme-switch.light .knob {
  transform: translateX(100%);
}
</style>
