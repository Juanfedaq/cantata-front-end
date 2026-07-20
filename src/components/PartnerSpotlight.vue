<script setup lang="ts">
// Destaque do sócio como "rosto" do Cantata (2026-07-20): substitui a
// vitrine de vários artistas na Home enquanto ela fica escondida — ver
// PROGRESS.md. Conteúdo 100% placeholder por enquanto; trocar pelos dados
// reais quando o texto/foto estiverem prontos.
import { computed } from 'vue'
import { fileUrl } from '@/services/api'

// TODO: trocar pelo id real do usuário/artista do sócio (users.id no banco)
// assim que soubermos qual é — hoje aponta pro placeholder abaixo.
const PARTNER_ARTIST_ID = 1

// TODO: nome, bio e foto reais do sócio. `photoPath` null = mostra o
// placeholder (moldura com texto); trocar por um caminho de arquivo
// público (ex.: vindo de fileUrl) quando a foto estiver definida.
const partnerName = 'Nome do sócio'
const partnerBio = `Texto biográfico do sócio entra aqui — quem é, sua trajetória com música
e o porquê de ter criado o Cantata. Substituir este parágrafo de exemplo
pelo texto real assim que estiver pronto.`
const photoPath: string | null = null

const photo = computed(() => fileUrl(photoPath))
</script>

<template>
  <section class="spotlight">
    <div class="photo-frame">
      <img v-if="photo" :src="photo" :alt="partnerName" class="photo" />
      <div v-else class="photo-placeholder">Foto em breve</div>
    </div>

    <div class="text">
      <h2 class="section-title">Quem faz o Cantata</h2>
      <h3 class="name">{{ partnerName }}</h3>
      <p class="bio">{{ partnerBio }}</p>
      <RouterLink :to="`/artistas/${PARTNER_ARTIST_ID}`" class="link">Ver obras publicadas</RouterLink>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Mesma gramática de foto+texto do ContentDetailView (guia): grid 1fr/1fr,
// imagem sem borda nem radius, empilha abaixo de 800px.
.spotlight {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  align-items: center;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.photo-frame {
  aspect-ratio: 4 / 5;
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

// Placeholder enquanto não há foto real: moldura de 1px (guia §3), sem
// pretender ser a imagem final — só marca o lugar dela.
.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid $line;
  color: $text-dim;
  font-size: 0.85rem;
}

.section-title {
  font-family: $font-display;
  font-size: 1.4rem;
  margin-bottom: 1.25rem;
}

.name {
  font-family: $font-display;
  font-size: 1.15rem;
  color: $gold-text;
  margin-bottom: 0.6rem;
}

.bio {
  color: rgba(var(--fg-rgb), 0.75);
  white-space: pre-line;
  max-width: 480px;
}

.link {
  display: inline-block;
  margin-top: 1.25rem;
  @include label-type;
  font-size: 0.7rem;
  color: $gold-text;
  text-decoration: none;
  transition: color 0.5s $ease-brand;

  &:hover {
    color: $color-white;
  }
}
</style>
