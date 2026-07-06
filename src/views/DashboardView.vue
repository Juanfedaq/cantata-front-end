<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="dash">
    <img src="/logo.svg" alt="Cantata" class="logo" />
    <h1 class="title">
      Olá{{ auth.user?.name ? `, ${auth.user.name}` : '' }} 👋
    </h1>
    <p class="email">{{ auth.user?.email }}</p>
    <p class="note">Você está autenticado. A área logada será construída aqui.</p>
    <button class="btn" @click="logout">Sair</button>
  </div>
</template>

<style scoped lang="scss">
.dash {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  background: $color-back;
  text-align: center;
}

.logo {
  height: 64px;
  margin-bottom: 0.5rem;
}

.title {
  font-family: $font-display;
  font-weight: 600;
  color: $color-white;
}

.email {
  color: $color-primary;
  font-weight: 300;
}

.note {
  color: rgba($color-white, 0.6);
  font-size: 0.9rem;
  max-width: 360px;
}

.btn {
  margin-top: 1rem;
  width: auto;
  padding: 0.7rem 2rem;
}
</style>
