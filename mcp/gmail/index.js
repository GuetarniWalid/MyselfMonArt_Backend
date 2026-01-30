#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import dotenv from 'dotenv'
import express from 'express'
import { google } from 'googleapis'
import { randomUUID } from 'crypto'
import { GmailClient } from './gmail-client.js'

// Load environment variables
dotenv.config()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN

// Validate that Google credentials are present
function validateGoogleCredentials() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return {
      valid: false,
      error:
        "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être définis dans les variables d'environnement",
    }
  }
  return { valid: true }
}

// Validate refresh token
function validateRefreshToken(token) {
  if (!token) {
    return { valid: false, error: 'GMAIL_REFRESH_TOKEN manquant' }
  }
  return { valid: true }
}

// Create OAuth2 client with refresh token
function createOAuth2Client(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  // Log token refresh events
  oauth2Client.on('tokens', (tokens) => {
    console.log('Access token refreshed')
  })

  return oauth2Client
}

// Create Gmail client
function createGmailClient(refreshToken) {
  const oauth2Client = createOAuth2Client(refreshToken)
  return new GmailClient(oauth2Client)
}

// Register the send_email tool
function registerTools(server, gmailClient) {
  server.tool(
    'send_email',
    'Envoyer un email via Gmail',
    {
      to: z.string().email().describe('Adresse email du destinataire'),
      subject: z.string().min(1).describe("Objet de l'email"),
      html_body: z.string().min(1).describe("Contenu HTML complet de l'email"),
      reply_to_message_id: z.string().optional().describe('ID du message original si réponse'),
      thread_id: z.string().optional().describe('ID du thread si réponse à un fil existant'),
    },
    async (args) => {
      try {
        console.log(`[send_email] Envoi d'email à: ${args.to}`)
        console.log(`[send_email] Sujet: ${args.subject}`)

        const result = await gmailClient.sendEmail({
          to: args.to,
          subject: args.subject,
          htmlBody: args.html_body,
          replyToMessageId: args.reply_to_message_id,
          threadId: args.thread_id,
        })

        console.log(`[send_email] Email envoyé avec succès, ID: ${result.messageId}`)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        console.error('[send_email] Erreur:', error.message)
        return {
          content: [
            {
              type: 'text',
              text: `Erreur: ${error.message}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}

// Create MCP server instance
function createMcpServer(gmailClient) {
  const mcpServer = new McpServer({
    name: 'gmail-mcp-server',
    version: '1.0.0',
  })

  registerTools(mcpServer, gmailClient)

  return mcpServer
}

// Main function - SSE mode only
async function main() {
  // Validate Google credentials at startup
  const credentialsValidation = validateGoogleCredentials()
  if (!credentialsValidation.valid) {
    console.error(`Erreur: ${credentialsValidation.error}`)
    process.exit(1)
  }

  const port = parseInt(process.env.PORT || '3002', 10)
  const app = express()
  app.use(express.json({ limit: '5mb' }))

  // Store active transports by session ID
  const transports = new Map()

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'sse', service: 'gmail-mcp-server' })
  })

  // ==========================================================================
  // CUSTOM MCP HTTP ENDPOINT - NO SDK TRANSPORT (NO ACCEPT HEADER VALIDATION)
  // ==========================================================================
  const mcpSessions = new Map()
  const SESSION_TTL_MS = 3600000 // 1 hour

  // Cleanup expired sessions every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of mcpSessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        console.log(`MCP session expired: ${id}`)
        session.transport.close()
        if (session.server && typeof session.server.close === 'function') {
          session.server.close()
        }
        mcpSessions.delete(id)
      }
    }
  }, 60000)

  /**
   * Custom MCP Transport - no Accept header validation
   */
  class CustomMcpTransport {
    constructor(sessionId) {
      this.sessionId = sessionId
      this._messageHandler = null
      this._closeHandler = null
      this._errorHandler = null
      this._pendingResponses = new Map()
      this._sseRes = null
    }

    set onmessage(handler) {
      this._messageHandler = handler
    }
    get onmessage() {
      return this._messageHandler
    }
    set onclose(handler) {
      this._closeHandler = handler
    }
    get onclose() {
      return this._closeHandler
    }
    set onerror(handler) {
      this._errorHandler = handler
    }
    get onerror() {
      return this._errorHandler
    }

    async start() {}

    async close() {
      if (this._closeHandler) this._closeHandler()
      if (this._sseRes) {
        try {
          this._sseRes.end()
        } catch (e) {}
        this._sseRes = null
      }
    }

    async send(message) {
      if (message.id !== undefined && this._pendingResponses.has(message.id)) {
        const callback = this._pendingResponses.get(message.id)
        this._pendingResponses.delete(message.id)
        callback(message)
      }
      if (this._sseRes && !this._sseRes.writableEnded) {
        try {
          this._sseRes.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
        } catch (e) {
          this._sseRes = null
        }
      }
    }

    handleMessage(jsonRpcMessage) {
      if (jsonRpcMessage.id === undefined) {
        if (this._messageHandler) this._messageHandler(jsonRpcMessage)
        return null
      }
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this._pendingResponses.delete(jsonRpcMessage.id)
          reject(new Error(`Request timeout for method: ${jsonRpcMessage.method}`))
        }, 30000)

        this._pendingResponses.set(jsonRpcMessage.id, (response) => {
          clearTimeout(timeout)
          resolve(response)
        })

        if (this._messageHandler) {
          this._messageHandler(jsonRpcMessage)
        } else {
          clearTimeout(timeout)
          this._pendingResponses.delete(jsonRpcMessage.id)
          reject(new Error('Transport not connected to server'))
        }
      })
    }

    setSseResponse(res) {
      this._sseRes = res
    }
  }

  // Main /mcp endpoint handler
  app.all('/mcp', async (req, res) => {
    console.log(`MCP ${req.method} request, Accept: ${req.headers['accept'] || 'none'}`)

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Mcp-Session-Id, X-Gmail-Token, Accept'
    )
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')

    try {
      if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
      }

      const sessionId = req.headers['mcp-session-id']

      // DELETE - terminate session
      if (req.method === 'DELETE') {
        if (sessionId && mcpSessions.has(sessionId)) {
          const session = mcpSessions.get(sessionId)
          await session.transport.close()
          mcpSessions.delete(sessionId)
          console.log(`MCP session terminated: ${sessionId}`)
        }
        res.status(204).end()
        return
      }

      // GET - SSE stream
      if (req.method === 'GET') {
        if (!sessionId || !mcpSessions.has(sessionId)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid or missing session ID' },
            id: null,
          })
          return
        }

        const session = mcpSessions.get(sessionId)
        session.lastActivity = Date.now()

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders()

        session.transport.setSseResponse(res)

        const keepAlive = setInterval(() => {
          if (!res.writableEnded) {
            try {
              res.write(':keepalive\n\n')
            } catch (e) {
              clearInterval(keepAlive)
            }
          }
        }, 30000)

        req.on('close', () => {
          clearInterval(keepAlive)
          if (mcpSessions.has(sessionId)) {
            mcpSessions.get(sessionId).transport.setSseResponse(null)
          }
        })
        return
      }

      // POST - JSON-RPC messages
      if (req.method === 'POST') {
        let body = req.body
        if (!body || Object.keys(body).length === 0) {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const rawBody = Buffer.concat(chunks).toString()
          try {
            body = JSON.parse(rawBody)
          } catch (parseError) {
            res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32700, message: 'Parse error: Invalid JSON' },
              id: null,
            })
            return
          }
        }

        let session

        if (sessionId && mcpSessions.has(sessionId)) {
          session = mcpSessions.get(sessionId)
          session.lastActivity = Date.now()
        } else if (body.method === 'initialize') {
          // Get refresh token from headers OR environment variable (authless mode)
          const refreshToken = req.headers['x-gmail-token'] || GMAIL_REFRESH_TOKEN
          const tokenValidation = validateRefreshToken(refreshToken)
          if (!tokenValidation.valid) {
            res.status(401).json({
              jsonrpc: '2.0',
              error: { code: -32600, message: tokenValidation.error },
              id: body.id || null,
            })
            return
          }

          const newSessionId = randomUUID()
          const transport = new CustomMcpTransport(newSessionId)
          const gmailClient = createGmailClient(refreshToken)
          const server = createMcpServer(gmailClient)

          await server.connect(transport)

          session = {
            id: newSessionId,
            transport,
            server,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          }
          mcpSessions.set(newSessionId, session)
          console.log(`MCP new session: ${newSessionId}`)
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Bad Request: Server not initialized' },
            id: body.id || null,
          })
          return
        }

        const response = await session.transport.handleMessage(body)

        if (response === null) {
          res.status(202).end()
          return
        }

        if (body.method === 'initialize') {
          res.setHeader('Mcp-Session-Id', session.id)
        }

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`)
        res.end()
        return
      }

      res.status(405).json({ error: 'Method not allowed' })
    } catch (error) {
      console.error('MCP error:', error)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: error.message },
          id: null,
        })
      }
    }
  })

  // SSE endpoint for establishing the stream (legacy)
  app.get('/sse', async (req, res) => {
    console.log('Nouvelle connexion SSE établie')

    // Extract refresh token from headers OR environment variable (authless mode)
    const refreshToken = req.headers['x-gmail-token'] || GMAIL_REFRESH_TOKEN

    // Validate refresh token
    const tokenValidation = validateRefreshToken(refreshToken)
    if (!tokenValidation.valid) {
      console.error('Token invalide:', tokenValidation.error)
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: tokenValidation.error }))
      return
    }

    try {
      // Create Gmail client with provided refresh token
      const gmailClient = createGmailClient(refreshToken)

      // Create a new SSE transport
      const transport = new SSEServerTransport('/messages', res)
      const sessionId = transport.sessionId

      // Store the transport
      transports.set(sessionId, transport)

      // Set up cleanup on close
      transport.onclose = () => {
        console.log(`Connexion SSE fermée: ${sessionId}`)
        transports.delete(sessionId)
      }

      // Create a new server instance for this connection
      const mcpServer = createMcpServer(gmailClient)

      // Connect the transport to the server
      await mcpServer.connect(transport)

      // Start the SSE stream
      await transport.start()
    } catch (error) {
      console.error("Erreur lors de l'établissement de la connexion SSE:", error)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end("Erreur lors de l'établissement de la connexion SSE")
      }
    }
  })

  // Messages endpoint for receiving client messages
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId
    if (!sessionId) {
      res.status(400).send('Paramètre sessionId manquant')
      return
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      res.status(404).send('Session non trouvée')
      return
    }

    try {
      await transport.handlePostMessage(req, res, req.body)
    } catch (error) {
      console.error('Erreur lors du traitement du message:', error)
      if (!res.headersSent) {
        res.status(500).send('Erreur lors du traitement du message')
      }
    }
  })

  // Start the HTTP server
  app.listen(port, () => {
    console.log(`Gmail MCP Server (SSE mode) démarré sur le port ${port}`)
    console.log(`Point d'accès SSE: http://localhost:${port}/sse`)
    console.log(`Health check: http://localhost:${port}/health`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('Arrêt du serveur...')
    clearInterval(cleanupInterval)
    // Close legacy SSE transports
    transports.forEach((transport) => transport.close())
    // Close MCP sessions
    mcpSessions.forEach((session) => {
      session.transport.close()
      if (session.server && typeof session.server.close === 'function') {
        session.server.close()
      }
    })
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main()
