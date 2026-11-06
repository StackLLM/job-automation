// Tests du backend (Vitest + Supertest). Lancer : npm test
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // Un fichier après l'autre : en parallèle, les serveurs éphémères de Supertest se croisaient sur les ports
    // locaux (macOS) et un test recevait la réponse d'une autre application (401, 404, quota dépassé au hasard).
    // Constaté le 01/11/2026 : environ 1 passage sur 3 en échec en parallèle, 6 sur 6 verts en séquentiel.
    fileParallelism: false,
    // Aucun appel réel : OpenRouter, n8n et Prisma sont simulés dans chaque test.
    env: {
      OPENROUTER_API_KEY: 'cle-de-test',
      CORS_ORIGINS: 'http://localhost:3000',
      BETTER_AUTH_SECRET: 'secret-de-test-long-de-plus-de-trente-deux-caracteres',
      BETTER_AUTH_URL: 'http://localhost:4000',
    },
  },
})
