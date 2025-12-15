## Server and Test Command Policy
**IMPORTANT:** Do NOT start servers or run test commands unless explicitly requested by the user.

- NEVER automatically run `npm start`, `npm run dev`, `node server.js`, or any server startup commands
- NEVER automatically run `npm test`, `npm run test`, or any testing commands
- Only execute these commands when the user specifically asks you to do so
- The user will manage server startup and testing on their own unless they request your help

## Commit Message Format
Follow conventional commits format: `type(scope): description`

**Types:**
- `feat`: new feature or functionality
- `fix`: bug fix or error correction
- `refactor`: code restructuring without changing behavior

**Scopes:**
Use specific service/module names: `Midjourney`, `translator`, `shopify`, `webhooks`, `pinterest`, `database`, `docker`, `cors`, `backlinks`, `command`, `product`, `translation`, etc.

**Description:**
- Use lowercase
- Be concise and action-oriented
- Describe what changed, not how it was implemented
- Examples:
  - `fix(Midjourney): clean low-quality backgrounds and improve SEO content generation`
  - `feat(webhooks): implement tapestry model copying similar to paintings`
  - `refactor(database): remove variants table and related painting system`
