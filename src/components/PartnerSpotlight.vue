<script setup lang="ts">
// Destaque do sócio como "rosto" do Cantata (2026-07-20): substitui a
// vitrine de vários artistas na Home enquanto ela fica escondida — ver
// PROGRESS.md. Conteúdo 100% placeholder por enquanto; trocar pelos dados
// reais quando o texto/foto estiverem prontos.
// TODO: trocar pelo id real do usuário/artista do sócio (users.id no banco)
// assim que soubermos qual é — hoje aponta pro placeholder abaixo.
const PARTNER_ARTIST_ID = 1;

const partnerName = "Lucas Abdo Serrato";
// String em UMA linha de propósito: o .bio usa white-space: pre-line, então
// quebras no código virariam quebras visuais.
const partnerBio =
  "Professor, maestro e compositor, Lucas dedicou a vida à música da regência de coros e orquestras à sala de aula, formando novos músicos. Foi dessa vivência, e do desejo de ver partituras, arranjos e composições circularem e serem valorizados, que nasceu o Cantata: um lugar onde cada obra encontra quem precisa dela.";

// Foto do sócio: arquivo estático em public/ (servido na raiz pelo Vite).
// null volta ao placeholder "Foto em breve".
const photo: string | null = "/abdo.webp";
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
      <RouterLink :to="`/artistas/${PARTNER_ARTIST_ID}`" class="cta"
        >Ver obras publicadas</RouterLink
      >
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
  font-size: clamp(2rem, 3.5vw, 3rem);
  line-height: 1.1;
  color: $gold-text;
  margin-bottom: 0.9rem;
}

.bio {
  color: rgba(var(--fg-rgb), 0.75);
  white-space: pre-line;
  max-width: 480px;
}

// Mesmo padrão do CTA do banner da Home (guia): botão primário blocado.
.cta {
  @include block-button-primary;
  margin-top: 1.75rem;
}
</style>
