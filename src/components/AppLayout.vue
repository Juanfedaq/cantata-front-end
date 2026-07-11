<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

// Dropdown do usuário (Perfil / Minhas Compras / Meus Conteúdos / Sair).
const userMenuOpen = ref(false)
const userMenuEl = ref<HTMLElement | null>(null)

function closeUserMenu() {
  userMenuOpen.value = false
}

// Fecha ao clicar fora do dropdown ou ao apertar Escape.
function onDocClick(e: MouseEvent) {
  if (userMenuOpen.value && !userMenuEl.value?.contains(e.target as Node)) closeUserMenu()
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeUserMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})

function logout() {
  closeUserMenu()
  auth.logout()
  router.push('/inicio')
}
</script>

<template>
  <div class="layout">
    <!-- Header sem logomarca: um único menu blocado centralizado (nav +
         sessão) e, ao lado, o switch de tema — grupos separados por gap. -->
    <header class="header">
      <nav class="menu">
        <RouterLink to="/inicio">Início</RouterLink>
        <RouterLink to="/biblioteca">Biblioteca</RouterLink>
        <RouterLink to="/artistas">Artistas</RouterLink>
        <RouterLink v-if="auth.isAdmin" to="/admin">Admin</RouterLink>

        <!-- Botão do usuário: foto (ou inicial colorida) + nome. Abre o
             dropdown com as páginas da conta — o antigo dashboard virou isto. -->
        <div v-if="auth.isAuthenticated" ref="userMenuEl" class="user-menu">
          <button
            type="button"
            class="item-btn user"
            :class="{ open: userMenuOpen }"
            aria-haspopup="menu"
            :aria-expanded="userMenuOpen"
            @click="userMenuOpen = !userMenuOpen"
          >
            <ArtistAvatar
              :name="auth.user?.name || auth.user?.email || null"
              :avatar-path="auth.user?.avatarPath"
              :size="26"
            />
            <span>{{ auth.user?.name || auth.user?.email }}</span>
            <svg
              class="caret"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M1.5 3.5 5 7l3.5-3.5" />
            </svg>
          </button>

          <Transition name="drop">
            <div v-if="userMenuOpen" class="dropdown" role="menu">
              <RouterLink to="/perfil" role="menuitem" @click="closeUserMenu">Meu Perfil</RouterLink>
              <RouterLink to="/compras" role="menuitem" @click="closeUserMenu">
                Minhas Compras
              </RouterLink>
              <RouterLink
                v-if="auth.isArtist"
                to="/artista/conteudos"
                role="menuitem"
                @click="closeUserMenu"
              >
                Meus Conteúdos
              </RouterLink>
              <button type="button" class="item-btn exit" role="menuitem" @click="logout">
                Sair
              </button>
            </div>
          </Transition>
        </div>
        <template v-else>
          <RouterLink to="/login">Entrar</RouterLink>
          <RouterLink to="/register" class="cta">Criar conta</RouterLink>
        </template>
      </nav>

      <!-- Switch de tema blocado: duas células (lua | sol) e um indicador
           que desliza no easing da marca. Ícones da ComingSoonView. -->
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
    </header>

    <main class="main">
      <slot />
    </main>

    <footer class="footer">
      <p>Cantata — conteúdos musicais de quem cria para quem toca. 🎵</p>
      <RouterLink to="/privacidade" class="footer-link">Política de Privacidade</RouterLink>
    </footer>
  </div>
</template>

<style scoped lang="scss">
// Curva de easing da marca (mesma da ComingSoonView).
$ease-brand: cubic-bezier(0.22, 1, 0.36, 1);
// Linha padrão do estilo blocado do header.
$line: rgba(var(--fg-rgb), 0.1);

// Item blocado: base compartilhada por links e botões das três zonas.
// Hover: luz dourada que sobe da base (mixin global hover-light, guia §4).
@mixin block-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 1.3rem;
  height: 100%;
  color: rgba(var(--fg-rgb), 0.55);
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  white-space: nowrap;
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;
  @include hover-light;

  &:hover {
    color: $color-white;
  }
}

// Sem background próprio: a cor vem do body e o fundo global de anéis
// (AppBackdrop, no App.vue) fica visível atrás do conteúdo.
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

// Header blocado, sem logomarca: menu único centralizado + switch de tema
// ao lado; gap apenas entre os dois grupos (guia §3.3).
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 1.5rem;
  height: 64px;
  padding: 0 1.5rem;
  background: rgba(var(--bg-rgb), 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid $line;
}

// Menu único (nav + sessão): grupo emoldurado, itens colados separados
// por bordas de 1px; só bordas verticais — o header delimita em cima
// e embaixo (guia §3.4).
.menu {
  display: flex;
  border-left: 1px solid $line;
  border-right: 1px solid $line;

  > a,
  > .item-btn,
  > .user-menu > .user {
    @include block-item;
    border-right: 1px solid $line;

    &:last-child {
      border-right: none;
    }

    &.router-link-active {
      color: $gold-text;
      background: rgba(var(--fg-rgb), 0.05);
    }
  }

  > .user-menu:last-child > .user {
    border-right: none;
  }

  // Nome do usuário é dado, não rótulo: sem uppercase (guia §5).
  // Avatar (foto ou inicial colorida) acompanha o nome.
  .user {
    gap: 0.6rem;
    color: $gold-text;
    text-transform: none;
    letter-spacing: 0.02em;
    font-size: 0.85rem;

    // Seta do dropdown: gira quando aberto, no easing da marca.
    .caret {
      transition: transform 0.5s $ease-brand;
    }

    &.open {
      background: rgba(var(--fg-rgb), 0.05);

      .caret {
        transform: rotate(180deg);
      }
    }
  }

  // Âncora do dropdown: ocupa a célula do menu e posiciona o painel.
  .user-menu {
    position: relative;
    display: flex;
    align-items: stretch;
  }

  // Painel blocado (guia §3): moldura de 1px, itens colados separados por
  // linha, fundo OPACO (sem o vidro translúcido — o conteúdo da página
  // não atravessa o painel). Alinhado à borda direita do botão.
  .dropdown {
    position: absolute;
    top: 100%;
    right: -1px;
    min-width: calc(100% + 2px);
    display: flex;
    flex-direction: column;
    border: 1px solid $line;
    background: rgb(var(--bg-rgb));

    > a,
    > .item-btn {
      @include block-item;
      height: 46px;
      justify-content: flex-start;
      border-top: 1px solid $line;

      &:first-child {
        border-top: none;
      }

      &.router-link-active {
        color: $gold-text;
        background: rgba(var(--fg-rgb), 0.05);
      }
    }

    // Sair é ação de saída: apagado, sem dourado no ativo.
    .exit {
      color: $text-dim;

      &:hover {
        color: $color-white;
      }
    }
  }

  // Entrada/saída do painel: véu + leve descida (transform/opacity apenas).
  .drop-enter-active,
  .drop-leave-active {
    transition: opacity 0.35s $ease-brand, transform 0.35s $ease-brand;
  }

  .drop-enter-from,
  .drop-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }

  .cta {
    color: $gold-strong;
    font-weight: 600;
    background: rgba($color-primary, 0.1);

    &:hover {
      color: $color-white;
      background: rgba($color-primary, 0.22);
    }
  }
}

.item-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

// Switch de tema blocado: duas células (lua | sol) emolduradas, indicador
// que desliza para a célula ativa com o easing da marca — preenchimento
// ativo + linha dourada na base (mesma gramática de item ativo do guia §4).
// COLADO na borda direita da barra (absolute right:0 — ignora o padding
// do header; altura total; sem borda no lado do encosto).
.theme-switch {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: stretch;
  padding: 0;
  background: none;
  border: none;
  border-left: 1px solid $line;
  cursor: pointer;

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

  &:hover .cell:not(.active) {
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

  &.light .knob {
    transform: translateX(100%);
  }
}

.main {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid $line;
  color: rgba(var(--fg-rgb), 0.4);
  font-size: 0.85rem;
  text-align: center;
}

.footer-link {
  display: inline-block;
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: $text-dim;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $gold-text;
  }
}

// Em telas menores o menu quebra em linhas, ainda centralizado e blocado;
// o switch segue colado à direita (altura total do header) e o padding
// direito reserva o espaço dele para o menu não passar por baixo.
@media (max-width: 1080px) {
  .header {
    height: auto;
    padding: 0.6rem 96px 0.6rem 1rem;
    gap: 0.75rem;
    align-items: center;
  }

  .menu {
    flex-wrap: wrap;
    justify-content: center;

    > a,
    > .item-btn,
    > .user-menu > .user {
      height: 42px;
      padding: 0 0.9rem;
    }
  }
}
</style>
