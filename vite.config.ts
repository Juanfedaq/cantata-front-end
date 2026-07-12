import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// Só pelos tipos: registra a chave ssgOptions no UserConfig do Vite.
import type {} from "vite-ssg";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Em produção (GitHub Pages) o site fica em /cantata-front-end/.
  // No dev local mantém a raiz "/".
  base: command === "build" ? "/" : "/",
  plugins: [vue()],
  css: {
    preprocessorOptions: {
      scss: {
        // Disponibiliza as variáveis ($color-primary, $font-display, etc.)
        // em todo <style lang="scss"> sem precisar de @use manual.
        additionalData: `@use "sass:color";\n@use "@/assets/styles/variables" as *;`,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Pré-renderização (vite-ssg): só as rotas públicas de conteúdo estático —
  // crawlers recebem HTML pronto sem executar JS. As demais rotas continuam
  // SPA puras (fallback index.html); /inicio, /biblioteca e /artistas ficam
  // de fora por dependerem de dados da API em runtime (e motion-v).
  ssgOptions: {
    includedRoutes: () => ["/", "/privacidade", "/login", "/register", "/forgot-password"],
    script: "async",
    formatting: "minify",
  },
}));
