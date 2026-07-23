import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { purchasesApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Conteúdos que o usuário JÁ COMPROU (status `pago`) — usado pelo
 * ContentCard para mostrar o selo "Já adquirido". Busca as compras UMA vez
 * (idempotente, mesmo com vários cards montando) e recarrega quando o
 * login muda. Sem login → conjunto vazio (nenhum selo).
 */
export const useOwnedStore = defineStore('owned', () => {
  const auth = useAuthStore()
  const ids = ref<Set<number>>(new Set())
  let loaded = false
  let inFlight: Promise<void> | null = null

  async function load(force = false) {
    if (!auth.isAuthenticated) {
      ids.value = new Set()
      loaded = true
      return
    }
    if (loaded && !force) return
    if (inFlight) return inFlight
    inFlight = (async () => {
      try {
        const { purchases } = await purchasesApi.mine()
        ids.value = new Set(purchases.filter((p) => p.status === 'pago').map((p) => p.content.id))
        loaded = true
      } catch {
        // Falha silenciosa: sem o dado, só não aparece o selo.
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }

  function owns(contentId: number) {
    return ids.value.has(contentId)
  }

  // Login/logout: zera e recarrega (o selo some ao sair, aparece ao entrar).
  watch(
    () => auth.isAuthenticated,
    () => {
      loaded = false
      ids.value = new Set()
      load()
    },
  )

  return { ids, load, owns }
})
