// ============================================
// HTTP Polling Client (instead of WebSocket)
// ============================================
class HTTPPollingClient {
  constructor(options) {
    this.options = options
    this.polling = false
    this.pollInterval = null
    this.pollDelay = 2000 // Poll every 2 seconds
    this.serverUrl = 'http://localhost:3333'
  }

  async connect() {
    console.log('HTTPPollingClient.connect() called')

    if (this.polling) {
      this.log('warning', 'Already connected')
      return
    }

    this.log('info', `Connecting to ${this.serverUrl}...`)

    // Test connection first
    try {
      const response = await fetch(`${this.serverUrl}/api/mockup/status`)
      if (response.ok) {
        this.polling = true
        this.log('success', 'Connected to server!')
        if (this.options.onConnect) this.options.onConnect()

        // Start polling
        this.startPolling()
      } else {
        throw new Error(`Server returned ${response.status}`)
      }
    } catch (error) {
      this.log('error', `Failed to connect: ${error.message}`)
      if (this.options.onError) this.options.onError(error)
    }
  }

  disconnect() {
    console.log('HTTPPollingClient.disconnect() called')
    this.polling = false
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.log('info', 'Disconnected')
    if (this.options.onDisconnect) this.options.onDisconnect()
  }

  startPolling() {
    this.pollInterval = setInterval(async () => {
      try {
        // Poll for new jobs
        const response = await fetch(`${this.serverUrl}/api/mockup/pending-jobs`)
        if (response.ok) {
          const jobs = await response.json()
          if (jobs && jobs.length > 0) {
            jobs.forEach((job) => {
              if (this.options.onMessage) {
                this.options.onMessage({
                  type: 'new_job',
                  job: job,
                })
              }
            })
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, this.pollDelay)
  }

  async send(message) {
    console.log('Sending message:', message)

    try {
      const response = await fetch(`${this.serverUrl}/api/mockup/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      if (response.ok) {
        this.log('info', `Sent: ${message.type}`)
      } else {
        throw new Error(`Server returned ${response.status}`)
      }
    } catch (error) {
      this.log('error', `Failed to send: ${error.message}`)
    }
  }

  isConnected() {
    return this.polling
  }

  log(level, message) {
    console.log(`[${level}] ${message}`)
    if (this.options.onLog) this.options.onLog(level, message)
  }
}

// ============================================
// Main Application
// ============================================

// UI Elements
const statusIndicator = document.getElementById('statusIndicator')
const statusText = document.getElementById('statusText')
const connectBtn = document.getElementById('connectBtn')
const logsContainer = document.getElementById('logsContainer')
const clearLogsBtn = document.getElementById('clearLogsBtn')
const jobsReceivedEl = document.getElementById('jobsReceived')
const jobsCompletedEl = document.getElementById('jobsCompleted')

// Stats
let jobsReceived = 0
let jobsCompleted = 0

// Client
let client = null

/**
 * Initialize the plugin
 */
function init() {
  console.log('Init function called')

  if (!connectBtn) {
    console.error('Connect button not found!')
    return
  }

  connectBtn.addEventListener('click', handleConnectClick)
  clearLogsBtn.addEventListener('click', clearLogs)
  addLog('info', 'Plugin initialized. Click "Connect to Server" to start.')
  addLog('info', 'Using HTTP polling (WebSocket requires WebView in UXP)')
  console.log('Plugin initialized successfully')
}

/**
 * Handle connect/disconnect button click
 */
function handleConnectClick() {
  console.log('Connect button clicked!')

  if (client && client.isConnected()) {
    console.log('Disconnecting...')
    client.disconnect()
    client = null
  } else {
    console.log('Connecting to server...')
    connectToServer()
  }
}

/**
 * Connect to server
 */
function connectToServer() {
  client = new HTTPPollingClient({
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onMessage: handleMessage,
    onError: handleError,
    onLog: addLog,
  })

  client.connect()
}

/**
 * Handle connection
 */
function handleConnect() {
  updateConnectionStatus(true)
  addLog('success', 'Connected to server! Polling for jobs...')
}

/**
 * Handle disconnection
 */
function handleDisconnect() {
  updateConnectionStatus(false)
  addLog('warning', 'Disconnected from server.')
}

/**
 * Handle incoming messages
 */
function handleMessage(message) {
  switch (message.type) {
    case 'new_job':
      handleNewJob(message)
      break

    default:
      addLog('info', `Received: ${message.type}`)
  }
}

/**
 * Handle new job message
 */
function handleNewJob(message) {
  jobsReceived++
  updateStats()

  addLog('info', `New job received: ${message.job.productTitle}`)
  addLog('info', `Job ID: ${message.job.id}`)
  addLog('info', `Product: ${message.job.productId}`)
  addLog('warning', 'Phase 4: Job received but processing not yet implemented')

  // Simulate processing for testing Phase 4
  setTimeout(() => {
    if (client && client.isConnected()) {
      client.send({
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
 * Handle error
 */
function handleError(error) {
  addLog('error', `Connection error: ${error.message}`)
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(connected) {
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
function addLog(level, message) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false })

  const logEntry = document.createElement('div')
  logEntry.className = 'log-entry'

  logEntry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-level ${level}">${level.toUpperCase()}</span>
    <span class="log-message">${message}</span>
  `

  logsContainer.appendChild(logEntry)
  logsContainer.scrollTop = logsContainer.scrollHeight

  if (logsContainer.children.length > 100) {
    logsContainer.removeChild(logsContainer.firstChild)
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
