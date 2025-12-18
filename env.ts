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
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string(),
  CACHE_VIEWS: Env.schema.boolean(),
  SESSION_DRIVER: Env.schema.string(),
  DRIVE_DISK: Env.schema.enum(['local'] as const),
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
  GOOGLE_API_KEY: Env.schema.string(),
  OPENAI_API_KEY: Env.schema.string(),
  OPENAI_MODEL: Env.schema.enum(['gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-5'] as const),
  SHOPIFY_WEBHOOK_URL: Env.schema.string(),
  SHOPIFY_CLIENT_SECRET: Env.schema.string(),
  PINTEREST_CLIENT_ID: Env.schema.string(),
  PINTEREST_CLIENT_SECRET: Env.schema.string(),
  BACKEND_URL: Env.schema.string(),
})
