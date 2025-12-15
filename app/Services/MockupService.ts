import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'

export interface MockupJob {
  id: string
  productId: string
  productTitle: string
  imageUrl: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  resultPath?: string
  error?: string
  createdAt: Date
  completedAt?: Date
}

export default class MockupService {
  private jobs: Map<string, MockupJob> = new Map()
  private wsServer: WebSocket.Server | null = null
  private connectedClients: Set<WebSocket> = new Set()

  /**
   * Initialize the WebSocket server
   */
  public initializeWebSocketServer(port: number = 8081) {
    // Create standalone WebSocket server on specified port
    this.wsServer = new WebSocket.Server({ port })

    this.wsServer.on('connection', (ws: WebSocket) => {
      console.log('🔌 Photoshop plugin connected via WebSocket')
      this.connectedClients.add(ws)

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString())
          this.handleMessage(ws, data)
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error)
        }
      })

      ws.on('close', () => {
        console.log('🔌 Photoshop plugin disconnected')
        this.connectedClients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        this.connectedClients.delete(ws)
      })

      // Send initial connection success message
      ws.send(
        JSON.stringify({
          type: 'connected',
          message: 'Successfully connected to MockupService',
        })
      )
    })

    console.log(`✅ WebSocket server initialized on port ${port}`)
  }

  /**
   * Handle incoming messages from WebSocket clients
   */
  private handleMessage(ws: WebSocket, data: any) {
    console.log('📩 Received message:', data)

    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }))
        break

      case 'job_completed':
        this.handleJobCompleted(data.jobId, data.resultPath)
        break

      case 'job_failed':
        this.handleJobFailed(data.jobId, data.error)
        break

      default:
        console.log('⚠️  Unknown message type:', data.type)
    }
  }

  /**
   * Create a new mockup job
   */
  public createJob(productId: string, productTitle: string, imageUrl: string): MockupJob {
    const job: MockupJob = {
      id: uuidv4(),
      productId,
      productTitle,
      imageUrl,
      status: 'pending',
      createdAt: new Date(),
    }

    this.jobs.set(job.id, job)
    console.log(`📝 Created job ${job.id} for product: ${productTitle}`)

    return job
  }

  /**
   * Send a job to connected Photoshop clients
   */
  public sendJobToPhotoshop(job: MockupJob): boolean {
    if (this.connectedClients.size === 0) {
      console.error('❌ No Photoshop clients connected')
      return false
    }

    job.status = 'processing'
    this.jobs.set(job.id, job)

    const message = JSON.stringify({
      type: 'new_job',
      job: {
        id: job.id,
        productId: job.productId,
        productTitle: job.productTitle,
        imageUrl: job.imageUrl,
      },
    })

    // Send to all connected clients (usually just one)
    this.connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
        console.log(`📤 Sent job ${job.id} to Photoshop client`)
      }
    })

    return true
  }

  /**
   * Handle job completion
   */
  private handleJobCompleted(jobId: string, resultPath: string) {
    const job = this.jobs.get(jobId)
    if (!job) {
      console.error(`❌ Job ${jobId} not found`)
      return
    }

    job.status = 'completed'
    job.resultPath = resultPath
    job.completedAt = new Date()
    this.jobs.set(jobId, job)

    console.log(`✅ Job ${jobId} completed: ${resultPath}`)
  }

  /**
   * Handle job failure
   */
  private handleJobFailed(jobId: string, error: string) {
    const job = this.jobs.get(jobId)
    if (!job) {
      console.error(`❌ Job ${jobId} not found`)
      return
    }

    job.status = 'failed'
    job.error = error
    job.completedAt = new Date()
    this.jobs.set(jobId, job)

    console.error(`❌ Job ${jobId} failed: ${error}`)
  }

  /**
   * Get job status
   */
  public getJob(jobId: string): MockupJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Get all jobs
   */
  public getAllJobs(): MockupJob[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Check if any clients are connected
   */
  public hasConnectedClients(): boolean {
    return this.connectedClients.size > 0
  }

  /**
   * Get number of connected clients
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size
  }

  /**
   * Close the WebSocket server
   */
  public closeServer() {
    if (this.wsServer) {
      console.log('🔌 Closing WebSocket server...')
      this.connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close()
        }
      })
      this.wsServer.close(() => {
        console.log('✅ WebSocket server closed')
      })
      this.wsServer = null
      this.connectedClients.clear()
    }
  }
}
