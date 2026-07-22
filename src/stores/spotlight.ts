import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Capa em destaque no fundo da página (CoverSpotlight.vue, no App.vue):
 * o ContentCard em hover publica a URL da capa aqui e o layer global a
 * exibe grande, em perspectiva lateral, atrás do conteúdo.
 * O hide tem um pequeno atraso para o deslize entre cards vizinhos não
 * piscar (o show do card seguinte cancela o atraso e só troca a imagem).
 */
export const useSpotlightStore = defineStore('spotlight', () => {
  const coverUrl = ref<string | null>(null)
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  function show(url: string) {
    clearTimeout(hideTimer)
    coverUrl.value = url
  }

  function hide() {
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      coverUrl.value = null
    }, 90)
  }

  return { coverUrl, show, hide }
})
