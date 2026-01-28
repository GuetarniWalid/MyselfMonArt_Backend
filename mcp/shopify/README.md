# Shopify MCP Server

Model Context Protocol (MCP) server for Shopify Admin API integration with Claude (web, mobile, desktop).

## Overview

This module provides 70+ tools for Shopify store management:
- Products & Inventory management
- Orders & Fulfillment
- Customers & B2B
- Analytics & Reporting
- Marketing & Discounts

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
- `read_products`, `write_products`
- `read_orders`
- `read_customers`
- `read_inventory`, `write_inventory`
- `read_analytics`, `read_reports`

## Security Note

In authless mode, anyone with the MCP URL can access your Shopify store data. Consider:
- Restricting access via firewall/VPN if needed
- Using this only for trusted environments
- Monitoring API usage in Shopify admin
