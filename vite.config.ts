import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

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
}));
