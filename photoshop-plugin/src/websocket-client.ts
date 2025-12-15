export type MessageType = 'connected' | 'new_job' | 'job_completed' | 'job_failed'

export interface WebSocketMessage {
  type: MessageType
  [key: string]: any
}

export interface Job {
  id: string
  productId: string
  productTitle: string
  imageUrl: string
}

export interface NewJobMessage extends WebSocketMessage {
  type: 'new_job'
  job: Job
}

export type LogLevel = 'info' | 'success' | 'error' | 'warning'

export interface WebSocketClientOptions {
  url: string
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
  onLog?: (level: LogLevel, message: string) => void
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private options: WebSocketClientOptions
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private isManualDisconnect = false

  constructor(options: WebSocketClientOptions) {
    this.options = options
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.log('warning', 'Already connected to WebSocket server')
      return
    }

    this.isManualDisconnect = false
    this.log('info', `Connecting to ${this.options.url}...`)

    try {
      this.ws = new WebSocket(this.options.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.log('success', 'Connected to WebSocket server')
        this.options.onConnect?.()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.log('info', `Received: ${message.type}`)
          this.options.onMessage?.(message)
        } catch (error) {
          this.log('error', `Failed to parse message: ${error.message}`)
        }
      }

      this.ws.onerror = (_event) => {
        const error = new Error('WebSocket error occurred')
        this.log('error', error.message)
        this.options.onError?.(error)
      }

      this.ws.onclose = () => {
        this.log('warning', 'Disconnected from WebSocket server')
        this.options.onDisconnect?.()

        // Auto-reconnect if not manually disconnected
        if (!this.isManualDisconnect) {
          this.attemptReconnect()
        }
      }
    } catch (error) {
      this.log('error', `Failed to connect: ${error.message}`)
      this.options.onError?.(error)
    }
  }

  disconnect(): void {
    this.isManualDisconnect = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.log('info', 'Manually disconnected')
    }
  }

  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log('error', 'Cannot send message: Not connected')
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
      this.log('info', `Sent: ${message.type}`)
    } catch (error) {
      this.log('error', `Failed to send message: ${error.message}`)
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('error', 'Max reconnection attempts reached. Please reconnect manually.')
      return
    }

    this.reconnectAttempts++
    this.log(
      'warning',
      `Reconnecting in ${this.reconnectDelay / 1000}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    )

    setTimeout(() => {
      this.connect()
    }, this.reconnectDelay)
  }

  private log(level: LogLevel, message: string): void {
    this.options.onLog?.(level, message)
  }
}
