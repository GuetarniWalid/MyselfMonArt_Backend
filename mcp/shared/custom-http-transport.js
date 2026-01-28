/**
 * Custom Streamable HTTP Transport for MCP - No Accept Header Validation
 *
 * This transport implements the MCP Transport interface but WITHOUT
 * the strict Accept header validation that causes 406 errors with Claude.ai web.
 *
 * Usage:
 *   import { createMcpExpressHandler } from '../shared/custom-http-transport.js'
 *
 *   // Create your MCP server factory
 *   const createServer = () => {
 *     const server = new McpServer({ name: 'my-server', version: '1.0.0' })
 *     server.tool('myTool', { ... }, async (args) => { ... })
 *     return server
 *   }
 *
 *   // Create the Express handler
 *   const { handler } = createMcpExpressHandler({ createServer })
 *
 *   app.all('/mcp', handler)
 */

import { randomUUID } from 'crypto'

// Default session TTL: 1 hour
const DEFAULT_SESSION_TTL_MS = 3600000

/**
 * Custom HTTP Transport that implements MCP Transport interface
 * without Accept header validation
 */
export class CustomMcpTransport {
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

  async start() {
    // No-op for HTTP transport
  }

  async close() {
    if (this._closeHandler) this._closeHandler()
    if (this._sseRes) {
      try {
        this._sseRes.end()
      } catch (e) {
        // Connection already closed
      }
      this._sseRes = null
    }
  }

  // Called by McpServer to send responses/notifications
  async send(message) {
    // If this is a response (has id) and we have a pending callback, use it
    if (message.id !== undefined && this._pendingResponses.has(message.id)) {
      const callback = this._pendingResponses.get(message.id)
      this._pendingResponses.delete(message.id)
      callback(message)
    }
    // Also send to SSE if connected (for server-initiated notifications)
    if (this._sseRes && !this._sseRes.writableEnded) {
      try {
        this._sseRes.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
      } catch (e) {
        // SSE connection closed
        this._sseRes = null
      }
    }
  }

  /**
   * Handle incoming JSON-RPC message
   * - Requests (with id): returns a Promise that resolves to the response
   * - Notifications (without id): returns null immediately (no response expected)
   */
  handleMessage(jsonRpcMessage) {
    // JSON-RPC Notification: no id field = no response expected
    // Per spec: "The Server MUST NOT reply to a Notification"
    if (jsonRpcMessage.id === undefined) {
      // Just pass to handler, don't wait for response
      if (this._messageHandler) {
        this._messageHandler(jsonRpcMessage)
      }
      return null
    }

    // JSON-RPC Request: has id = response expected
    return new Promise((resolve, reject) => {
      // Timeout after 30 seconds
      const timeout = setTimeout(() => {
        this._pendingResponses.delete(jsonRpcMessage.id)
        reject(new Error(`Request timeout for method: ${jsonRpcMessage.method}`))
      }, 30000)

      this._pendingResponses.set(jsonRpcMessage.id, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })

      // Pass to McpServer
      if (this._messageHandler) {
        this._messageHandler(jsonRpcMessage)
      } else {
        // No handler connected - this shouldn't happen
        clearTimeout(timeout)
        this._pendingResponses.delete(jsonRpcMessage.id)
        reject(new Error('Transport not connected to server'))
      }
    })
  }

  // Set SSE response for server-initiated messages
  setSseResponse(res) {
    this._sseRes = res
  }
}

/**
 * Creates an Express handler for MCP HTTP requests
 *
 * @param {Object} options
 * @param {Function} options.createServer - Function that returns a configured McpServer
 * @param {Function} [options.sessionIdGenerator] - Custom session ID generator
 * @param {number} [options.sessionTtlMs] - Session TTL in milliseconds (default: 1 hour)
 * @returns {{ handler: Function, sessions: Map }}
 */
export function createMcpExpressHandler(options) {
  const {
    createServer,
    sessionIdGenerator = () => randomUUID(),
    sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  } = options

  // Store active sessions
  const sessions = new Map()

  // Cleanup expired sessions every minute
  setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > sessionTtlMs) {
        console.log(`MCP session expired: ${id}`)
        session.transport.close()
        sessions.delete(id)
      }
    }
  }, 60000)

  const handler = async (req, res) => {
    // NO Accept header validation - this is the key difference from the SDK!
    console.log(`MCP ${req.method} request, Accept: ${req.headers['accept'] || 'none'}`)

    try {
      // CORS preflight
      if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
      }

      const sessionId = req.headers['mcp-session-id']

      // DELETE - terminate session
      if (req.method === 'DELETE') {
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)
          await session.transport.close()
          sessions.delete(sessionId)
          console.log(`MCP session terminated: ${sessionId}`)
        }
        res.status(204).end()
        return
      }

      // GET - SSE stream for server notifications
      if (req.method === 'GET') {
        if (!sessionId || !sessions.has(sessionId)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid or missing session ID' },
            id: null,
          })
          return
        }

        const session = sessions.get(sessionId)
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
          if (sessions.has(sessionId)) {
            sessions.get(sessionId).transport.setSseResponse(null)
          }
        })
        return
      }

      // POST - JSON-RPC messages
      if (req.method === 'POST') {
        // Read body
        let body = req.body
        if (!body || Object.keys(body).length === 0) {
          const chunks = []
          for await (const chunk of req) {
            chunks.push(chunk)
          }
          const rawBody = Buffer.concat(chunks).toString()

          // Parse JSON with error handling
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

        // Existing session?
        if (sessionId && sessions.has(sessionId)) {
          session = sessions.get(sessionId)
          session.lastActivity = Date.now()
        } else if (body.method === 'initialize') {
          // New session
          const newSessionId = sessionIdGenerator()
          const transport = new CustomMcpTransport(newSessionId)
          const server = createServer()

          await server.connect(transport)

          session = {
            id: newSessionId,
            transport,
            server,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          }
          sessions.set(newSessionId, session)
          console.log(`MCP new session: ${newSessionId}`)
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Bad Request: Server not initialized' },
            id: body.id || null,
          })
          return
        }

        // Process message (request or notification)
        const response = await session.transport.handleMessage(body)

        // If it was a notification (no id), response is null - just acknowledge
        if (response === null) {
          res.status(202).end() // 202 Accepted for notifications
          return
        }

        // Set session ID header for initialize
        if (body.method === 'initialize') {
          res.setHeader('Mcp-Session-Id', session.id)
        }

        // Send response as SSE event (MCP protocol format)
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
  }

  return { handler, sessions }
}
