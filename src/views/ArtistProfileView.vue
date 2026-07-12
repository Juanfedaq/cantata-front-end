<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import ArtistAvatar from '@/components/ArtistAvatar.vue'
import ContentCard from '@/components/ContentCard.vue'
import { artistsApi, fileUrl, type CatalogItem } from '@/services/api'
import { usePageSeo } from '@/composables/useSeo'

const route = useRoute()

const artist = ref<{
  id: number
  name: string | null
  bio: string | null
  avatarPath: string | null
} | null>(null)
const contents = ref<Omit<CatalogItem, 'artist'>[]>([])
const loading = ref(true)
const error = ref('')

// SEO: com o perfil carregado, o <head> reflete nome, bio e avatar do artista.
usePageSeo({
  title: computed(() => artist.value?.name ?? null),
  description: computed(() => {
    const a = artist.value
    if (!a) return null
    if (a.bio) return a.bio.length > 160 ? `${a.bio.slice(0, 157)}…` : a.bio
    return `Obras de ${a.name ?? 'artista'} no Cantata — marketplace de partituras.`
  }),
  image: computed(() => fileUrl(artist.value?.avatarPath)),
})

onMounted(async () => {
  try {
    const res = await artistsApi.profile(String(route.params.id))
    artist.value = res.artist
    contents.value = res.contents
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar o perfil.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <p v-if="loading" class="muted">Carregando…</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="artist">
      <header class="profile">
        <ArtistAvatar :name="artist.name" :avatar-path="artist.avatarPath" :size="84" />
        <div>
          <h1 class="name">{{ artist.name || 'Artista' }}</h1>
          <p v-if="artist.bio" class="bio">{{ artist.bio }}</p>
        </div>
      </header>

      <h2 class="section-title">Conteúdos publicados</h2>
      <p v-if="!contents.length" class="muted">Este artista ainda não publicou conteúdos.</p>
      <div v-else class="grid">
        <ContentCard
          v-for="item in contents"
          :key="item.id"
          :id="item.id"
          :title="item.title"
          :price-cents="item.priceCents"
          :cover-path="item.coverPath"
          :categories="item.categories"
        />
      </div>
    </template>
  </AppLayout>
</template>

<style scoped lang="scss">
.profile {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.name {
  font-family: $font-display;
  font-size: 1.8rem;
}

.bio {
  margin-top: 0.5rem;
  color: rgba(var(--fg-rgb), 0.7);
  max-width: 640px;
  white-space: pre-line;
}

.section-title {
  font-family: $font-display;
  font-size: 1.3rem;
  margin-bottom: 1.25rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
}

.muted {
  color: rgba(var(--fg-rgb), 0.5);
}

.error {
  color: $color-error;
}
</style>
