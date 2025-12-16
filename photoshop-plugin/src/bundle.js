// ============================================
// Mockup Processor - Photoshop Operations
// ============================================

const fs = require('uxp').storage.localFileSystem
const { app } = require('photoshop')

class MockupProcessor {
  constructor(onLog, onStep) {
    this.onLog = onLog
    this.onStep = onStep
    this.tempFolder = null
    this.selectedTemplate = null // Store template for reuse
  }

  /**
   * Log message
   */
  log(level, message) {
    console.log(`[MockupProcessor] [${level}] ${message}`)
    if (this.onLog) this.onLog(level, message)
  }

  /**
   * Update step
   */
  step(stepNumber, status = 'active') {
    if (this.onStep) this.onStep(stepNumber, status)
  }

  /**
   * Reset stored template (force reselection)
   */
  resetTemplate() {
    this.selectedTemplate = null
    this.log('info', 'Template reset - will prompt on next job')
  }

  /**
   * Initialize temp folder
   */
  async initTempFolder() {
    try {
      const tempFolder = await fs.getTemporaryFolder()
      this.tempFolder = tempFolder
      this.log('info', 'Temp folder initialized')
      return tempFolder
    } catch (error) {
      this.log('error', `Failed to init temp folder: ${error.message}`)
      throw error
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(imageUrl) {
    this.log('info', `Downloading image from: ${imageUrl}`)

    try {
      // Download from backend endpoint
      const response = await fetch(
        `http://localhost:3333/api/mockup/download?path=${encodeURIComponent(imageUrl)}`
      )

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()

      // Save to temp folder
      if (!this.tempFolder) {
        await this.initTempFolder()
      }

      const filename = `product-${Date.now()}.jpg`
      const file = await this.tempFolder.createFile(filename, { overwrite: true })
      await file.write(arrayBuffer, { format: require('uxp').storage.formats.binary })

      this.log('success', `Image downloaded: ${filename}`)
      return file
    } catch (error) {
      this.log('error', `Download failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Get mockup template path (reuses previously selected template)
   */
  async getMockupTemplate() {
    // If we already have a template selected, reuse it
    if (this.selectedTemplate) {
      this.log('info', `Using previously selected template: ${this.selectedTemplate.name}`)
      return this.selectedTemplate
    }

    // First time - prompt user to select template
    this.log('info', 'Please select mockup template PSD file (will be reused for all jobs)')

    try {
      const file = await fs.getFileForOpening({
        types: ['psd', 'psb'],
      })

      if (!file) {
        throw new Error('No template selected')
      }

      // Store for reuse
      this.selectedTemplate = file
      this.log('success', `Template selected: ${file.name} (will be reused for remaining jobs)`)
      return file
    } catch (error) {
      this.log('error', `Template selection failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Open document in Photoshop
   */
  async openDocument(file) {
    this.log('info', `Opening document: ${file.name}`)

    try {
      const doc = await app.open(file)
      this.log('success', `Document opened: ${doc.name}`)
      return doc
    } catch (error) {
      this.log('error', `Failed to open document: ${error.message}`)
      throw error
    }
  }

  /**
   * Recursively search for smart object layer
   */
  findSmartObjectInLayers(layers, targetName = null) {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]

      // Check if this layer is the smart object we're looking for
      if (targetName && layer.name === targetName && layer.kind === 'smartObject') {
        return layer
      }

      // If no target name, return first smart object
      if (!targetName && layer.kind === 'smartObject') {
        return layer
      }

      // If this is a group, search recursively inside it
      if (layer.kind === 'group' && layer.layers) {
        const found = this.findSmartObjectInLayers(layer.layers, targetName)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  /**
   * Find smart object layer
   */
  async findSmartObjectLayer(doc) {
    this.log('info', 'Searching for smart object layer')

    try {
      // First, try to find layer named "Artwork" (recursively)
      let smartObject = this.findSmartObjectInLayers(doc.layers, 'Artwork')

      if (smartObject) {
        this.log('success', `Found smart object: ${smartObject.name}`)
        return smartObject
      }

      // If not found, get the first smart object (recursively)
      smartObject = this.findSmartObjectInLayers(doc.layers, null)

      if (smartObject) {
        this.log('success', `Found smart object: ${smartObject.name}`)
        return smartObject
      }

      throw new Error('No smart object layer found')
    } catch (error) {
      this.log('error', `Smart object search failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Replace smart object contents
   */
  async replaceSmartObject(layer, imageFile) {
    this.log('info', `Replacing smart object with: ${imageFile.name}`)

    try {
      const { batchPlay } = require('photoshop').action
      const { storage } = require('uxp')
      const { app } = require('photoshop')

      // Select the layer first
      layer.selected = true

      // Get file token for the image file
      const token = await storage.localFileSystem.createSessionToken(imageFile)

      // Edit/open the smart object
      this.log('info', 'Opening smart object for editing...')
      await batchPlay(
        [
          {
            _obj: 'placedLayerEditContents',
          },
        ],
        {}
      )

      // Wait a moment for the smart object to open
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Now we're inside the smart object document
      const smartObjectDoc = app.activeDocument
      this.log('info', `Inside smart object: ${smartObjectDoc.name}`)

      // Place the new image on top (no need to delete existing layers)
      this.log('info', 'Placing new image as top layer in smart object...')
      await batchPlay(
        [
          {
            _obj: 'placeEvent',
            null: {
              _path: token,
              _kind: 'local',
            },
            freeTransformCenterState: {
              _enum: 'quadCenterState',
              _value: 'QCSAverage',
            },
          },
        ],
        {}
      )

      // Get canvas and image dimensions for cover calculation
      const canvas = {
        width: smartObjectDoc.width,
        height: smartObjectDoc.height,
      }
      const imageLayer = smartObjectDoc.activeLayers[0]
      const imageBounds = imageLayer.bounds
      const image = {
        width: imageBounds.right - imageBounds.left,
        height: imageBounds.bottom - imageBounds.top,
      }

      this.log(
        'info',
        `Canvas: ${canvas.width}x${canvas.height}, Image: ${image.width}x${image.height}`
      )

      // Calculate "cover" scale (fill entire canvas, maintain aspect ratio)
      const scaleX = canvas.width / image.width
      const scaleY = canvas.height / image.height
      const scale = Math.max(scaleX, scaleY) * 100 // Use larger scale to cover, convert to percentage

      this.log('info', `Applying cover scale: ${scale.toFixed(2)}%`)

      // Transform the image to cover the canvas
      await batchPlay(
        [
          {
            _obj: 'transform',
            freeTransformCenterState: {
              _enum: 'quadCenterState',
              _value: 'QCSAverage',
            },
            offset: {
              _obj: 'offset',
              horizontal: { _unit: 'pixelsUnit', _value: 0 },
              vertical: { _unit: 'pixelsUnit', _value: 0 },
            },
            width: { _unit: 'percentUnit', _value: scale },
            height: { _unit: 'percentUnit', _value: scale },
            interfaceIconFrameDimmed: {
              _enum: 'interpolationType',
              _value: 'bicubic',
            },
          },
        ],
        {}
      )

      // Center the image on the canvas
      await batchPlay(
        [
          {
            _obj: 'align',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            using: {
              _enum: 'alignDistributeSelector',
              _value: 'ADSCentersH',
            },
          },
          {
            _obj: 'align',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            using: {
              _enum: 'alignDistributeSelector',
              _value: 'ADSCentersV',
            },
          },
        ],
        {}
      )

      // Flatten/rasterize the placed layer
      await batchPlay(
        [
          {
            _obj: 'rasterizeLayer',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
          },
        ],
        {}
      )

      // Save and close the smart object
      this.log('info', 'Closing smart object...')
      await batchPlay(
        [
          {
            _obj: 'close',
            saving: {
              _enum: 'yesNo',
              _value: 'yes',
            },
          },
        ],
        {}
      )

      this.log('success', 'Smart object replaced successfully')
    } catch (error) {
      this.log('error', `Failed to replace smart object: ${error.message}`)
      throw error
    }
  }

  /**
   * Save document as JPEG
   */
  async saveAsJPEG(doc, outputName) {
    this.log('info', `Saving result as: ${outputName}`)

    try {
      if (!this.tempFolder) {
        await this.initTempFolder()
      }

      const outputFile = await this.tempFolder.createFile(outputName, { overwrite: true })

      const saveOptions = {
        quality: 12, // Maximum quality
        embedColorProfile: true,
      }

      await doc.saveAs.jpg(outputFile, saveOptions)

      this.log('success', `Saved to: ${outputFile.nativePath}`)
      return outputFile
    } catch (error) {
      this.log('error', `Save failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Close document
   */
  async closeDocument(doc, save = false) {
    try {
      await doc.close(save ? 'save' : 'no')
      this.log('info', 'Document closed')
    } catch (error) {
      this.log('error', `Failed to close document: ${error.message}`)
    }
  }

  /**
   * Process mockup job
   */
  async processJob(job) {
    this.log('info', `Processing job: ${job.id}`)
    this.log('info', `Product: ${job.productTitle}`)

    let doc = null
    let productImage = null
    let outputFile = null

    try {
      // Step 1: Download product image
      this.step(1, 'active')
      this.log('info', 'Step 1/5: Downloading product image...')
      productImage = await this.downloadImage(job.imageUrl)
      this.step(1, 'completed')

      // Step 2: Get mockup template
      this.step(2, 'active')
      this.log('info', 'Step 2/5: Selecting mockup template...')
      const templateFile = await this.getMockupTemplate()
      this.step(2, 'completed')

      // Step 3-5: Execute Photoshop operations in modal scope
      this.log('info', 'Processing in Photoshop (modal scope)...')

      const result = await require('photoshop').core.executeAsModal(
        async () => {
          // Step 3: Open template
          this.step(3, 'active')
          this.log('info', 'Step 3/5: Opening template...')
          doc = await this.openDocument(templateFile)
          this.step(3, 'completed')

          // Step 4: Replace smart object
          this.step(4, 'active')
          this.log('info', 'Step 4/5: Replacing smart object...')
          const smartObject = await this.findSmartObjectLayer(doc)
          await this.replaceSmartObject(smartObject, productImage)
          this.step(4, 'completed')

          // Step 5: Save result
          this.step(5, 'active')
          this.log('info', 'Step 5/5: Saving result...')
          // Extract numeric ID from Shopify GID (e.g., "gid://shopify/Product/7890767380735" -> "7890767380735")
          const numericId = job.productId.split('/').pop()
          const outputName = `mockup-${numericId}-${Date.now()}.jpg`
          outputFile = await this.saveAsJPEG(doc, outputName)
          this.step(5, 'completed')

          // Close document without saving
          await this.closeDocument(doc, false)

          return {
            success: true,
            resultPath: outputFile.nativePath,
            outputFile: outputFile,
          }
        },
        {
          commandName: 'Process Mockup',
          interactive: true,
        }
      )

      this.log('success', `✅ Job completed successfully!`)
      return result
    } catch (error) {
      this.log('error', `❌ Job failed: ${error.message}`)

      // Clean up on error
      if (doc) {
        try {
          await require('photoshop').core.executeAsModal(
            async () => {
              await this.closeDocument(doc, false)
            },
            { commandName: 'Cleanup' }
          )
        } catch (cleanupError) {
          this.log('error', `Cleanup failed: ${cleanupError.message}`)
        }
      }

      return {
        success: false,
        error: error.message,
      }
    }
  }
}

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
const statsSection = document.getElementById('statsSection')
const jobsReceivedEl = document.getElementById('jobsReceived')
const jobsCompletedEl = document.getElementById('jobsCompleted')

// Current Job UI Elements
const currentJobSection = document.getElementById('currentJobSection')
const jobTitle = document.getElementById('jobTitle')
const progressBar = document.getElementById('progressBar')
const progressText = document.getElementById('progressText')
const step1 = document.getElementById('step1')
const step2 = document.getElementById('step2')
const step3 = document.getElementById('step3')
const step4 = document.getElementById('step4')
const step5 = document.getElementById('step5')

// Automation Form Elements
const automationSection = document.getElementById('automationSection')
const processAllYes = document.getElementById('processAllYes')
const processAllNo = document.getElementById('processAllNo')
const yesLabel = document.getElementById('yesLabel')
const noLabel = document.getElementById('noLabel')
const numberOfProductsGroup = document.getElementById('numberOfProductsGroup')
const numberOfProductsInput = document.getElementById('numberOfProducts')
const startAutomationBtn = document.getElementById('startAutomationBtn')

// Stats
let jobsReceived = 0
let jobsCompleted = 0

// Client and processor
let client = null
let processor = null

// Job queue for sequential processing
let jobQueue = []
let isProcessingJob = false

/**
 * Initialize the plugin
 */
function init() {
  console.log('Init function called')

  if (!connectBtn) {
    console.error('Connect button not found!')
    return
  }

  // Initialize processor with log and step callbacks
  processor = new MockupProcessor(addLog, updateStep)

  connectBtn.addEventListener('click', handleConnectClick)
  clearLogsBtn.addEventListener('click', clearLogs)

  // Automation form event listeners
  processAllYes.addEventListener('change', handleProcessAllChange)
  processAllNo.addEventListener('change', handleProcessAllChange)
  startAutomationBtn.addEventListener('click', handleStartAutomation)

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

  // Show sections when connected
  automationSection.style.display = 'block'
  statsSection.style.display = 'block'
  currentJobSection.style.display = 'block'
}

/**
 * Handle disconnection
 */
function handleDisconnect() {
  updateConnectionStatus(false)
  addLog('warning', 'Disconnected from server.')

  // Hide sections when disconnected
  automationSection.style.display = 'none'
  statsSection.style.display = 'none'
  currentJobSection.style.display = 'none'
}

/**
 * Handle process all radio button change
 */
function handleProcessAllChange() {
  if (processAllYes.checked) {
    numberOfProductsGroup.style.display = 'none'
    yesLabel.classList.add('checked')
    noLabel.classList.remove('checked')
  } else {
    numberOfProductsGroup.style.display = 'block'
    yesLabel.classList.remove('checked')
    noLabel.classList.add('checked')
  }
}

/**
 * Handle start automation button click
 */
async function handleStartAutomation() {
  if (!client || !client.isConnected()) {
    addLog('error', 'Not connected to server')
    return
  }

  const processAll = processAllYes.checked
  const numberOfProducts = processAll ? 0 : parseInt(numberOfProductsInput.value, 10)

  if (!processAll && (!numberOfProducts || numberOfProducts < 1)) {
    addLog('error', 'Please enter a valid number of products')
    return
  }

  // Disable button during processing
  startAutomationBtn.disabled = true
  startAutomationBtn.textContent = 'Starting...'

  try {
    addLog(
      'info',
      `Starting automation: ${processAll ? 'All products' : `${numberOfProducts} product(s)`}`
    )

    const response = await fetch('http://localhost:3333/api/mockup/start-automation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processAll,
        numberOfProducts,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      addLog('success', `Automation started! Processing ${data.totalJobs} product(s)`)
    } else {
      const error = await response.json()
      addLog('error', `Failed to start automation: ${error.message || response.statusText}`)
    }
  } catch (error) {
    addLog('error', `Error starting automation: ${error.message}`)
  } finally {
    // Re-enable button
    startAutomationBtn.disabled = false
    startAutomationBtn.textContent = 'Start Processing'
  }
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
 * Handle new job message - adds to queue instead of processing immediately
 */
function handleNewJob(message) {
  jobsReceived++
  updateStats()

  const job = message.job

  addLog('info', `New job received: ${job.productTitle}`)
  addLog('info', `Job ID: ${job.id}`)

  // Add to queue
  jobQueue.push(job)
  addLog('info', `Job added to queue (${jobQueue.length} job(s) in queue)`)

  // Start processing if not already processing
  if (!isProcessingJob) {
    processNextJob()
  }
}

/**
 * Process jobs sequentially from the queue
 */
async function processNextJob() {
  // If already processing or queue is empty, return
  if (isProcessingJob || jobQueue.length === 0) {
    return
  }

  // Mark as processing
  isProcessingJob = true

  // Get next job from queue
  const job = jobQueue.shift()

  addLog('info', `Processing: ${job.productTitle}`)
  addLog('info', `Remaining in queue: ${jobQueue.length}`)

  // Show current job section
  showCurrentJob(job.productTitle)

  // Process job using MockupProcessor
  try {
    const result = await processor.processJob(job)

    if (result.success) {
      // Mark job as completed successfully
      markJobCompleted(true)

      // Send completion message to backend
      if (client && client.isConnected()) {
        await client.send({
          jobId: job.id,
          resultPath: result.resultPath,
          success: true,
        })
        jobsCompleted++
        updateStats()
        addLog('success', `Job ${job.id} completed and reported to backend`)
      }
    } else {
      // Mark job as failed
      markJobCompleted(false)

      // Send failure message to backend
      if (client && client.isConnected()) {
        await client.send({
          jobId: job.id,
          error: result.error,
          success: false,
        })
        addLog('error', `Job ${job.id} failed and reported to backend`)
      }
    }
  } catch (error) {
    addLog('error', `Unexpected error processing job: ${error.message}`)

    // Mark job as failed
    markJobCompleted(false)

    // Send failure message to backend
    if (client && client.isConnected()) {
      await client.send({
        jobId: job.id,
        error: error.message,
        success: false,
      })
    }
  } finally {
    // Mark as not processing
    isProcessingJob = false

    // Process next job if any
    if (jobQueue.length > 0) {
      addLog('info', `Processing next job (${jobQueue.length} remaining)`)
      // Small delay before next job to ensure UI updates
      setTimeout(() => processNextJob(), 500)
    } else {
      addLog('success', 'All jobs completed!')
    }
  }
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
 * Show current job section
 */
function showCurrentJob(productTitle) {
  currentJobSection.classList.remove('success', 'error')
  currentJobSection.classList.add('processing')
  jobTitle.textContent = productTitle
  resetSteps()
}

/**
 * Reset to idle state after job completion
 */
function resetToIdle() {
  setTimeout(() => {
    currentJobSection.classList.remove('processing', 'success', 'error')
    jobTitle.textContent = 'Waiting for job...'
    resetSteps()
  }, 3000) // Keep completion state visible for 3 seconds
}

/**
 * Reset all steps
 */
function resetSteps() {
  const steps = [step1, step2, step3, step4, step5]
  steps.forEach((step) => {
    step.classList.remove('active', 'completed', 'error')
    const icon = step.querySelector('.step-icon')
    icon.innerHTML = '○'
  })
  progressBar.style.width = '0%'
  progressBar.classList.remove('complete')
  progressText.textContent = 'Step 0 of 5'
}

/**
 * Update processing step
 */
function updateStep(stepNumber, status = 'active') {
  const steps = [step1, step2, step3, step4, step5]
  const step = steps[stepNumber - 1]

  if (!step) return

  // Remove all status classes from this step
  step.classList.remove('active', 'completed', 'error')

  // Update icon and class based on status
  const icon = step.querySelector('.step-icon')
  if (status === 'active') {
    step.classList.add('active')
    icon.innerHTML = '<div class="spinner"></div>'
  } else if (status === 'completed') {
    step.classList.add('completed')
    icon.innerHTML = '✓'
  } else if (status === 'error') {
    step.classList.add('error')
    icon.innerHTML = '✗'
  }

  // Update progress bar
  const progress = (stepNumber / 5) * 100
  progressBar.style.width = `${progress}%`
  progressText.textContent = `Step ${stepNumber} of 5`

  // Mark previous steps as completed
  for (let i = 0; i < stepNumber - 1; i++) {
    steps[i].classList.remove('active', 'error')
    steps[i].classList.add('completed')
    const prevIcon = steps[i].querySelector('.step-icon')
    prevIcon.innerHTML = '✓'
  }
}

/**
 * Mark job as completed
 */
function markJobCompleted(success = true) {
  currentJobSection.classList.remove('processing')
  if (success) {
    currentJobSection.classList.add('success')
    progressBar.classList.add('complete')
    progressBar.style.width = '100%'
    progressText.textContent = 'Completed!'

    // Mark all steps as completed
    const steps = [step1, step2, step3, step4, step5]
    steps.forEach((step) => {
      step.classList.remove('active', 'error')
      step.classList.add('completed')
      const icon = step.querySelector('.step-icon')
      icon.innerHTML = '✓'
    })
  } else {
    currentJobSection.classList.add('error')
    progressText.textContent = 'Failed!'
  }

  resetToIdle()
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
