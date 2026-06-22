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
  // --- CustomArt (poster personnalisé foot) — tout optionnel pour ne pas casser le boot ---
  // Jeton API Replicate (provider Seedream/Qwen + upscale Real-ESRGAN).
  REPLICATE_API_TOKEN: Env.schema.string.optional(),
  // Clé fal.ai (alternative à Replicate, non branchée par défaut).
  FAL_KEY: Env.schema.string.optional(),
  // Cap coût global quotidien en euros (défaut 30) : au-delà, le studio répond « forte affluence ».
  CUSTOM_ART_DAILY_COST_CAP_EUR: Env.schema.number.optional(),
  // Chaîne complète de providers, entrées 'nom[:modèle]' séparées par des virgules
  // (défaut bench M1 : gemini-3.1-flash-image -> gemini-3-pro-image -> gemini-2.5-flash-image).
  CUSTOM_ART_PROVIDER_CHAIN: Env.schema.string.optional(),
  // Rétro-compat : primaire/secours seuls ('gemini' | 'openai' | 'replicate').
  CUSTOM_ART_PRIMARY_PROVIDER: Env.schema.string.optional(),
  CUSTOM_ART_FALLBACK_PROVIDER: Env.schema.string.optional(),
  // Modèle du juge vision (défaut : celui de la calibration bench).
  CUSTOM_ART_JUDGE_MODEL: Env.schema.string.optional(),
  // URL publique de l'image de référence scène/pose (figée J1).
  CUSTOM_ART_SCENE_REF_URL: Env.schema.string.optional(),
  // PSD des mises en situation post-reveal (chemins /mockups/... du moteur Photopea),
  // séparés par des ';'. Vide = aucun rendu de mockup.
  CUSTOM_ART_MOCKUP_PSDS: Env.schema.string.optional(),
  // Tests locaux M9 UNIQUEMENT : saute l'appel Replicate (payant) de l'upscale print,
  // le fichier est produit par interpolation sharp depuis la HD élue. JAMAIS true en prod.
  CUSTOM_ART_SKIP_UPSCALE: Env.schema.boolean.optional(),
  // Modèle Replicate de l'upscale print ('owner/name' ou 'owner/name:version' pour
  // figer une version). Défaut : nightmareai/real-esrgan (Real-ESRGAN ×4).
  CUSTOM_ART_UPSCALE_MODEL: Env.schema.string.optional(),
  // Tests locaux M10 + charge M12 UNIQUEMENT : provider FACTICE (image statique du
  // bench, zéro appel API payant, juge court-circuité). IGNORÉ en production.
  CUSTOM_ART_FAKE_PROVIDER: Env.schema.boolean.optional(),
  // Dossier des images servies par le provider factice. Vide = défaut
  // scripts/bench/results/fiabilite-g31-v2/images (relatif à la racine du repo).
  CUSTOM_ART_FAKE_IMAGES_DIR: Env.schema.string.optional(),
  // Origin public de la boutique (https://www.myselfmonart.com) pour le CORS du studio.
  STOREFRONT_URL: Env.schema.string.optional(),
  // Lire l'IP client dans l'en-tête CF-Connecting-IP (chaîne Cloudflare -> nginx -> Adonis)
  // pour le throttle et les caps anti-abus, tant que nginx ne ré-injecte pas la vraie IP
  // dans X-Forwarded-For. Voir App/Services/ClientIp.
  TRUST_CF_CONNECTING_IP: Env.schema.boolean.optional(),
  // Kill-switch d'urgence du worker CustomArt : true = aucun job traité (le studio peut
  // toujours créer des jobs, ils restent pending). Coupe instantanément toute dépense IA
  // via env + restart, sans déploiement. Posé après l'incident coûts du 13/06.
  CUSTOM_ART_WORKER_DISABLED: Env.schema.boolean.optional(),
  // --- Canal SAV e-mail (Gmail) — tout optionnel : la feature reste dormante tant que
  // EMAIL_CHANNEL_ENABLED n'est pas vrai (webhook 204, tâches no-op). ---
  // Interrupteur maître du canal e-mail. Faux/absent = aucune ingestion ni réponse.
  EMAIL_CHANNEL_ENABLED: Env.schema.boolean.optional(),
  // Refresh token OAuth offline (scope gmail.modify) du compte SAV — obtenu via mcp/gmail/setup-oauth.
  GMAIL_REFRESH_TOKEN: Env.schema.string.optional(),
  // Topic Pub/Sub Google ciblé par users.watch pour la notification push (renouvelé chaque jour).
  GMAIL_PUBSUB_TOPIC: Env.schema.string.optional(),
  // Secret partagé attendu dans ?token= du webhook POST /webhooks/email (vérifié hors développement).
  GMAIL_PUBSUB_VERIFICATION_TOKEN: Env.schema.string.optional(),
  // Adresse e-mail de la boîte SAV : sert à ignorer ses propres messages (anti-boucle).
  BUSINESS_EMAIL: Env.schema.string.optional(),
})
