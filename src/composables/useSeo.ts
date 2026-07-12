// SEO por rota via @unhead/vue (funciona no browser e na pré-renderização
// do vite-ssg). O App.vue chama useDefaultSeo() uma vez — título, descrição,
// canonical, Open Graph e robots reagem à rota (lendo meta.title/description/
// noindex definidos no router). Views de conteúdo dinâmico (artista, obra)
// refinam com usePageSeo() quando os dados chegam — entradas registradas
// depois vencem as padrão.
import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { useHead, useSeoMeta } from '@unhead/vue'

export const SITE_URL = 'https://cantata.com.br'
export const SITE_NAME = 'Cantata'

// Título/descrição da marca (os mesmos que viviam fixos no index.html).
export const DEFAULT_TITLE = 'Cantata — Partituras que encontram vozes'
export const DEFAULT_OG_TITLE = 'Cantata — Onde toda música encontra sua voz'
export const DEFAULT_DESCRIPTION =
  'O Cantata é um marketplace de partituras que conecta compositores, maestros e músicos — ' +
  'um lugar para publicar, descobrir e adquirir música escrita.'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`

function fullTitle(pageTitle: string | null): string {
  return pageTitle ? `${pageTitle} · ${SITE_NAME}` : DEFAULT_TITLE
}

/** Cabeçalho padrão de todas as páginas, dirigido pelo meta das rotas. */
export function useDefaultSeo() {
  const route = useRoute()

  const title = computed(() => (route.meta.title as string | undefined) ?? null)
  const description = computed(
    () => (route.meta.description as string | undefined) ?? DEFAULT_DESCRIPTION,
  )
  // Canonical sem query/hash — cada rota tem uma URL "oficial" única.
  const canonical = computed(() => SITE_URL + route.path)

  useHead({
    // Na pré-renderização o unhead controla os atributos do <html> —
    // sem isso o lang="pt-BR" do index.html viraria "en" no HTML gerado.
    htmlAttrs: { lang: 'pt-BR' },
    title,
    titleTemplate: (t?: string) => fullTitle(t ?? null),
    link: [{ rel: 'canonical', href: canonical }],
  })

  useSeoMeta({
    description,
    robots: computed(() => (route.meta.noindex ? 'noindex, nofollow' : 'index, follow')),
    ogType: 'website',
    ogSiteName: SITE_NAME,
    ogLocale: 'pt_BR',
    ogUrl: canonical,
    ogTitle: computed(() => (title.value ? fullTitle(title.value) : DEFAULT_OG_TITLE)),
    ogDescription: description,
    ogImage: DEFAULT_OG_IMAGE,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    twitterCard: 'summary_large_image',
    twitterTitle: computed(() => (title.value ? fullTitle(title.value) : DEFAULT_OG_TITLE)),
    twitterDescription: description,
    twitterImage: DEFAULT_OG_IMAGE,
  })
}

interface PageSeo {
  /** Título da página, sem o sufixo " · Cantata" (entra pelo template). */
  title: ComputedRef<string | null>
  description?: ComputedRef<string | null>
  /** URL absoluta de imagem para compartilhamento (capa da obra, avatar…). */
  image?: ComputedRef<string | null>
}

/** Sobrescreve o padrão em páginas de conteúdo dinâmico, quando os dados chegam. */
export function usePageSeo({ title, description, image }: PageSeo) {
  useHead({ title })

  useSeoMeta({
    description: computed(() => description?.value ?? undefined),
    ogTitle: computed(() => (title.value ? fullTitle(title.value) : undefined)),
    ogDescription: computed(() => description?.value ?? undefined),
    ogImage: computed(() => image?.value ?? undefined),
    twitterTitle: computed(() => (title.value ? fullTitle(title.value) : undefined)),
    twitterDescription: computed(() => description?.value ?? undefined),
    twitterImage: computed(() => image?.value ?? undefined),
  })
}
