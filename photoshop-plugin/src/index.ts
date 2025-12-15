import { WebSocketClient, WebSocketMessage, NewJobMessage, LogLevel } from './websocket-client'

// UI Elements
const statusIndicator = document.getElementById('statusIndicator') as HTMLDivElement
const statusText = document.getElementById('statusText') as HTMLSpanElement
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement
const logsContainer = document.getElementById('logsContainer') as HTMLDivElement
const clearLogsBtn = document.getElementById('clearLogsBtn') as HTMLButtonElement
const jobsReceivedEl = document.getElementById('jobsReceived') as HTMLDivElement
const jobsCompletedEl = document.getElementById('jobsCompleted') as HTMLDivElement

// Stats
let jobsReceived = 0
let jobsCompleted = 0

// WebSocket Client
let wsClient: WebSocketClient | null = null

/**
 * Initialize the plugin
 */
function init() {
  // Setup event listeners
  connectBtn.addEventListener('click', handleConnectClick)
  clearLogsBtn.addEventListener('click', clearLogs)

  addLog('info', 'Plugin initialized. Click "Connect to Server" to start.')
}

/**
 * Handle connect/disconnect button click
 */
function handleConnectClick() {
  if (wsClient && wsClient.isConnected()) {
    // Disconnect
    wsClient.disconnect()
    wsClient = null
  } else {
    // Connect
    connectToServer()
  }
}

/**
 * Connect to WebSocket server
 */
function connectToServer() {
  wsClient = new WebSocketClient({
    url: 'ws://localhost:8081',
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onMessage: handleMessage,
    onError: handleError,
    onLog: addLog,
  })

  wsClient.connect()
}

/**
 * Handle WebSocket connection
 */
function handleConnect() {
  updateConnectionStatus(true)
  addLog('success', 'Connected to server! Ready to receive jobs.')
}

/**
 * Handle WebSocket disconnection
 */
function handleDisconnect() {
  updateConnectionStatus(false)
  addLog('warning', 'Disconnected from server.')
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(message: WebSocketMessage) {
  switch (message.type) {
    case 'connected':
      addLog('info', 'Server acknowledged connection')
      break

    case 'new_job':
      handleNewJob(message as NewJobMessage)
      break

    case 'job_completed':
      addLog('success', `Job ${message.jobId} completed successfully`)
      break

    case 'job_failed':
      addLog('error', `Job ${message.jobId} failed: ${message.error}`)
      break

    default:
      addLog('info', `Received: ${message.type}`)
  }
}

/**
 * Handle new job message
 */
function handleNewJob(message: NewJobMessage) {
  jobsReceived++
  updateStats()

  addLog('info', `New job received: ${message.job.productTitle}`)
  addLog('info', `Job ID: ${message.job.id}`)
  addLog('info', `Product: ${message.job.productId}`)

  // For Phase 4, we just log the job
  // Phase 5 will implement actual mockup processing
  addLog('warning', 'Phase 4: Job received but processing not yet implemented')

  // Simulate processing for testing Phase 4
  setTimeout(() => {
    if (wsClient && wsClient.isConnected()) {
      wsClient.send({
        type: 'job_completed',
        jobId: message.job.id,
        resultPath: `/test-result-${message.job.productId}.jpg`,
      })
      jobsCompleted++
      updateStats()
      addLog('success', `Simulated completion for job ${message.job.id}`)
    }
  }, 2000)
}

/**
 * Handle WebSocket error
 */
function handleError(error: Error) {
  addLog('error', `Connection error: ${error.message}`)
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(connected: boolean) {
  if (connected) {
    statusIndicator.className = 'status-indicator connected'
    statusText.textContent = 'Connected'
    connectBtn.textContent = 'Disconnect'
    connectBtn.className = 'button secondary'
  } else {
    statusIndicator.className = 'status-indicator disconnected'
    statusText.textContent = 'Disconnected'
    connectBtn.textContent = 'Connect to Server'
    connectBtn.className = 'button primary'
  }
}

/**
 * Update statistics display
 */
function updateStats() {
  jobsReceivedEl.textContent = jobsReceived.toString()
  jobsCompletedEl.textContent = jobsCompleted.toString()
}

/**
 * Add log entry to UI
 */
function addLog(level: LogLevel, message: string) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false })

  const logEntry = document.createElement('div')
  logEntry.className = 'log-entry'

  logEntry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-level ${level}">${level.toUpperCase()}</span>
    <span class="log-message">${message}</span>
  `

  logsContainer.appendChild(logEntry)

  // Auto-scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight

  // Limit log entries to 100
  if (logsContainer.children.length > 100) {
    logsContainer.removeChild(logsContainer.firstChild!)
  }
}

/**
 * Clear all logs
 */
function clearLogs() {
  logsContainer.innerHTML = ''
  addLog('info', 'Logs cleared')
}

// Initialize plugin when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
