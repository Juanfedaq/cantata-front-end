<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Scroll reveal (progressive enhancement: sem JS ou com
// prefers-reduced-motion, o conteúdo permanece visível).
const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!('IntersectionObserver' in window)) return

  const els = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-reveal]') ?? [])

  for (const el of els) {
    el.style.opacity = '0'
    el.style.transform = 'translateY(26px)'
    el.style.transition =
      'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)'
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        const siblings = Array.from(el.parentElement?.children ?? []).filter((c) =>
          c.hasAttribute('data-reveal'),
        )
        el.style.transitionDelay = `${Math.max(0, siblings.indexOf(el)) * 0.12}s`
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
        observer?.unobserve(el)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  )

  for (const el of els) observer.observe(el)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="root" class="landing">
    <!-- glows ambientes -->
    <div class="glow glow--top" aria-hidden="true"></div>
    <div class="glow glow--right" aria-hidden="true"></div>

    <!-- ===================== HERO ===================== -->
    <header class="hero">
      <div class="topbar">
        <div class="topbar__inner">
          <img src="/icon.svg" alt="Cantata" class="topbar__logo" />
          <span class="badge">
            <span class="badge__dot"></span>
            Em breve
          </span>
        </div>
      </div>

      <div class="hero__body">
        <div class="hero__logo-frame">
          <img src="/logo.svg" alt="Cantata" class="hero__logo" />
        </div>

        <h1 class="hero__title">Onde toda música encontra sua <em>voz</em></h1>

        <p class="hero__lead">
          O Cantata é um marketplace de partituras que conecta compositores, maestros e músicos —
          um lugar para publicar, descobrir e adquirir música escrita.
        </p>
      </div>

      <div class="hero__spacer"></div>
    </header>

    <!-- ===================== O QUE É ===================== -->
    <section id="o-que-e" class="section">
      <div class="about">
        <div class="eyebrow" data-reveal>
          <span class="eyebrow__dash"></span>
          <span class="eyebrow__label">O que é</span>
        </div>
        <div>
          <h2 class="section__title" data-reveal>Um marketplace dedicado à música escrita.</h2>
          <p class="about__text" data-reveal>
            No Cantata, compositores publicam e vendem suas obras; maestros e músicos encontram
            repertório com qualidade editorial e licenciamento claro. Cada partitura, do manuscrito
            ao palco, em um só lugar.
          </p>

          <div class="features">
            <div class="features__item" data-reveal>
              <div class="features__title">Publicar</div>
              <p class="features__text">
                Compositores disponibilizam suas obras com controle sobre edição e preço.
              </p>
            </div>
            <div class="features__item" data-reveal>
              <div class="features__title">Descobrir</div>
              <p class="features__text">
                Busca por formação, gênero e dificuldade para encontrar o repertório certo.
              </p>
            </div>
            <div class="features__item" data-reveal>
              <div class="features__title">Adquirir</div>
              <p class="features__text">
                Compra direta e licenciada, com o material pronto para o ensaio.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================== PARA QUEM É ===================== -->
    <section class="section section--audience">
      <div class="glow glow--cards" aria-hidden="true"></div>

      <div class="audience">
        <div class="eyebrow eyebrow--spaced" data-reveal>
          <span class="eyebrow__dash"></span>
          <span class="eyebrow__label">Para quem é</span>
        </div>

        <div class="cards">
          <div class="card" data-reveal>
            <span class="card__kicker">Quem escreve</span>
            <h3 class="card__title">Compositores</h3>
            <p class="card__text">
              Um canal direto para publicar e vender suas obras, alcançar regentes e intérpretes, e
              ser remunerado de forma justa pelo que escreve.
            </p>
          </div>
          <div class="card" data-reveal>
            <span class="card__kicker">Quem rege</span>
            <h3 class="card__title">Maestros</h3>
            <p class="card__text">
              Repertório novo e confiável para coros e orquestras, com partes e grades completas,
              licenciamento claro e material pronto para o ensaio.
            </p>
          </div>
          <div class="card" data-reveal>
            <span class="card__kicker">Quem interpreta</span>
            <h3 class="card__title">Músicos</h3>
            <p class="card__text">
              Acesso simples a partituras de qualidade — da peça de estudo à obra de concerto — para
              dar voz à música de novos compositores.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================== RODAPÉ ===================== -->
    <footer class="footer">
      <div class="footer__inner">
        <div class="footer__brand" data-reveal>
          <img src="/logo.svg" alt="Cantata" class="footer__logo" />
          <p class="footer__tagline">Em desenvolvimento — a música vem primeiro.</p>
        </div>

        <div class="footer__bar">
          <span class="footer__copyright">© 2026 Cantata. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style lang="scss">
// Regras que precisam escapar do escopo do componente.
html:has(.landing) {
  scroll-behavior: smooth;
}

.landing ::selection {
  background: $color-primary;
  color: $color-back;
}
</style>

<style scoped lang="scss">
$ease-out: cubic-bezier(0.22, 1, 0.36, 1);
$line-soft: rgba($color-white, 0.12);

// Botão/badge da marca: sem border-radius, só duas linhas horizontais
// de 1px cujas extremidades se dissolvem em gradiente.
@mixin dissolved-lines($color) {
  background-image:
    linear-gradient(90deg, rgba($color, 0) 0%, $color 30%, $color 70%, rgba($color, 0) 100%),
    linear-gradient(90deg, rgba($color, 0) 0%, $color 30%, $color 70%, rgba($color, 0) 100%);
  background-size:
    100% 1px,
    100% 1px;
  background-position:
    top center,
    bottom center;
  background-repeat: no-repeat;
}

.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $color-back;
  color: $color-white;
  font-family: $font-body;
  -webkit-font-smoothing: antialiased;
  position: relative;
  // "clip" em vez de "hidden" para não quebrar o position: sticky da topbar.
  overflow: clip;

  a {
    color: $color-white;
    text-decoration: none;

    &:hover {
      color: $color-primary;
    }
  }
}

// -------- Glows ambientes --------
.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;

  &--top {
    top: -180px;
    left: 50%;
    margin-left: -320px;
    width: 640px;
    height: 640px;
    background: radial-gradient(circle, rgba($color-primary, 0.22) 0%, rgba($color-primary, 0) 70%);
    filter: blur(80px);
    animation: drift1 18s ease-in-out infinite;
  }

  &--right {
    top: 780px;
    right: -260px;
    width: 560px;
    height: 560px;
    background: radial-gradient(circle, rgba($color-white, 0.07) 0%, rgba($color-white, 0) 70%);
    filter: blur(70px);
    animation: drift2 24s ease-in-out infinite;
  }

  &--cards {
    bottom: -200px;
    left: -220px;
    width: 560px;
    height: 560px;
    background: radial-gradient(circle, rgba($color-primary, 0.14) 0%, rgba($color-primary, 0) 70%);
    filter: blur(80px);
    animation: drift2 26s ease-in-out infinite;
  }
}

// -------- Hero --------
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  z-index: 1;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  display: flex;
  justify-content: center;
  background: rgba($color-back, 0.6);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid $line-soft;
  animation: fadeIn 1s ease-out both;

  &__inner {
    width: 100%;
    max-width: calc(1080px + 64px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 32px;
  }

  &__logo {
    height: 26px;
    display: block;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba($color-white, 0.6);
  padding: 9px 20px;
  @include dissolved-lines(rgba($color-white, 0.35));

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-primary;
    animation: pulseDot 2.4s ease-in-out infinite;
  }
}

.hero__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 130px 32px 80px;
  width: 100%;
  max-width: calc(780px + 64px);
}

.hero__logo-frame {
  display: flex;
  justify-content: center;
  width: min(760px, 100%);
  padding: 44px 0;
  @include dissolved-lines($color-primary);
  animation: riseIn 1.1s $ease-out both;
}

.hero__logo {
  width: min(440px, 82vw);
  display: block;
}

.hero__title {
  font-family: $font-display;
  font-weight: 500;
  font-size: clamp(38px, 5.5vw, 64px);
  line-height: 1.15;
  margin: 56px 0 0;
  letter-spacing: -0.01em;
  text-wrap: balance;
  animation: riseIn 1.1s $ease-out 0.25s both;

  em {
    font-style: italic;
    color: $color-primary;
  }
}

.hero__lead {
  font-size: 17px;
  line-height: 1.7;
  color: rgba($color-white, 0.65);
  max-width: 520px;
  margin: 28px 0 0;
  text-wrap: pretty;
  animation: riseIn 1.1s $ease-out 0.4s both;
}

.hero__spacer {
  height: 80px;
}

// -------- Seções --------
.section {
  border-top: 1px solid $line-soft;
  padding: 130px 32px;
  position: relative;
  z-index: 1;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 16px;

  &--spaced {
    margin-bottom: 72px;
  }

  &__dash {
    width: 32px;
    height: 1px;
    background: $color-primary;
    display: block;
  }

  &__label {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba($color-white, 0.55);
  }
}

.section__title {
  font-family: $font-display;
  font-weight: 500;
  font-size: clamp(28px, 3.4vw, 42px);
  line-height: 1.3;
  margin: 0;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

// -------- O que é --------
.about {
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(0, 2fr);
  gap: 48px;
  align-items: start;

  &__text {
    font-size: 16px;
    line-height: 1.8;
    color: rgba($color-white, 0.65);
    margin: 28px 0 0;
    max-width: 560px;
    text-wrap: pretty;
  }
}

.features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 64px;
  border-top: 1px solid $line-soft;

  &__item {
    padding: 28px 24px 0 24px;
    border-left: 1px solid $line-soft;

    &:first-child {
      padding-left: 0;
      border-left: none;
    }

    &:last-child {
      padding-right: 0;
    }
  }

  &__title {
    font-family: $font-display;
    font-size: 22px;
    font-style: italic;
    color: $color-primary;
  }

  &__text {
    font-size: 14px;
    line-height: 1.7;
    color: rgba($color-white, 0.6);
    margin: 12px 0 0;
  }
}

// -------- Para quem é --------
.audience {
  max-width: 1080px;
  margin: 0 auto;
  position: relative;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 40px;
}

.card {
  border: 1px solid rgba($color-white, 0.16);
  background: rgba($color-white, 0.03);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-radius: 4px;
  transition:
    border-color 0.4s ease,
    transform 0.4s ease;

  &:hover {
    border-color: rgba($color-primary, 0.6);
    transform: translateY(-6px);
  }

  &__kicker {
    font-family: $font-display;
    font-style: italic;
    font-size: 16px;
    color: $color-primary;
  }

  &__title {
    font-family: $font-display;
    font-weight: 500;
    font-size: 30px;
    margin: 0;
    line-height: 1.25;
  }

  &__text {
    font-size: 15px;
    line-height: 1.8;
    color: rgba($color-white, 0.65);
    margin: 0;
    text-wrap: pretty;
  }
}

// -------- Rodapé --------
.footer {
  border-top: 1px solid $line-soft;
  padding: 96px 32px 48px;
  margin-top: 40px;
  position: relative;
  z-index: 1;

  &__inner {
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 72px;
  }

  &__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 28px;
  }

  &__logo {
    width: min(260px, 60vw);
    display: block;
  }

  &__tagline {
    font-family: $font-display;
    font-style: italic;
    font-size: 18px;
    color: rgba($color-white, 0.55);
    margin: 0;
  }

  &__bar {
    display: flex;
    justify-content: center;
    align-items: center;
    border-top: 1px solid rgba($color-white, 0.15);
    padding-top: 32px;
  }

  &__copyright {
    font-size: 12px;
    letter-spacing: 0.06em;
    color: rgba($color-white, 0.45);
  }
}

// -------- Animações --------
@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(28px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes drift1 {
  50% {
    transform: translate(60px, -40px) scale(1.15);
  }
}

@keyframes drift2 {
  50% {
    transform: translate(-50px, 50px) scale(0.9);
  }
}

@keyframes pulseDot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

// -------- Responsivo --------
@media (max-width: 900px) {
  // Sem a coluna do eyebrow, sobra largura para as 3 colunas de features.
  .about {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

@media (max-width: 720px) {
  .topbar__inner {
    padding: 22px 24px;
  }

  .hero__body {
    padding: 96px 24px 64px;
  }

  .hero__logo-frame {
    padding: 36px 0;
  }

  .hero__spacer {
    height: 48px;
  }

  .section {
    padding: 88px 24px;
  }

  .eyebrow--spaced {
    margin-bottom: 48px;
  }

  .features {
    grid-template-columns: 1fr;
    margin-top: 48px;

    &__item {
      padding: 28px 0 0;
      border-left: none;
    }
  }

  .card {
    padding: 40px 28px;
  }

  .footer {
    padding: 64px 24px 40px;

    &__inner {
      gap: 48px;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .glow,
  .badge__dot,
  .topbar,
  .hero__logo-frame,
  .hero__title,
  .hero__lead {
    animation: none;
  }

  .card:hover {
    transform: none;
  }
}
</style>
