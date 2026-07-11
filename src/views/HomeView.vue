<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { motion, MotionConfig } from 'motion-v'
import AppLayout from '@/components/AppLayout.vue'
import ContentCard from '@/components/ContentCard.vue'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { artistsApi, catalogApi, type ArtistSummary, type CatalogItem, type Category } from '@/services/api'
import { useThemeStore } from '@/stores/theme'
import { artistHue } from '@/utils/avatar'

const theme = useThemeStore()

// Versões animáveis dos cards (motion.create repassa props/attrs ao
// componente, então o estilo blocado — bordas coladas — fica intacto).
const MotionLink = motion.create(RouterLink)
const MotionContentCard = motion.create(ContentCard)

// Entrada das seções e cards na linguagem do riseIn do banner: véu +
// subida no easing da marca, disparada quando o bloco entra na tela
// (uma vez só). `delay` escalona os cards; `y` menor para itens pequenos.
const easeBrand = [0.22, 1, 0.36, 1]
function rise(delay = 0, y = 24) {
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0 },
    inViewOptions: { once: true },
    transition: { duration: 0.7, ease: easeBrand, delay },
  }
}

const categories = ref<Category[]>([])
const latest = ref<CatalogItem[]>([])
const newArtists = ref<ArtistSummary[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [cats, items, artists] = await Promise.all([
      catalogApi.categories(),
      catalogApi.list({ perPage: 8 }),
      artistsApi.list({ order: 'recentes', limit: 4 }),
    ])
    categories.value = cats.categories
    latest.value = items.items
    newArtists.value = artists.artists
  } catch {
    // Home pública: falha de rede só deixa as seções vazias.
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <!-- Banner — cópia do hero da ComingSoonView (logo emoldurada pelas
         linhas que se dissolvem + título com destaque dourado + lead) -->
    <section class="banner">
      <div class="banner-logo-frame">
        <img :src="theme.logoSrc" alt="Cantata" class="banner-logo" />
      </div>

      <h1 class="banner-title">Onde toda música encontra sua <em>voz</em></h1>

      <p class="banner-sub">
        O Cantata é um marketplace de partituras que conecta compositores, maestros e músicos —
        um lugar para publicar, descobrir e adquirir música escrita.
      </p>

      <RouterLink to="/biblioteca" class="banner-cta">Explorar a biblioteca</RouterLink>
    </section>

    <!-- Seções com reveal do motion-v: cada uma sobe ao entrar na tela e
         os cards escalonam (delay por índice). reduced-motion="user"
         respeita prefers-reduced-motion (mantém só o véu de opacidade). -->
    <MotionConfig reduced-motion="user">
      <!-- Menu de categorias -->
      <motion.section class="section" v-bind="rise()">
        <h2 class="section-title">Categorias</h2>
        <div class="categories">
          <MotionLink
            v-for="(cat, i) in categories"
            :key="cat.id"
            :to="`/biblioteca?categoria=${cat.slug}`"
            class="category-card"
            :class="cat.slug"
            v-bind="rise(i * 0.06, 18)"
          >
            <CategoryIcon class="category-icon" :slug="cat.slug" :size="28" />
            <span>{{ cat.name }}</span>
          </MotionLink>
        </div>
      </motion.section>

      <!-- Últimos artistas cadastrados: 4 blocos -->
      <motion.section v-if="newArtists.length" class="section" v-bind="rise()">
        <div class="section-head">
          <h2 class="section-title">Últimos artistas</h2>
          <RouterLink to="/artistas" class="section-link">Ver todos</RouterLink>
        </div>
        <div class="artists">
          <MotionLink
            v-for="(artist, i) in newArtists"
            :key="artist.id"
            :to="`/artistas/${artist.id}`"
            class="artist-card"
            :style="{ '--artist-hue': artistHue(artist.name) }"
            v-bind="rise(i * 0.08, 18)"
          >
            <span class="waves" aria-hidden="true">
              <span v-for="n in 16" :key="n" class="wave" :class="`wave-${n}`"></span>
            </span>
            <ArtistAvatar
              class="artist-avatar"
              :name="artist.name"
              :avatar-path="artist.avatarPath"
              :size="88"
            />
            <span class="artist-name">{{ artist.name || 'Artista' }}</span>
          </MotionLink>
        </div>
      </motion.section>

      <!-- Últimos lançamentos -->
      <motion.section class="section" v-bind="rise()">
        <h2 class="section-title">Últimos lançamentos</h2>
        <p v-if="loading" class="muted">Carregando…</p>
        <p v-else-if="!latest.length" class="muted">Nenhum conteúdo publicado ainda.</p>
        <div v-else class="grid">
          <MotionContentCard
            v-for="(item, i) in latest"
            :key="item.id"
            :id="item.id"
            :title="item.title"
            :price-cents="item.priceCents"
            :cover-path="item.coverPath"
            :categories="item.categories"
            :artist-name="item.artist.name"
            v-bind="rise(i * 0.06, 18)"
          />
        </div>
      </motion.section>
    </MotionConfig>
  </AppLayout>
</template>

<style scoped lang="scss">
// Banner copiado do hero da ComingSoonView: logo entre linhas douradas que
// se dissolvem, título serifado com <em> dourado, lead e reveal escalonado.
.banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3.5rem 1.5rem 4.5rem;
}

.banner-logo-frame {
  display: flex;
  justify-content: center;
  width: min(1080px, 100%);
  padding: 56px 0;
  @include dissolved-lines($color-primary);
  animation: riseIn 1.1s $ease-brand both;
}

// Logomarca sem borda (guia §3.6), em destaque grande no banner.
.banner-logo {
  width: min(680px, 88vw);
  display: block;
}

.banner-title {
  font-family: $font-display;
  font-weight: 500;
  font-size: clamp(38px, 5.5vw, 64px);
  line-height: 1.15;
  margin-top: 56px;
  letter-spacing: -0.01em;
  text-wrap: balance;
  animation: riseIn 1.1s $ease-brand 0.25s both;

  em {
    font-style: italic;
    color: $color-primary;
  }
}

.banner-sub {
  font-size: 17px;
  line-height: 1.7;
  color: rgba(var(--fg-rgb), 0.65);
  max-width: 520px;
  margin-top: 28px;
  text-wrap: pretty;
  animation: riseIn 1.1s $ease-brand 0.4s both;
}

.banner-cta {
  @include block-button-primary;
  margin-top: 2.5rem;
  animation: riseIn 1.1s $ease-brand 0.55s both;
}

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

@media (prefers-reduced-motion: reduce) {
  .banner-logo-frame,
  .banner-title,
  .banner-sub,
  .banner-cta {
    animation: none;
  }
}

.section {
  margin-top: 3rem;
}

.section-title {
  font-family: $font-display;
  font-size: 1.4rem;
  margin-bottom: 1.25rem;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;

  .section-title {
    margin-bottom: 1.25rem;
  }
}

.section-link {
  @include label-type;
  font-size: 0.7rem;
  color: $gold-text;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
  }
}

// Últimos artistas: grupo blocado colado (guia §3), 4 blocos com
// avatar circular (exceção do guia §8), nome e contagem; hover-luz.
.artists {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

// Cada bloco recebe --artist-hue (hash do nome, estilo Google): o fundo é
// um tinte translúcido dessa matiz (convive com os dois temas) e o avatar
// é a cor cheia, dessaturada para caber no tom editorial.
// Bloco compacto de altura fixa (a largura vem do grid): avatar e ondas
// cravados no CENTRO exato; o nome ancora na base, acima das ondas.
// A altura comporta o avatar de 88px com folga para o nome — diminuir o
// box não diminui a imagem.
.artist-card {
  position: relative;
  display: block;
  height: 200px;
  border: 1px solid $line;
  margin: 0 -1px -1px 0;
  color: $color-white;
  text-decoration: none;
  // Tinta do artista em versão opaca (mistura com o fundo): o backdrop
  // global de anéis não atravessa o bloco.
  background: color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 7%, rgb(var(--bg-rgb)));
  overflow: hidden; // recorta os anéis que passam da moldura
  transition: background-color 0.5s $ease-brand;
  // Sem gesto global de hover (2026-07-09): a onda sonora dos anéis já é
  // o gesto do hover destes blocos.

  &:hover {
    background: color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 13%, rgb(var(--bg-rgb)));

    .artist-name {
      color: $gold-text;
    }

    .artist-avatar {
      transform: translate(-50%, -50%) scale(1.08);
    }

    .wave {
      animation: sound-wave 1.8s $ease-brand infinite;
    }
  }
}

// Visual do avatar vem do componente ArtistAvatar; aqui só o encaixe:
// centro exato do bloco, acima das ondas. Cresce um pouco no hover —
// como é absoluto e o nome é ancorado à base, nada se desloca.
.artist-avatar {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  transition: transform 0.5s $ease-brand;
}

// Onda sonora ocupando o fundo do bloco (mixin global do guia):
// anéis no mesmo centro do avatar (50% = centro do bloco).
@include artist-waves(88px, 50%);

// Nome na base do bloco, acima da camada das ondas.
.artist-name {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 1.1rem;
  text-align: center;
  font-family: $font-display;
  font-size: 1.1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.5s $ease-brand;
}

// Grupo blocado (guia §3): categorias coladas, sem gap; as bordas de 1px
// dos vizinhos se sobrepõem pela margem negativa (linhas sempre de 1px).
.categories {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

// Card de categoria blocado: moldura de 1px, hover-luz (guia §3/§4).
// Fundo NEUTRO opaco (o backdrop de anéis não atravessa) — a cor da
// categoria aparece só no ícone; o @each apenas define a matiz (--cat-hue)
// que o ícone consome.
.category-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  text-align: center;
  padding: 1.65rem 1rem 1.4rem;
  border: 1px solid $line;
  margin: 0 -1px -1px 0;
  color: $text-secondary;
  text-decoration: none;
  font-family: $font-display;
  font-size: 1.1rem;
  background: rgb(var(--bg-rgb));
  transition: color 0.5s $ease-brand, background-color 0.5s $ease-brand;
  @include hover-light;

  @each $slug, $hue in $category-hues {
    &.#{$slug} {
      --cat-hue: #{$hue};
    }
  }

  &:hover {
    color: $color-white;
    background: $fill-hover-solid;

    .category-icon {
      transform: translateY(-2px);
    }
  }
}

// Ícone na tinta da categoria (mesma matiz do fundo, lightness por tema
// via --cat-tag-l — a mesma das tags). Sobe 2px no hover, só transform.
.category-icon {
  color: hsl(var(--cat-hue, 45) 45% var(--cat-tag-l, 64%));
  transition: transform 0.5s $ease-brand;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}
</style>
