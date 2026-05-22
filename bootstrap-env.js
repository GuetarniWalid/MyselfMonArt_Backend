/*
|--------------------------------------------------------------------------
| Vault-aware env bootstrap
|--------------------------------------------------------------------------
|
| Loaded as the very first thing by `ace` and `server.ts`, before AdonisJS
| reads env.ts. Behavior:
|
|   1. If a local `.env` file exists at the project root → do nothing.
|      AdonisJS will load it via its native @adonisjs/env loader.
|
|   2. Else if process.env.DOTENV_KEY is set → decrypt `.env.vault` with
|      dotenv (v16.1+ has native vault support) and inject values into
|      process.env. AdonisJS then sees them via its `preferExistingEnv-
|      Variables` logic and env.ts validation runs normally.
|
|   3. Else → do nothing. AdonisJS will surface its usual missing-env
|      validation errors from env.ts.
|
| On decryption failure (invalid DOTENV_KEY, malformed vault), we throw
| immediately with a clear message so cloud sandboxes fail fast.
*/

const fs = require('fs')
const path = require('path')

const appRoot = __dirname
const envPath = path.join(appRoot, '.env')
const vaultPath = path.join(appRoot, '.env.vault')

if (fs.existsSync(envPath)) {
  // Case A: local .env present — let AdonisJS handle it natively.
  return
}

if (!process.env.DOTENV_KEY) {
  // Case C: nothing we can do — let env.ts validation surface the real error.
  return
}

if (!fs.existsSync(vaultPath)) {
  throw new Error(
    '[bootstrap-env] DOTENV_KEY is set but .env.vault is missing at the project root.'
  )
}

try {
  require('dotenv').config({ path: vaultPath })
} catch (err) {
  throw new Error(`[bootstrap-env] Failed to decrypt .env.vault with DOTENV_KEY: ${err.message}`)
}
