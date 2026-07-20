<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import ThemeSwitch from '@/components/ThemeSwitch.vue'
import { lockScroll } from '@/scroll'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// Dropdown do usuário (Perfil / Minhas Compras / Meus Conteúdos / Sair).
const userMenuOpen = ref(false)
const userMenuEl = ref<HTMLElement | null>(null)

// Menu mobile (≤1080px): hambúrguer que expande um painel com TUDO
// (nav + conta) — substitui o menu que quebrava em linhas.
const mobileOpen = ref(false)
const mobileEl = ref<HTMLElement | null>(null)

// Sair pede confirmação inline (dropdown e painel mobile): clicar em
// "Sair" troca o item por "Sair da conta?" + Sair/Cancelar.
const confirmingExit = ref(false)

function closeUserMenu() {
  userMenuOpen.value = false
  confirmingExit.value = false
}

function closeMobile() {
  mobileOpen.value = false
  confirmingExit.value = false
}

// Painel em tela cheia: trava o scroll da página enquanto está aberto
// (overflow + parada do Lenis — ver scroll.ts).
watch(mobileOpen, (open) => lockScroll(open))

// Fecha ao clicar fora do dropdown/painel ou ao apertar Escape.
// POINTERDOWN, não click: um clique num item que se re-renderiza (ex.:
// "Sair" virando a confirmação) chega ao document com o alvo já fora do
// DOM — `contains` falharia e o menu fecharia sozinho.
function onDocPointerDown(e: PointerEvent) {
  const target = e.target as Node
  if (userMenuOpen.value && !userMenuEl.value?.contains(target)) closeUserMenu()
  if (mobileOpen.value && !mobileEl.value?.contains(target)) closeMobile()
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeUserMenu()
    closeMobile()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKey)
})

function logout() {
  closeUserMenu()
  closeMobile()
  auth.logout()
  router.push('/inicio')
}
</script>

<template>
  <div class="layout">
    <!-- Header sem logomarca: um único menu blocado centralizado (nav +
         sessão) e, ao lado, o switch de tema — grupos separados por gap. -->
    <!-- Mobile (≤1080px): botão de menu FLUTUANTE no canto inferior
         direito (zona do polegar) + painel em tela cheia. Mora FORA do
         header: o backdrop-filter dele quebraria o position:fixed. -->
    <!-- Mobile (≤1080px): hambúrguer no canto esquerdo expande o painel
         com nav + conta; o menu desktop some. -->
    <div ref="mobileEl" class="mobile-menu">
      <!-- Barra inferior: o "header" do mobile mora embaixo — tema colado
           à esquerda, botão do menu colado à direita -->
      <div class="mobile-bar">
        <ThemeSwitch class="bar-switch" />
        <button
          type="button"
          class="burger"
        :class="{ open: mobileOpen }"
        :aria-expanded="mobileOpen"
        aria-label="Abrir menu"
        @click="mobileOpen = !mobileOpen"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <template v-if="mobileOpen">
            <path d="M5 5 19 19M19 5 5 19" />
          </template>
          <template v-else>
            <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
          </template>
          </svg>
        </button>
      </div>

      <Transition name="drop">
        <nav v-if="mobileOpen" class="mobile-panel">
          <RouterLink to="/inicio" @click="closeMobile">Início</RouterLink>
          <RouterLink to="/biblioteca" @click="closeMobile">Biblioteca</RouterLink>
          <!-- Vitrine de vários artistas escondida (2026-07-20, ver
               PROGRESS.md) — o link some junto com a rota comentada no router.
          <RouterLink to="/artistas" @click="closeMobile">Artistas</RouterLink>
          -->
          <RouterLink v-if="auth.isAdmin" to="/admin" @click="closeMobile">Admin</RouterLink>

          <template v-if="auth.isAuthenticated">
            <!-- Bloco da conta: avatar + nome como cabeçalho da seção -->
            <p class="panel-user">
              <ArtistAvatar
                :name="auth.user?.name || auth.user?.email || null"
                :avatar-path="auth.user?.avatarPath"
                :size="22"
              />
              <span>{{ auth.user?.name || auth.user?.email }}</span>
            </p>
            <RouterLink to="/perfil" @click="closeMobile">Meu Perfil</RouterLink>
            <RouterLink to="/compras" @click="closeMobile">Minhas Compras</RouterLink>
            <RouterLink v-if="auth.isArtist" to="/artista/conteudos" @click="closeMobile">
              Meus Conteúdos
            </RouterLink>
            <!-- CTA de virar artista comentado (2026-07-20, ver PROGRESS.md)
                 — por ora não convidamos novos artistas a se cadastrar.
            <RouterLink v-else to="/perfil" class="sell-cta" @click="closeMobile">
              Vender no Cantata
            </RouterLink>
            -->


            <template v-if="confirmingExit">
              <p class="exit-question">Sair da conta?</p>
              <button type="button" class="item-btn exit-yes" @click="logout">Sair</button>
              <button type="button" class="item-btn" @click="confirmingExit = false">
                Cancelar
              </button>
            </template>
            <button v-else type="button" class="item-btn exit" @click="confirmingExit = true">
              Sair
            </button>
          </template>
          <template v-else>
            <RouterLink to="/login" @click="closeMobile">Entrar</RouterLink>
            <RouterLink to="/register" class="sell-cta" @click="closeMobile">
              Criar conta
            </RouterLink>
          </template>

        </nav>
      </Transition>
    </div>

    <header class="header">
      <nav class="menu">
        <RouterLink to="/inicio">Início</RouterLink>
        <RouterLink to="/biblioteca">Biblioteca</RouterLink>
        <!-- Vitrine de vários artistas escondida (2026-07-20, ver
             PROGRESS.md) — o link some junto com a rota comentada no router.
        <RouterLink to="/artistas">Artistas</RouterLink>
        -->
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
              <!-- CTA de virar artista comentado (2026-07-20, ver
                   PROGRESS.md) — por ora não convidamos novos artistas.
              <RouterLink
                v-else
                to="/perfil"
                class="sell-cta"
                role="menuitem"
                @click="closeUserMenu"
              >
                Vender no Cantata
              </RouterLink>
              -->

              <template v-if="confirmingExit">
                <p class="exit-question" aria-live="polite">Sair da conta?</p>
                <button type="button" class="item-btn exit-yes" role="menuitem" @click="logout">
                  Sair
                </button>
                <button
                  type="button"
                  class="item-btn"
                  role="menuitem"
                  @click="confirmingExit = false"
                >
                  Cancelar
                </button>
              </template>
              <button
                v-else
                type="button"
                class="item-btn exit"
                role="menuitem"
                @click="confirmingExit = true"
              >
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

      <!-- Switch de tema: colado à direita no desktop; no MOBILE ele mora
           dentro do painel do hambúrguer (header fica só burger + nada). -->
      <ThemeSwitch class="theme-switch" />
    </header>

    <main class="main">
      <slot />
    </main>

    <footer class="footer">
      <p>Cantata — conteúdos musicais de quem cria para quem toca. 🎵</p>
      <nav class="footer-links">
        <!-- CTA de virar artista comentado (2026-07-20, ver PROGRESS.md) —
             por ora não convidamos novos artistas a se cadastrar.
        <RouterLink v-if="!auth.isArtist" to="/perfil" class="footer-link gold">
          Venda suas obras no Cantata
        </RouterLink>
        -->
        <RouterLink to="/privacidade" class="footer-link">Política de Privacidade</RouterLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped lang="scss">
// Curva de easing da marca (mesma da ComingSoonView).
$ease-brand: cubic-bezier(0.22, 1, 0.36, 1);
// Linha padrão do estilo blocado do header.
$line: rgba(var(--fg-rgb), 0.1);

// Entrada/saída dos painéis (dropdown do usuário e menu mobile):
// véu + leve descida (transform/opacity apenas).
.drop-enter-active,
.drop-leave-active {
  transition: opacity 0.35s $ease-brand, transform 0.35s $ease-brand;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

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

    // Convite a vender: dourado, como o CTA de criar conta (guia §4).
    &.dropdown > .sell-cta,
    &.dropdown > .sell-cta:hover {
      color: $gold-strong;
    }

    &.dropdown > .sell-cta:hover {
      background: rgba($color-primary, 0.14);
    }

    // Sair é ação de saída: apagado, sem dourado no ativo.
    .exit {
      color: $text-dim;

      &:hover {
        color: $color-white;
      }
    }

    // Confirmação inline do Sair: pergunta + Sair + Cancelar, cada um em
    // sua LINHA (itens normais do menu — a largura do dropdown não muda).
    .exit-question {
      @include label-type;
      font-size: 0.62rem;
      color: $text-dim;
      padding: 0.7rem 1.3rem 0.35rem;
      border-top: 1px solid $line;
      white-space: nowrap;
    }

    // A pergunta já desenha a linha de cima — o item seguinte não repete.
    .exit-question + .item-btn {
      border-top: none;
    }

    // Regras depois do seletor genérico dos itens: mesma especificidade,
    // ordem no arquivo decide — o vermelho vence no estado normal e no hover.
    &.dropdown > .exit-yes,
    &.dropdown > .exit-yes:hover {
      color: $color-error;
    }

    &.dropdown > .exit-yes:hover {
      background: color-mix(in srgb, $color-error 14%, rgb(var(--bg-rgb)));
    }
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

// Switch de tema (componente ThemeSwitch): aqui só o posicionamento —
// COLADO na borda direita da barra (absolute right:0 — ignora o padding
// do header; altura total; sem borda no lado do encosto).
// Só o switch DO HEADER (o do painel mobile fica na linha "Tema").
.header > .theme-switch {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  border-left: 1px solid $line;
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

.footer-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.footer-link {
  display: inline-block;
  font-size: 0.8rem;
  color: $text-dim;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $gold-text;
  }

  &.gold {
    color: $gold-text;

    &:hover {
      color: $color-white;
    }
  }
}

// ---- Menu mobile (hambúrguer + painel expansível) ----------------------------
// Desktop: invisível. ≤1080px: o hambúrguer fica COLADO na borda esquerda
// (espelho do switch de tema à direita) e expande o painel com nav + conta.
.mobile-menu {
  display: none;
}

// Barra inferior do mobile: o header de baixo — vidro com linha superior,
// largura total, com o botão do menu colado no canto direito.
.mobile-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(var(--bg-rgb), 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid $line;
}

// Switch de tema na barra: colado no canto ESQUERDO (espelho do botão).
.bar-switch {
  position: absolute;
  left: 0;
  top: 0;
  height: 56px;
  border-right: 1px solid $line;
}

.burger {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-left: 1px solid $line;
  color: rgba(var(--fg-rgb), 0.6);
  cursor: pointer;
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
  }

  &.open {
    color: $gold-text;
    background: rgba(var(--fg-rgb), 0.08);
  }
}

// Painel expansível: colado sob o header, largura total, itens blocados
// empilhados (mesma gramática do dropdown do usuário).
.mobile-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  // Vai do TOPO até a barra inferior (o header do topo some no mobile).
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  z-index: 55; // abaixo da barra/botão (60)
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: rgb(var(--bg-rgb));

  > a,
  > .item-btn {
    @include block-item;
    height: 50px;
    justify-content: flex-start;
    padding: 0 1.5rem;
    border-top: 1px solid $line;

    &.router-link-active {
      color: $gold-text;
      background: rgba(var(--fg-rgb), 0.05);
    }
  }

  // Cabeçalho da seção da conta: avatar + nome (dado, sem uppercase).
  .panel-user {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1.5rem 0.5rem;
    border-top: 1px solid $line;
    color: $gold-text;
    font-size: 0.85rem;
  }

  .panel-user + a {
    border-top: none;
  }

  .exit-question {
    @include label-type;
    font-size: 0.62rem;
    color: $text-dim;
    padding: 0.8rem 1.5rem 0.35rem;
    border-top: 1px solid $line;
  }

  .exit-question + .item-btn {
    border-top: none;
  }

  // Mesmo jogo de especificidade do dropdown: regras depois do genérico.
  &.mobile-panel > .sell-cta,
  &.mobile-panel > .sell-cta:hover {
    color: $gold-strong;
  }

  &.mobile-panel > .sell-cta:hover {
    background: rgba($color-primary, 0.14);
  }

  &.mobile-panel > .exit,
  &.mobile-panel > .exit:hover {
    color: $text-dim;
  }

  &.mobile-panel > .exit:hover {
    color: $color-white;
  }

  &.mobile-panel > .exit-yes,
  &.mobile-panel > .exit-yes:hover {
    color: $color-error;
  }

  &.mobile-panel > .exit-yes:hover {
    background: color-mix(in srgb, $color-error 14%, rgb(var(--bg-rgb)));
  }

}

// Em telas menores: some o menu desktop (e o dropdown), entra o hambúrguer.
// O header mantém 64px; o switch segue colado à direita.
@media (max-width: 1080px) {
  // O header do topo some — o "header" do mobile é a barra inferior.
  .header {
    display: none;
  }

  .mobile-menu {
    display: block;
  }

  // Respiro no fim da página (altura do header): o botão flutuante não
  // fica na frente do conteúdo quando o scroll chega ao final.
  .footer {
    padding-bottom: calc(1.5rem + 64px);
  }
}
</style>
