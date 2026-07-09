<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import { artistsApi, type ArtistSummary } from '@/services/api'
import { artistHue } from '@/utils/avatar'

const artists = ref<ArtistSummary[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    artists.value = (await artistsApi.list()).artists
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao listar os artistas.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <h1 class="page-title">Artistas</h1>

    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!artists.length" class="muted">Nenhum artista cadastrado ainda.</p>

    <div v-else class="grid">
      <RouterLink
        v-for="artist in artists"
        :key="artist.id"
        :to="`/artistas/${artist.id}`"
        class="card"
        :style="{ '--artist-hue': artistHue(artist.name) }"
      >
        <span class="waves" aria-hidden="true">
          <span v-for="n in 16" :key="n" class="wave" :class="`wave-${n}`"></span>
        </span>
        <ArtistAvatar class="avatar" :name="artist.name" :avatar-path="artist.avatarPath" :size="64" />
        <h3 class="name">{{ artist.name || 'Artista' }}</h3>
        <p v-if="artist.bio" class="bio">{{ artist.bio }}</p>
        <span class="count">{{ artist.publishedCount }} conteúdo(s) publicado(s)</span>
      </RouterLink>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

// Grupo blocado (guia §3): cards colados, sem gap; bordas de 1px
// sobrepostas pela margem negativa, como nos blocos da home.
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

// Card blocado (guia §3) no mesmo padrão dos blocos de artista da home:
// fundo tintado pela cor do nome (--artist-hue) + onda sonora de anéis.
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
  padding: 1.75rem 1.25rem;
  border: 1px solid $line;
  margin: 0 -1px -1px 0;
  color: $color-white;
  text-decoration: none;
  // Tinta do artista em versão opaca (mistura com o fundo): o backdrop
  // global de anéis não atravessa o bloco.
  background: color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 7%, rgb(var(--bg-rgb)));
  overflow: hidden; // recorta os anéis que passam da moldura
  transition: background-color 0.5s $ease-brand;
  // Sem hover-arc (2026-07-09): a onda sonora dos anéis já é o gesto do
  // hover destes blocos.

  &:hover {
    background: color-mix(in srgb, hsl(var(--artist-hue) 45% 50%) 13%, rgb(var(--bg-rgb)));

    .name {
      color: $gold-text;
    }

    .wave {
      animation: sound-wave 1.8s $ease-brand infinite;
    }
  }
}

// Anéis centrados no avatar de 64px, sob 1.75rem de padding.
@include artist-waves(64px, calc(1.75rem + 32px));

// Conteúdo acima da camada (posicionada) dos anéis.
.avatar,
.name,
.bio,
.count {
  position: relative;
}

.name {
  font-family: $font-display;
  font-size: 1.15rem;
  transition: color 0.5s $ease-brand;
}

.bio {
  font-size: 0.85rem;
  color: rgba(var(--fg-rgb), 0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.count {
  @include label-type;
  margin-top: 0.4rem;
  font-size: 0.68rem;
  color: $gold-text;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
}
</style>
