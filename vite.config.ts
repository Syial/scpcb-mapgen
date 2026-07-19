import { defineConfig } from "vite";

// base relatif pour un déploiement portable (Cloudflare Pages, sous-chemin, etc.)
export default defineConfig({ base: "./" });
