# Shopify MCP Server

Model Context Protocol (MCP) server for Shopify Admin API integration with Claude (web, mobile, desktop).

## Overview

This module provides 85 tools for Shopify store management:
- Products & Inventory management
- Orders & Fulfillment
- Customers & B2B
- Analytics & Reporting
- Marketing & Discounts
- File & Media upload (Files library)
- Legal policies & translations (see below)

## Mode: Authless

This server runs in **authless mode** - Shopify credentials are configured on the server, not passed by clients. This enables compatibility with Claude web, mobile, and desktop apps.

## Integration

Deployed as part of the MyselfMonArt infrastructure:
- Docker image built via `mcp/shopify/Dockerfile`
- Runs on port 3001 internally
- Accessible via `https://backend.myselfmonart.com/mcp/shopify/`
- Routed through nginx

## Server Configuration

Shopify credentials are set via environment variables on the server:

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_STORE_DOMAIN` | Yes | Your Shopify store domain (e.g., `my-store.myshopify.com`) |
| `SHOPIFY_ACCESS_TOKEN` | Yes | Admin API access token (starts with `shpat_`) |
| `SHOPIFY_API_VERSION` | No | API version (optional) |
| `TRANSPORT_MODE` | No | `stdio` (default) or `sse` |
| `PORT` | No | HTTP port for SSE mode (default: 3001) |

## Claude Web/Mobile Configuration

Add as a custom connector in Claude settings:

| Field | Value |
|-------|-------|
| **Name** | `Shopify` |
| **Remote MCP server URL** | `https://backend.myselfmonart.com/mcp/shopify/mcp` |
| **OAuth Client ID** | *(leave empty)* |
| **OAuth Client Secret** | *(leave empty)* |

> **Note:** Use `/mcp` endpoint (Streamable HTTP), not `/sse` (legacy SSE transport).

## Endpoints

- `GET /sse` - SSE connection endpoint (legacy transport)
- `POST /messages?sessionId={id}` - Message endpoint
- `ALL /mcp` - Streamable HTTP endpoint (modern transport)
- `GET /health` - Health check

## Local Development

```bash
cd mcp/shopify
npm install
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com SHOPIFY_ACCESS_TOKEN=shpat_xxx npm start
```

## API Scopes Required

Configure your Shopify app with these scopes:
- `read_products`, `write_products` (covers create/update/delete of collections too)
- `read_orders`
- `read_customers`
- `read_inventory`, `write_inventory`
- `read_analytics`, `read_reports`
- `write_files` (required for `uploadFile` / `createFile` / `createStagedUpload`)
- `read_publications`, `write_publications` (required to publish/unpublish a collection — the `published` flag of `createCollection` / `updateCollection`, and the `publishedOnOnlineStore` field of `getCollection`)
- `read_shipping` (required for `getShippingZones`)

### Scopes NOT granted on the production app (re-checked 2026-08-04)

Verified by querying `currentAppInstallation { accessScopes }` with the production
token — not from memory. 54 scopes granted. `write_discounts`,
`read_marketing_events`, `read_apps` (missing in the 2026-08-03 audit) and
`read_locales` (granted the same day, `listShopLocales` confirmed working against
the production endpoint) have all since been added. One remains:

| Scope | Unlocks |
|-------|---------|
| `read_locations` | location names inside `getShippingZones` (dropped from the query, not needed for rates) |

Add it in *Settings → Apps and sales channels → Develop apps → (app) →
Configuration → Admin API integration*, then re-install/update the app. The
existing `shpat_` token stays valid and simply gains the scope.

Already granted and used by the policy/translation tools: `read_legal_policies`,
`write_legal_policies`, `read_translations`, `write_translations`, `read_locales`.

A missing scope is reported as an explicit `MISSING SCOPE` message naming the
scope and the admin path — it is never returned as an empty result set.

## Legal policies & translations

Five tools cover the "edit a legal text, then publish it in every language" loop
that otherwise means copy-pasting into the admin five times.

| Tool | What it does |
|------|--------------|
| `getShopPolicies` | Every policy with its **full HTML body**, plus `absentTypes` (types the shop does not have) and `isEmpty` (present but blank) |
| `updateShopPolicy` | Rewrites one policy body — always returns `previousBody` for diff/rollback |
| `getTranslatableContent` | Source content + the `digest` every translation must be bound to (any resource GID, not just policies) |
| `registerTranslations` | Publishes translations, refusing stale/missing digests before the write |
| `listShopLocales` | Published/primary locales — `fr` primary, `en`/`de`/`es`/`nl` published, none unpublished |

### The ordering rule

A translation is bound to a **digest of the source text**, so editing the source
invalidates every digest attached to it:

1. `updateShopPolicy` — write the new source body
2. `getTranslatableContent` — re-read the digests, they just changed
3. `registerTranslations` — publish with the fresh digests

Both failure modes of the reverse order were measured on this store (2026-08-04,
on a throwaway unpublished page, since deleted):

- Translating **before** the source edit: the translation is stored fine, then the
  source edit silently flips it to `outdated: true` — Translate & Adapt shows it
  as needing review.
- Reusing a digest read **before** the edit: hard rejection with
  `INVALID_TRANSLATABLE_CONTENT` / *"Translatable content hash is invalid"*, and
  nothing is written. A digest is valid for exactly one version of the source.

`registerTranslations` re-reads the live digests and refuses the call itself if
one is stale or missing, quoting the fresh digest so the retry is immediate.

### Verified API facts (2025-10, this store)

- `shop.privacyPolicy` / `shop.refundPolicy` / … **do not exist**. The only entry
  point is the `shop.shopPolicies` list.
- `shopPolicyUpdate` takes `ShopPolicyInput { type, body }` — **no `id` argument**.
  `updateShopPolicy` accepts a GID and resolves it to its type.
- Shop policies **are** translatable resources (`SHOP_POLICY`); their single
  translatable key is **`body`**, of type HTML. Source locale is `fr`.
- A policy with an empty body is **still** translatable (valid digest over the
  empty string) — but it is omitted from the `translatableResources(SHOP_POLICY)`
  *list*, so query it by GID via `translatableResource`.
- Locales (confirmed via `shopLocales` once `read_locales` was granted): `fr`
  **primary**, plus `en`, `de`, `es`, `nl` — all five published, none unpublished.
  Matches the earlier write-probe, where `it`, `pt` and `ja` were rejected with
  `INVALID_LOCALE_FOR_SHOP`.
- `shopPolicyUpdate` works on **Basic** — no plan restriction observed.
- **Body limit: 512 KB.** Measured on the (empty) shipping policy, restored after:
  600 000 chars → `TOO_BIG` *"Body is too big (maximum is 512 KB)"*, nothing
  written; 300 000 chars accepted. `TOO_BIG` is the only value of
  `ShopPolicyErrorCode`. For scale, the longest policy on this shop is 27 509 chars.
- **The body is stored verbatim — Shopify does not sanitise it.** A probe
  containing `<script>`, `<iframe>`, `<style>`, `<form>`, `javascript:` hrefs,
  `onclick`/`onerror` handlers, `data-*` attributes and a custom element came back
  byte-identical (464/464 chars). Sanitise before writing.

## Marketing: what the Admin API does and does not expose

- **Campaigns / activities** — `getMarketingReport` (`marketingActivities`). App- and
  channel-driven campaigns, with status, tactic, channel, UTMs, budget, ad spend.
- **Automations** — **not exposed at all.** The 2025-10 Admin API schema contains no
  automation type (searching the full type list for `Automation` returns only
  discount types). Shopify Email automations — admin → Marketing → Automations,
  e.g. a welcome email — are not marketing activities and have no Admin API
  resource. Whether such an automation exists and is active can only be checked
  by hand in the Shopify admin. `getMarketingReport` says so explicitly rather
  than returning a misleading empty list.

## Customer filtering: two different query languages

`listCustomers` and `listCustomerSegments` do **not** share a syntax, which is the
usual cause of a filter that "seems ignored":

| | `listCustomers` (search syntax) | segments (`listCustomerSegments`) |
|---|---|---|
| marketing opt-in | `email_marketing_state:subscribed` | `email_subscription_status = 'SUBSCRIBED'` |
| order count | `orders_count:>1` | `number_of_orders > 1` |
| signup date | `customer_date:>2026-01-01` | `customer_added_date >= -30d` |
| spend | `total_spent:>100` | `amount_spent > 100` |

Shopify **silently ignores** an unsupported key in the customers search: the call
returns 200 with a full, unfiltered list. `listCustomers` therefore checks the
keys and returns a `warnings` array when a filter will not be applied.

Two more traps, both verified against the live store:
- `Customer.state` (ENABLED/DISABLED/INVITED) is the **account** state and says
  nothing about marketing. Opt-in is `emailMarketingConsent.marketingState`.
- `customersCount` accepts a `query` argument and **ignores it**, returning the
  store total for every filter. For the size of a filtered list use
  `listCustomerSegments` (member counts) instead.

`CustomerSortKeys` has no `TOTAL_SPENT`; ranking by spend goes through
`getCustomerAnalytics`, which sorts across the whole customer base.

## File upload

Three tools for the Shopify Files library, mirroring the official GraphQL Admin API:

| Tool | Level | Use case |
|------|-------|----------|
| `uploadFile` | High-level | Upload a base64 payload in one call. Runs `stagedUploadsCreate` → multipart POST → `fileCreate` internally. |
| `createStagedUpload` | Low-level | Just create staged upload targets (`stagedUploadsCreate`). |
| `createFile` | Low-level | Register a file in Shopify (`fileCreate`) from a public URL or a `resourceUrl` returned by `createStagedUpload`. |

`uploadFile` expects raw base64 (no `data:` URI prefix). For images use `resource: "IMAGE"` so Shopify creates a `MediaImage` (CDN URL + dimensions); for PDFs and other binaries keep the default `FILE` (creates a `GenericFile`).

## Security Note

In authless mode, anyone with the MCP URL can access your Shopify store data. Consider:
- Restricting access via firewall/VPN if needed
- Using this only for trusted environments
- Monitoring API usage in Shopify admin
