## Server and Test Command Policy
**IMPORTANT:** Do NOT start servers or run test commands unless explicitly requested by the user.

- NEVER automatically run `npm start`, `npm run dev`, `node server.js`, or any server startup commands
- NEVER automatically run `npm test`, `npm run test`, or any testing commands
- Only execute these commands when the user specifically asks you to do so
- The user will manage server startup and testing on their own unless they request your help

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
