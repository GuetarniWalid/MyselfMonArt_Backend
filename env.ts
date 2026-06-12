/*
|--------------------------------------------------------------------------
| Validating Environment Variables
|--------------------------------------------------------------------------
|
| In this file we define the rules for validating environment variables.
| By performing validation we ensure that your application is running in
| a stable environment with correct configuration values.
|
| This file is read automatically by the framework during the boot lifecycle
| and hence do not rename or move this file to a different location.
|
*/

import Env from '@ioc:Adonis/Core/Env'

export default Env.rules({
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  APP_URL: Env.schema.string(),
  NGROK_URL: Env.schema.string.optional(),
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string(),
  CACHE_VIEWS: Env.schema.boolean(),
  SESSION_DRIVER: Env.schema.string(),
  DRIVE_DISK: Env.schema.enum(['local', 'spaces'] as const),
  DO_SPACES_KEY: Env.schema.string.optional(),
  DO_SPACES_SECRET: Env.schema.string.optional(),
  DO_SPACES_REGION: Env.schema.string.optional(),
  DO_SPACES_BUCKET: Env.schema.string.optional(),
  DO_SPACES_ENDPOINT: Env.schema.string.optional(),
  DO_SPACES_CDN_ENDPOINT: Env.schema.string.optional(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  GOOGLE_CLIENT_ID: Env.schema.string(),
  GOOGLE_CLIENT_SECRET: Env.schema.string(),
  DB_CONNECTION: Env.schema.string(),
  MYSQL_HOST: Env.schema.string({ format: 'host' }),
  MYSQL_PORT: Env.schema.number(),
  MYSQL_USER: Env.schema.string(),
  MYSQL_PASSWORD: Env.schema.string.optional(),
  MYSQL_DB_NAME: Env.schema.string(),
  SHOPIFY_SHOP_URL: Env.schema.string(),
  SHOPIFY_API_VERSION: Env.schema.string(),
  SHOPIFY_ACCESS_TOKEN_SECRET: Env.schema.string(),
  FRONTEND_URL: Env.schema.string(),
  ID_MERCHANT_CENTER: Env.schema.string(),
  SMTP_HOST: Env.schema.string({ format: 'host' }),
  SMTP_PORT: Env.schema.number(),
  SMTP_USERNAME: Env.schema.string(),
  SMTP_PASSWORD: Env.schema.string(),
  MAIL_SENDER: Env.schema.string(),
  MAIL_RECIPIENT: Env.schema.string(),
  RESEND_API_KEY: Env.schema.string.optional(),
  RESEND_FROM: Env.schema.string.optional(),
  GOOGLE_API_KEY: Env.schema.string(),
  OPENAI_API_KEY: Env.schema.string(),
  OPENAI_MODEL: Env.schema.enum(['gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-5'] as const),
  ANTHROPIC_API_KEY: Env.schema.string(),
  CLAUDE_MODEL: Env.schema.string(),
  SHOPIFY_WEBHOOK_URL: Env.schema.string(),
  SHOPIFY_CLIENT_SECRET: Env.schema.string(),
  PINTEREST_CLIENT_ID: Env.schema.string(),
  PINTEREST_CLIENT_SECRET: Env.schema.string(),
  INSTAGRAM_APP_ID: Env.schema.string(),
  INSTAGRAM_APP_SECRET: Env.schema.string(),
  META_VERIFY_TOKEN: Env.schema.string(),
  META_APP_SECRET: Env.schema.string.optional(),
  FACEBOOK_PAGE_ID: Env.schema.string.optional(),
  FACEBOOK_PAGE_ACCESS_TOKEN: Env.schema.string.optional(),
  BACKEND_URL: Env.schema.string(),
  CHROME_EXTENSION_ID: Env.schema.string(),
  // URL publique du moteur de rendu des mockups (PC exposé via tunnel Cloudflare). Optionnel.
  RENDER_ENGINE_URL: Env.schema.string.optional(),
  // --- Publisher / images IA : tout tourne sur Gemini (Nano Banana) depuis le 12/06/2026. ---
  // Clé DÉDIÉE AI Studio (distincte de GOOGLE_API_KEY) ; lue via process.env dans les services,
  // déclarée ici pour documentation. Requise en pratique pour décor, insertion et retaillage.
  GEMINI_API_KEY: Env.schema.string.optional(),
  // Modèle image standard (décor + insertion + retaillage). Défaut : gemini-3.1-flash-image (NB2).
  GEMINI_IMAGE_MODEL: Env.schema.string.optional(),
  // Modèle image « haute fidélité » (case à cocher de l'insertion). Défaut : gemini-3-pro-image.
  GEMINI_IMAGE_MODEL_HIGH: Env.schema.string.optional(),
  // Modèle texte de l'art-director (brief de scène du décor). Défaut : gemini-2.5-flash.
  GEMINI_TEXT_MODEL: Env.schema.string.optional(),
})
