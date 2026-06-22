# Plan d'implémentation — Canal email pour l'agent SAV

> Validé le 2026-06-03. Étend le pipeline SAV existant (`InboxProcessor` →
> `ConversationAgent`), aujourd'hui branché sur Instagram/Messenger uniquement,
> à un nouveau canal `email` (Gmail). On réutilise tout le cerveau existant
> (produits, commandes, livraison, escalade, spam, voix de marque).

## Principe directeur

On n'invente rien de neuf : on ajoute un canal `email` au pipeline. On greffe
seulement : **lecture Gmail**, **rendu/brouillon email**, **2 nouveaux outils**
(modif d'adresse + recherche d'anciens mails) et un **tri amont**.

## Décisions techniques arrêtées

1. **Étendre le backend**, pas d'agent Claude planifié séparé (éviter la
   duplication et garder le filet de sécurité du pipeline).
2. **Transport = API Gmail (`googleapis`)**, pas Resend : il faut créer des
   *brouillons* dans la boîte et *threader* dans le fil du client. Resend reste
   uniquement pour les notifs d'escalade internes (`EscalationMailer`, inchangé).
   SMTP est exclu (DigitalOcean bloque le SMTP sortant).
3. **Ingestion = push Gmail (`users.watch` + Pub/Sub)** pour de l'instantané.
   Filet de sécurité : renouvellement quotidien du `watch` (expire à 7 jours) +
   `SweepInbox` existant (déjà channel-agnostique).
4. **Brouillon d'abord** (`status: 'drafted'`), puis bascule auto par catégorie
   plus tard via `config/savAgent.ts`.
5. **Cartes produits en email = rendu HTML** (image + titre + lien, CTA en
   bouton) dans le corps du brouillon.
6. Boîte servie : **team@myselfmonart.com** (Google **Workspace**), sender en
   dur OK.

## ⚠️ Prérequis bloquant — re-consentement OAuth Gmail

Le `GMAIL_REFRESH_TOKEN` actuel a le scope `gmail.send` **uniquement**. Le canal
email exige `gmail.modify` (lecture + labels + brouillons + envoi + watch).
- Scope changé dans `mcp/gmail/setup-oauth.js` → `gmail.modify`.
- Re-consentement via `npm run setup` (serveur localhost:3000) → nouveau
  `GMAIL_REFRESH_TOKEN` → `.env` + vault + prod.

## Phasage

### Phase 0 — Re-consentement OAuth
Scope élargi → nouveau refresh token → `env.ts` + vault + prod. **Bloquant.**

### Phase 1 — Socle « canal email » (lecture + brouillon)

| Fichier | Action |
|---|---|
| `env.ts` | Déclarer `GMAIL_REFRESH_TOKEN`, `BUSINESS_EMAIL`, `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUBSUB_VERIFICATION_TOKEN` |
| `app/Services/Gmail/index.ts` *(nouveau)* | Client Gmail TS (`googleapis`) : `watch()`, `historyList()`, `getMessage()` (parse headers + corps multipart, nettoie le cité), `createDraft()`, `searchSentMail()`, `markRead()/addLabel()` |
| `app/Models/InboxMessage.ts` | `InboxChannel` += `'email'` ; `InboxStatus` += `'drafted'` |
| `app/Models/Conversation.ts` | `ConversationChannel` += `'email'` |
| `database/migrations/xxxx_add_drafted_status.ts` *(nouveau)* | `ALTER` enum `inbox_messages.status` → ajouter `'drafted'` (channel est `varchar(20)` → rien à faire) |
| `app/Controllers/Http/EmailInboxController.ts` *(nouveau)* | Webhook Pub/Sub : vérifie le token, décode le message (emailAddress + historyId), `historyList` depuis le dernier historyId, persiste les `InboxMessage(channel:'email')`, déclenche le processor (fire-and-forget, même pattern que Meta) |
| `start/routes.ts` | `POST /webhooks/email` → `EmailInboxController.receive` |
| `app/Tasks/RenewGmailWatch.ts` *(nouveau)* | Cron quotidien : ré-arme `users.watch` (expire à 7j) |
| `app/Services/InboxProcessor.ts` | Branches `email` : `extractText`, `isOwnMessage` (== `BUSINESS_EMAIL`), `isOutsideReplyWindow` (→ `false`), `getOrCreateConversation` (threadId = threadId Gmail). Dispatch : email → `EmailReplySender` crée un **brouillon** → statut `'drafted'` |
| `app/Services/EmailReplySender/index.ts` *(nouveau)* | HTML (texte + cartes produits + CTA), threading `In-Reply-To`/`References`/`threadId`, crée le brouillon. Param `mode: 'draft' \| 'send'` (Phase 4) |
| `app/Services/EscalationMailer.ts` | `buildInboxUrl` : branche `email` (lien profond fil Gmail) |

Anti-boucle : on n'ingère que `INBOX`, jamais `SENT` ; `isOwnMessage` filtre
l'adresse business ; idempotence `(channel, external_message_id)` + label Gmail.

### Phase 2 — Agent SAV adapté à l'email

| Fichier | Action |
|---|---|
| `app/Services/ConversationAgent/prompts/system.ts` | `buildSystemPrompt(channel)` : email = objet + signature autorisés, format plus long, liens produits dans le corps |
| `app/Services/Shopify/Order.ts` | `updateShippingAddress(orderId, address)` : re-query du fulfillment d'abord, refus si expédiée/annulée, mutation `orderUpdate`, gestion `userErrors` |
| `app/Services/ConversationAgent/tools/updateOrderAddress.ts` *(nouveau)* | Outil encadré : identité vérifiée + avant expédition + log d'audit. **En phase brouillon : escalade au lieu d'exécuter.** |
| `config/savAgent.ts` *(nouveau)* | Map `catégorie → mode ('draft' \| 'auto')`. Démarrage : tout en `draft` |

### Phase 3 — Tri amont + canal backlinks

| Fichier | Action |
|---|---|
| `app/Services/EmailTriage/index.ts` *(nouveau)* | Classifieur léger (Haiku) : `client_sav` / `backlink` / `pro_autre` / `spam_demarchage` / `ignore`. Filtrage Gmail au push en amont |
| `app/Services/BacklinkAgent/` *(nouveau)* | Prompt dédié + outil `findPastOutreach({sujet})` (recherche les « Envoyés » pour tarifs/templates). Brouillon only, jamais d'envoi auto |

### Phase 4 — Bascule progressive vers l'auto-send *(plus tard)*
`config/savAgent.ts` : passer `client_sav` (produits/livraison/suivi) en `'auto'`,
activer l'exécution réelle de la modif d'adresse. Garder backlinks / litiges /
changements d'adresse sensibles en brouillon/escalade.

## Risques principaux
1. **OAuth scope** (Phase 0) — bloquant, action manuelle.
2. **Parsing du corps email** (multipart, HTML, texte cité/signatures).
3. **Boucle d'auto-réponse** — mitigée (INBOX-only + filtre adresse + idempotence + label).
4. **Modif d'adresse** — garde-fous stricts + escalade en phase brouillon.
5. **Pub/Sub** — endpoint public requis (déjà le cas, webhook Meta sur le même serveur) + renouvellement du `watch`.
