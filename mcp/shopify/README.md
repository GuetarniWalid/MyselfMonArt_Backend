# Shopify MCP Server

Model Context Protocol (MCP) server for Shopify Admin API integration with Claude (web, mobile, desktop).

## Overview

This module provides 80 tools for Shopify store management:
- Products & Inventory management
- Orders & Fulfillment
- Customers & B2B
- Analytics & Reporting
- Marketing & Discounts
- File & Media upload (Files library)

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

### Scopes NOT granted on the production app (2026-08-03)

These tools are wired and tested but answer "access denied" until the scope is
added in *Settings → Apps and sales channels → Develop apps → (app) →
Configuration → Admin API integration*, then the app is re-installed/updated.
The existing `shpat_` token stays valid and simply gains the scope.

| Scope | Unlocks |
|-------|---------|
| `write_discounts` | `createDiscountCode` — reading discounts already works via `read_discounts` |
| `read_marketing_events` | `getMarketingReport` (marketing activities) |
| `read_apps` | `listInstalledApps` |
| `read_locations` | location names inside `getShippingZones` (dropped from the query, not needed for rates) |

A missing scope is reported as an explicit `MISSING SCOPE` message naming the
scope and the admin path — it is never returned as an empty result set.

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
