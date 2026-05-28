## Command Execution Policy
Claude is pre-authorized to run build, typecheck, test, and tooling commands autonomously, without asking for confirmation. This explicitly includes:

- `node ace ...` — any AdonisJS ace command (`generate:manifest`, `type-check`, `migration:run`, `build`, custom tasks, etc.)
- `tsc --noEmit` and other typecheck / lint / build commands
- `npm test` / `node ace test`

Run these whenever they help validate or move the work forward — do not pause to ask.

**Only caution:** do NOT start long-running *foreground* servers (`npm run dev`, `node ace serve`, `node server.js`) in a way that blocks the session. If a server is genuinely needed, start it in the background.

## Env loading (dotenv-vault)

This project supports two ways of loading env vars at startup, handled by [bootstrap-env.js](bootstrap-env.js):

- **Local dev:** keep your `.env` at the project root (gitignored). It's loaded natively by AdonisJS — nothing changes.
- **Cloud sandbox / CI (no `.env` on disk):** set `DOTENV_KEY` in the environment. The bootstrap decrypts `.env.vault` and injects values into `process.env` before AdonisJS reads them.

To refresh a local `.env` from the vault (requires `.env.me`):

```
npm run env:pull
```

Get your `.env.me` from a teammate or via `npx dotenv-vault@latest login`. If both `.env` and `DOTENV_KEY` are present, the local `.env` wins.

## Commit Message Format
Follow conventional commits format: `type(scope): description`

**Types:**
- `feat`: new feature or functionality
- `fix`: bug fix or error correction
- `refactor`: code restructuring without changing behavior

**Scopes:**
Use specific service/module names: `shopify-product-publisher`, `translator`, `shopify`, `webhooks`, `pinterest`, `database`, `docker`, `cors`, `backlinks`, `command`, `product`, `translation`, etc.

**Description:**
- Use lowercase
- Be concise and action-oriented
- Describe what changed, not how it was implemented
- Examples:
  - `fix(shopify-product-publisher): clean low-quality backgrounds and improve SEO content generation`
  - `feat(webhooks): implement tapestry model copying similar to paintings`
  - `refactor(database): remove variants table and related painting system`
