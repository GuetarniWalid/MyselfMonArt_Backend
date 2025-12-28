// ============================================
// Mockup Processor - Photoshop Operations
// ============================================

const fs = require('uxp').storage.localFileSystem
const { app } = require('photoshop')
const { shell } = require('uxp')

// ============================================
// Plugin Configuration
// ============================================
// IMPORTANT: Set your backend URL here before building
// Development: 'http://localhost:3333'
// Production: 'https://YOUR_BACKEND_DOMAIN'
const config = {
  BACKEND_URL: 'http://localhost:3333',
  ENV: 'development',
}

class MockupProcessor {
  constructor(onLog, onStep) {
    this.onLog = onLog
    this.onStep = onStep
    this.tempFolder = null
    this.selectedTemplate = null // Store template for reuse
    this.mockupTemplateFolder = null // Store selected mockup template folder path
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
  async downloadImage(imageUrl, batchId, productId) {
    this.log('info', `Downloading image from: ${imageUrl}`)

    try {
      // Download from backend endpoint (supports both local paths and Shopify URLs)
      const url = new URL(`${config.BACKEND_URL}/api/mockup/download`)
      url.searchParams.append('path', imageUrl)
      if (batchId) url.searchParams.append('batchId', batchId)
      if (productId) url.searchParams.append('productId', productId)

      const response = await fetch(url.toString())

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
   * Set the selected mockup template folder
   */
  setMockupTemplateFolder(templatePath) {
    this.mockupTemplateFolder = templatePath
    this.log('info', `Mockup template folder set: ${templatePath}`)
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
   * Get specific mockup PSD file based on orientation
   */
  async getMockupTemplateForOrientation(orientation) {
    if (!this.mockupTemplateFolder) {
      throw new Error('No mockup template folder selected')
    }

    this.log('info', `Selecting ${orientation}.psd from ${this.mockupTemplateFolder}`)

    try {
      // Get plugin folder
      const pluginFolder = await fs.getPluginFolder()
      const mockupsFolder = await pluginFolder.getEntry('mockups')

      // Navigate to template folder (e.g., "Cuisine/Grande cuisine")
      const [categoryName, subfolderName] = this.mockupTemplateFolder.split('/')
      const categoryFolder = await mockupsFolder.getEntry(categoryName)
      const templateFolder = await categoryFolder.getEntry(subfolderName)

      // Get the specific PSD file
      const psdFileName = `${orientation}.psd`
      const psdFile = await templateFolder.getEntry(psdFileName)

      if (!psdFile) {
        throw new Error(`${psdFileName} not found in ${this.mockupTemplateFolder}`)
      }

      this.log('success', `Selected mockup: ${psdFileName}`)
      return psdFile
    } catch (error) {
      this.log('error', `Failed to get mockup: ${error.message}`)
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
    this.log('info', `Orientation: ${job.orientation}`)

    let doc = null
    let productImage = null
    let outputFile = null

    try {
      // Step 1: Download product image (on-demand from Shopify)
      this.step(1, 'active')
      this.log('info', 'Step 1/5: Downloading product image...')
      productImage = await this.downloadImage(job.imageUrl, job.batchId, job.productId)
      this.step(1, 'completed')

      // Step 2: Get mockup template based on orientation
      this.step(2, 'active')
      this.log('info', `Step 2/5: Selecting ${job.orientation} mockup...`)
      const templateFile = await this.getMockupTemplateForOrientation(job.orientation)
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
          const numericId = job.productId.split('/').pop()
          const outputName = `mockup-${numericId}-${Date.now()}.jpg`

          outputFile = await this.saveAsJPEG(doc, outputName)
          this.step(5, 'completed')

          // Read file data INSIDE modal scope to ensure it's accessible
          let fileData = null
          try {
            this.log('info', 'Reading file data inside modal scope...')
            const fs = require('uxp').storage
            fileData = await outputFile.read({ format: fs.formats.binary })
            this.log('info', `File data read, size: ${fileData.byteLength}`)
          } catch (readError) {
            this.log(
              'error',
              `Failed to read file in modal scope: ${readError?.message || 'Unknown error'}`
            )
            // We'll try to read it outside the modal scope later
          }

          // Close document
          await this.closeDocument(doc, false)

          return {
            success: true,
            resultPath: outputFile.nativePath,
            fileName: outputFile.name,
            fileData: fileData, // Return binary data (might be null if read failed)
            outputFile: fileData ? null : outputFile, // Keep file reference if read failed
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
    } finally {
      // Clean up downloaded product image
      if (productImage) {
        try {
          await productImage.delete()
          this.log('info', 'Cleaned up product image file')
        } catch (deleteError) {
          this.log('error', `Failed to delete product image: ${deleteError.message}`)
        }
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
    this.serverUrl = config.BACKEND_URL
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
        // Return the response data so caller can check for errors
        const data = await response.json()
        return data
      } else {
        throw new Error(`Server returned ${response.status}`)
      }
    } catch (error) {
      this.log('error', `Failed to send: ${error.message}`)
      throw error
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
const step6 = document.getElementById('step6')
const step7 = document.getElementById('step7')
const step8 = document.getElementById('step8')
const step9 = document.getElementById('step9')

// Automation Form Elements
const automationSection = document.getElementById('automationSection')
const collectionLoader = document.getElementById('collectionLoader')
const collectionSelectorWrapper = document.getElementById('collectionSelectorWrapper')
const collectionSelector = document.getElementById('collectionSelector')
const mockupTemplateSelector = document.getElementById('mockupTemplateSelector')
const mockupImagesPreview = document.getElementById('mockupImagesPreview')
const mockupFile1 = document.getElementById('mockupFile1')
const mockupFile2 = document.getElementById('mockupFile2')
const mockupFile3 = document.getElementById('mockupFile3')
const startAutomationBtn = document.getElementById('startAutomationBtn')

// Loader animation
let loaderInterval = null
let loaderDots = null

// Stats
let jobsReceived = 0
let jobsCompleted = 0

// Client and processor
let client = null
let processor = null
let paintingCollections = []

// Mockup template data
let mockupFolderPath = null
let selectedMockupImages = []

// Job queue for sequential processing
let jobQueue = []
let isProcessingJob = false
let currentBatchId = null // Track current batch for cleanup
let tempMockupFiles = [] // Track temp mockup files for cleanup
let currentJobFileInfo = null // Track current job's file info for cleanup on error

// Image position and error handling
let targetImagePosition = 0 // Default to first image (0-indexed)
let isPaused = false
let dotAnimationInterval = null // Track the dot animation interval

/**
 * Validate if Start Processing button should be enabled
 */
function validateStartButton() {
  // Safety check - ensure elements exist
  if (!collectionSelector || !mockupTemplateSelector || !startAutomationBtn) {
    console.log('Validation skipped - elements not ready')
    return
  }

  // Check if at least one collection is selected
  const checkedCollections = collectionSelector.querySelectorAll('input[type="checkbox"]:checked')
  const hasCollection = checkedCollections.length > 0

  // Check if a template is selected (checkbox must be checked)
  const selectedTemplate = mockupTemplateSelector.querySelector('input[type="checkbox"]:checked')
  const templateValue = selectedTemplate ? selectedTemplate.value : ''
  const hasTemplate = templateValue !== '' && templateValue !== null && templateValue !== undefined

  console.log('Validation:', {
    hasCollection,
    collectionCount: checkedCollections.length,
    hasTemplate,
    templateValue,
  })

  // Enable button only if BOTH conditions are met
  const isValid = hasCollection && hasTemplate

  if (isValid) {
    startAutomationBtn.disabled = false
    startAutomationBtn.title = ''
    console.log('✅ Button enabled')
  } else {
    startAutomationBtn.disabled = true
    if (!hasCollection && !hasTemplate) {
      startAutomationBtn.title = 'Please select collections and a mockup template'
    } else if (!hasCollection) {
      startAutomationBtn.title = 'Please select at least one collection'
    } else {
      startAutomationBtn.title = 'Please select a mockup template'
    }
    console.log('❌ Button disabled:', startAutomationBtn.title)
  }
}

/**
 * Show error modal and pause processing
 */
function showErrorModal(job, error) {
  console.log('🔍 DEBUG: showErrorModal called with:', {
    job: job,
    error: {
      message: error.message,
      resultPath: error.resultPath,
      productId: error.productId,
    },
  })

  console.log('🔍 DEBUG: showErrorModal SETTING isPaused = true')
  isPaused = true
  console.log('🔍 DEBUG: showErrorModal isPaused is now:', isPaused)

  const productName = job.productTitle || 'Unknown'
  const errorMessage = error.message || 'Unknown error'
  const filePath = error.resultPath || 'N/A'

  console.log('🔍 DEBUG: Modal display values:', {
    productName,
    errorMessage,
    filePath,
  })

  document.getElementById('errorProductName').textContent = productName
  document.getElementById('errorMessage').textContent = errorMessage
  document.getElementById('errorFilePath').textContent = filePath
  document.getElementById('errorModal').style.display = 'block'

  addLog('error', `❌ Processing paused: ${error.message}`)
}

/**
 * Hide error modal and resume processing
 */
function hideErrorModal() {
  console.log('🔍 DEBUG: hideErrorModal called - SETTING isPaused = false')
  document.getElementById('errorModal').style.display = 'none'
  isPaused = false
  console.log('🔍 DEBUG: hideErrorModal isPaused is now:', isPaused)
}

/**
 * Initialize the plugin
 */
function init() {
  console.log('Init function called')

  if (!connectBtn) {
    console.error('Connect button not found!')
    return
  }

  // Initialize loader dots elements
  if (collectionLoader) {
    loaderDots = collectionLoader.querySelectorAll('.dot')
    console.log('Loader dots found:', loaderDots.length)
  }

  // Initialize processor with log and step callbacks
  processor = new MockupProcessor(addLog, updateStep)

  connectBtn.addEventListener('click', handleConnectClick)
  clearLogsBtn.addEventListener('click', clearLogs)

  // Automation form event listeners
  startAutomationBtn.addEventListener('click', handleStartAutomation)
  // Template change listeners are added when radio buttons are created

  // Image position selector event listeners (checkbox with radio behavior)
  const imagePositionCheckboxes = document.querySelectorAll('.image-position-checkbox')
  imagePositionCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        // Uncheck all other checkboxes (radio behavior)
        imagePositionCheckboxes.forEach((cb) => {
          if (cb !== e.target) {
            cb.checked = false
          }
        })
        // Update target position
        targetImagePosition = parseInt(e.target.dataset.position)
        addLog('info', `Image position set to ${targetImagePosition + 1}`)
        validateStartButton()
      } else {
        // Don't allow unchecking - at least one must be selected
        e.target.checked = true
      }
    })
  })

  // Error modal event listeners
  const errorContinueBtn = document.getElementById('errorContinueBtn')
  const errorCancelBtn = document.getElementById('errorCancelBtn')

  if (errorContinueBtn) {
    errorContinueBtn.addEventListener('click', async () => {
      addLog('info', 'User chose to continue processing')
      // Cleanup current job's files before continuing
      await cleanupCurrentJobFiles()
      hideErrorModal()

      // Count the manually handled job as completed
      jobsCompleted++
      updateStats()
      addLog('info', 'Job marked as manually completed')

      // Check if there are more jobs
      if (jobQueue.length > 0) {
        // Resume processing next job
        processNextJob()
      } else {
        // No more jobs - complete the batch
        addLog('success', 'All jobs completed!')
        await cleanupBatchFiles()
        enableStartButton()
        resetToIdle()
      }
    })
  }

  if (errorCancelBtn) {
    errorCancelBtn.addEventListener('click', async () => {
      addLog('warning', 'User cancelled batch processing')
      // Cleanup current job's files before cancelling
      await cleanupCurrentJobFiles()
      hideErrorModal()
      // Clear remaining jobs
      jobQueue = []
      isProcessingJob = false
      addLog('info', 'All remaining jobs cancelled')
      // Cleanup all files for this batch
      await cleanupBatchFiles()
      // Re-enable the start button
      enableStartButton()
      // Reset to idle state
      resetToIdle()
    })
  }

  // Make file path clickable to open the actual file
  const errorFilePath = document.getElementById('errorFilePath')

  if (errorFilePath) {
    errorFilePath.addEventListener('click', async () => {
      const filePath = errorFilePath.textContent
      console.log('🔍 DEBUG: File path clicked:', filePath)

      if (filePath && filePath !== 'N/A' && filePath !== '-') {
        try {
          // UXP shell.openPath works for both URLs and file paths
          console.log('🔍 DEBUG: Opening:', filePath)

          // shell.openPath returns a result object, not a promise
          const result = shell.openPath(filePath)
          console.log('🔍 DEBUG: Open result:', result)

          if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            addLog('success', 'Opened mockup in browser')
          } else {
            addLog('success', 'Opened mockup file')
          }
        } catch (err) {
          console.error('❌ DEBUG: Failed to open:', err)
          addLog('error', `Failed to open: ${err.message}`)
        }
      } else {
        console.log('⚠️ DEBUG: No valid path to open')
      }
    })

    // Add hover effect
    errorFilePath.addEventListener('mouseenter', () => {
      errorFilePath.style.backgroundColor = '#252525'
    })
    errorFilePath.addEventListener('mouseleave', () => {
      errorFilePath.style.backgroundColor = '#1e1e1e'
    })
  }

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
 * Start loader animation
 */
function startLoader() {
  console.log('Starting loader animation')
  collectionLoader.style.display = 'flex'
  collectionSelectorWrapper.style.display = 'none'

  // JavaScript animation for bouncing dots
  if (loaderDots && loaderDots.length === 3) {
    let frame = 0
    loaderInterval = setInterval(() => {
      // Animate each dot with staggered timing
      loaderDots.forEach((dot, index) => {
        // Calculate bounce position using sine wave with phase offset
        const phase = (frame + index * 10) * 0.1 // Phase offset for stagger effect
        const bounce = Math.abs(Math.sin(phase)) * 12 // Bounce up to 12px
        dot.style.transform = `translateY(-${bounce}px)`
      })
      frame++
    }, 50) // ~20fps for smooth bounce
    console.log('Loader dots animation started')
  } else {
    console.error('Loader dots not found!')
  }
}

/**
 * Stop loader animation
 */
function stopLoader() {
  console.log('Stopping loader animation')
  if (loaderInterval) {
    clearInterval(loaderInterval)
    loaderInterval = null
    console.log('Loader interval cleared')
  }

  // Reset dots to original position
  if (loaderDots && loaderDots.length === 3) {
    loaderDots.forEach((dot) => {
      dot.style.transform = 'translateY(0)'
    })
  }

  collectionLoader.style.display = 'none'
  collectionSelectorWrapper.style.display = 'block'
}

/**
 * Handle connection
 */
async function handleConnect() {
  updateConnectionStatus(true)
  addLog('success', 'Connected to server! Polling for jobs...')

  // Show sections and loader
  automationSection.style.display = 'block'
  statsSection.style.display = 'block'
  currentJobSection.style.display = 'block'
  startLoader()

  // Fetch painting collections
  try {
    addLog('info', 'Fetching painting collections...')
    const response = await fetch(`${config.BACKEND_URL}/api/mockup/painting-collections`)

    if (response.ok) {
      paintingCollections = await response.json()
      addLog('success', `Loaded ${paintingCollections.length} painting collections`)
      populateCollectionsDropdown()
      stopLoader()
    } else {
      addLog('error', 'Failed to fetch collections')
      stopLoader()
    }
  } catch (error) {
    addLog('error', `Error fetching collections: ${error.message}`)
    stopLoader()
  }

  // Load mockup categories
  await loadMockupCategories()
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
 * Sanitize collection ID for use in HTML element IDs
 */
function sanitizeId(id) {
  // Replace all non-alphanumeric characters with underscores
  return id.replace(/[^a-zA-Z0-9]/g, '_')
}

/**
 * Populate collections checkboxes
 */
function populateCollectionsDropdown() {
  if (!collectionSelector) {
    addLog('error', 'Collection selector not found')
    return
  }

  // Clear existing checkboxes
  collectionSelector.innerHTML = ''

  if (paintingCollections.length === 0) {
    collectionSelector.innerHTML = `
      <div class="checkbox-item">
        <label>
          <input type="checkbox" disabled />
          <span>No collections found</span>
        </label>
      </div>
    `
    return
  }

  // Add "All Collections" checkbox
  const totalProducts = paintingCollections.reduce((sum, col) => sum + col.productCount, 0)
  const allCheckbox = document.createElement('div')
  allCheckbox.className = 'checkbox-item'
  allCheckbox.innerHTML = `
    <label>
      <input type="checkbox" value="all" data-name="All Collections" />
      <span>All Collections (${totalProducts} products)</span>
    </label>
  `
  collectionSelector.appendChild(allCheckbox)

  // Add individual collection checkboxes
  paintingCollections.forEach((collection) => {
    console.log(
      '🔍 Collection:',
      collection.title,
      'Products:',
      collection.products ? collection.products.length : 'undefined'
    )

    const checkboxItem = document.createElement('div')
    checkboxItem.className = 'checkbox-item'
    checkboxItem.innerHTML = `
      <label>
        <input type="checkbox" value="${collection.id}" data-name="${collection.title}" class="collection-checkbox" />
        <span>${collection.title} (${collection.productCount} products)</span>
      </label>
    `
    collectionSelector.appendChild(checkboxItem)

    // NEW: Create product links container (initially hidden)
    if (collection.products && collection.products.length > 0) {
      console.log(
        '✅ Creating product container for:',
        collection.title,
        'ID:',
        sanitizeId(collection.id)
      )
      const productContainer = document.createElement('div')
      productContainer.className = 'product-links-container'
      productContainer.id = `products-${sanitizeId(collection.id)}`
      productContainer.style.display = 'none' // Hidden by default

      collection.products.forEach((product) => {
        const productLink = document.createElement('div')
        productLink.className = 'checkbox-item indented product-link'

        // Extract numeric ID from GraphQL ID (e.g., "gid://shopify/Product/123" -> "123")
        const numericId = product.id.split('/').pop()

        if (product.onlineStoreUrl) {
          // Published product - clickable, copies URL to clipboard
          productLink.innerHTML = `
            <a href="#" class="product-url" data-url="${product.onlineStoreUrl}" title="Click to copy URL: ${product.title}">
              <span class="product-link-icon">🔗</span>
              <span class="product-link-text">${product.title}</span>
            </a>
          `
        } else {
          // Draft product - clickable, copies ID to clipboard
          productLink.innerHTML = `
            <a href="#" class="product-draft" data-id="${numericId}" title="Click to copy ID: ${numericId}">
              <span class="product-link-icon">📄</span>
              <span class="product-link-text">${product.title} <em>(Draft - ID: ${numericId})</em></span>
            </a>
          `
        }

        productContainer.appendChild(productLink)
      })

      collectionSelector.appendChild(productContainer)
      console.log('✅ Product container appended')
    } else {
      console.log('❌ No products for:', collection.title)
    }
  })

  // Setup "All Collections" checkbox behavior
  const allCheckboxInput = allCheckbox.querySelector('input[type="checkbox"]')
  const individualCheckboxes = collectionSelector.querySelectorAll('.collection-checkbox')

  // When "All Collections" is checked/unchecked, update all individual checkboxes
  allCheckboxInput.addEventListener('change', () => {
    const isChecked = allCheckboxInput.checked
    individualCheckboxes.forEach((checkbox) => {
      checkbox.checked = isChecked

      // NEW: Show/hide all product containers
      const collectionId = checkbox.value
      const productContainer = document.getElementById(`products-${sanitizeId(collectionId)}`)
      if (productContainer) {
        productContainer.style.display = isChecked ? 'block' : 'none'
      }
    })
    addLog('info', isChecked ? 'All collections selected' : 'All collections deselected')
    validateStartButton()
  })

  // When individual checkboxes change, update "All Collections" accordingly
  individualCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const allChecked = Array.from(individualCheckboxes).every((cb) => cb.checked)
      const noneChecked = Array.from(individualCheckboxes).every((cb) => !cb.checked)

      if (allChecked) {
        allCheckboxInput.checked = true
      } else if (noneChecked || !allCheckboxInput.checked) {
        allCheckboxInput.checked = false
      }

      // NEW: Show/hide product links based on checkbox state
      const collectionId = checkbox.value
      const sanitizedId = sanitizeId(collectionId)
      const productContainer = document.getElementById(`products-${sanitizedId}`)
      console.log(
        '🔍 Checkbox change:',
        checkbox.checked,
        'ID:',
        sanitizedId,
        'Container found:',
        !!productContainer
      )
      if (productContainer) {
        productContainer.style.display = checkbox.checked ? 'block' : 'none'
        console.log('✅ Product container display set to:', productContainer.style.display)
      } else {
        console.log('❌ Product container not found for ID:', `products-${sanitizedId}`)
      }

      validateStartButton()
    })
  })

  // Initial validation
  validateStartButton()

  // NEW: Setup product link click handlers
  setupProductLinkHandlers()

  addLog('info', 'Collection selector populated')
}

/**
 * Setup click handlers for product links
 */
function setupProductLinkHandlers() {
  // Handle published products (with URLs)
  const productLinks = document.querySelectorAll('.product-url')
  console.log('🔍 Setting up click handlers for', productLinks.length, 'published product links')

  productLinks.forEach((link, index) => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      console.log('🔍 Published product link clicked:', index)

      const url = link.getAttribute('data-url')
      console.log('🔍 URL:', url)

      if (!url || url === '') {
        addLog('error', 'Product URL not available')
        return
      }

      try {
        // Copy URL to clipboard
        await navigator.clipboard.writeText(url)
        console.log('✅ URL copied to clipboard:', url)

        addLog('success', `URL copied! Paste in browser: ${url.split('/').pop()}`)
      } catch (error) {
        console.error('❌ Error copying URL:', error)
        addLog('error', `Failed to copy URL: ${error.message}`)
      }
    })
  })

  // Handle draft products (without URLs)
  const draftLinks = document.querySelectorAll('.product-draft')
  console.log('🔍 Setting up click handlers for', draftLinks.length, 'draft product links')

  draftLinks.forEach((link, index) => {
    link.addEventListener('click', async (e) => {
      e.preventDefault()
      console.log('🔍 Draft product link clicked:', index)

      const productId = link.getAttribute('data-id')
      console.log('🔍 Product ID:', productId)

      if (!productId || productId === '') {
        addLog('error', 'Product ID not available')
        return
      }

      try {
        // Copy product ID to clipboard
        await navigator.clipboard.writeText(productId)
        console.log('✅ Product ID copied to clipboard:', productId)

        addLog('success', `Product ID copied to clipboard: ${productId}`)
      } catch (error) {
        console.error('❌ Error copying ID:', error)
        addLog('error', `Failed to copy ID: ${error.message}`)
      }
    })
  })

  addLog(
    'info',
    `Attached click handlers to ${productLinks.length} published and ${draftLinks.length} draft products`
  )
}

/**
 * Load all mockup templates with categories as optgroups
 */
async function loadMockupCategories() {
  try {
    addLog('info', 'Loading mockup templates...')

    // Get plugin folder
    const pluginFolder = await fs.getPluginFolder()
    mockupFolderPath = await pluginFolder.getEntry('mockups')

    if (!mockupFolderPath || !mockupFolderPath.isFolder) {
      addLog('error', 'Mockups folder not found')
      return
    }

    // Get all category folders
    const categoryEntries = await mockupFolderPath.getEntries()
    const categoryFolders = categoryEntries.filter((entry) => entry.isFolder)

    // Clear selector
    mockupTemplateSelector.innerHTML = ''

    let totalTemplates = 0

    // For each category, add category header and templates
    for (const categoryFolder of categoryFolders) {
      const categoryName = categoryFolder.name

      // Get template folders within this category
      const templateEntries = await categoryFolder.getEntries()
      const templateFolders = templateEntries.filter((entry) => entry.isFolder)

      if (templateFolders.length > 0) {
        // Add category header
        const categoryHeader = document.createElement('div')
        categoryHeader.className = 'category-header'
        categoryHeader.textContent = categoryName
        mockupTemplateSelector.appendChild(categoryHeader)

        // Add each template as a checkbox (with radio behavior) under the category
        templateFolders.forEach((templateFolder) => {
          const checkboxItem = document.createElement('div')
          checkboxItem.className = 'checkbox-item indented'
          checkboxItem.innerHTML = `
            <label>
              <input type="checkbox" value="${categoryName}/${templateFolder.name}" class="template-checkbox" />
              <span>${templateFolder.name}</span>
            </label>
          `
          mockupTemplateSelector.appendChild(checkboxItem)
          totalTemplates++
        })
      }
    }

    // Add event listeners to checkboxes with radio button behavior (only one selected)
    const templateCheckboxes = mockupTemplateSelector.querySelectorAll('.template-checkbox')
    templateCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        // If this checkbox is checked, uncheck all others (radio behavior)
        if (e.target.checked) {
          templateCheckboxes.forEach((otherCheckbox) => {
            if (otherCheckbox !== e.target) {
              otherCheckbox.checked = false
            }
          })
        }
        // Trigger template change handler
        handleTemplateChange()
      })
    })

    addLog(
      'success',
      `Loaded ${totalTemplates} mockup templates across ${categoryFolders.length} categories`
    )
  } catch (error) {
    addLog('error', `Failed to load mockup templates: ${error.message}`)
    console.error('Error loading mockup templates:', error)
  }
}

/**
 * Handle template selection change
 */
async function handleTemplateChange() {
  // Get the selected checkbox (only one should be checked due to radio behavior)
  const selectedCheckbox = mockupTemplateSelector.querySelector('input[type="checkbox"]:checked')
  const templatePath = selectedCheckbox ? selectedCheckbox.value : ''

  // Reset file display
  mockupImagesPreview.style.display = 'none'
  mockupFile1.querySelector('span:last-child').textContent = ''
  mockupFile2.querySelector('span:last-child').textContent = ''
  mockupFile3.querySelector('span:last-child').textContent = ''

  // Always validate button state (even when nothing selected)
  validateStartButton()

  if (!templatePath) {
    return
  }

  try {
    addLog('info', `Loading images from ${templatePath}...`)

    // Split path to navigate (e.g., "Cuisine/Grande cuisine")
    const [categoryName, templateName] = templatePath.split('/')

    // Get category folder
    const categoryFolder = await mockupFolderPath.getEntry(categoryName)
    // Get template folder
    const templateFolder = await categoryFolder.getEntry(templateName)

    if (!templateFolder || !templateFolder.isFolder) {
      addLog('error', 'Template folder not found')
      return
    }

    // Get all image files
    const entries = await templateFolder.getEntries()
    const imageFiles = entries.filter((entry) => {
      const ext = entry.name.toLowerCase().split('.').pop()
      return !entry.isFolder && ['jpg', 'jpeg', 'png', 'gif'].includes(ext)
    })

    if (imageFiles.length < 3) {
      addLog('warning', `Only ${imageFiles.length} images found, expected 3`)
    }

    // Store selected images
    selectedMockupImages = imageFiles.slice(0, 3)

    // Display file names and make them clickable (UXP has limitations with image display)
    const { shell } = require('uxp')

    // Helper function to open file in system default application
    async function openImageFile(file) {
      console.log('Click handler called for:', file.name)
      console.log('File native path:', file.nativePath)
      addLog('info', `Attempting to open ${file.name}...`)

      try {
        console.log('Calling shell.openPath...')
        await shell.openPath(file.nativePath)
        console.log('shell.openPath completed successfully')
        addLog('success', `Opened ${file.name} in default viewer`)
      } catch (error) {
        console.error('Error opening file:', error)
        addLog('error', `Failed to open ${file.name}: ${error.message}`)
      }
    }

    // File 1
    if (imageFiles[0]) {
      const file1 = imageFiles[0]
      mockupFile1.querySelector('span:last-child').textContent = file1.name
      mockupFile1.onclick = async () => {
        console.log('File 1 clicked')
        await openImageFile(file1)
      }
      console.log('File 1 click handler attached')
    }

    // File 2
    if (imageFiles[1]) {
      const file2 = imageFiles[1]
      mockupFile2.querySelector('span:last-child').textContent = file2.name
      mockupFile2.onclick = async () => {
        console.log('File 2 clicked')
        await openImageFile(file2)
      }
      console.log('File 2 click handler attached')
    }

    // File 3
    if (imageFiles[2]) {
      const file3 = imageFiles[2]
      mockupFile3.querySelector('span:last-child').textContent = file3.name
      mockupFile3.onclick = async () => {
        console.log('File 3 clicked')
        await openImageFile(file3)
      }
      console.log('File 3 click handler attached')
    }

    // Show preview
    mockupImagesPreview.style.display = 'block'
    addLog('success', `Loaded ${imageFiles.length} mockup images`)

    // Validate button state
    validateStartButton()
  } catch (error) {
    addLog('error', `Failed to load images: ${error.message}`)
    console.error('Error loading images:', error)
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

  // Reset statistics for new automation run
  resetStats()

  // Get all checked checkboxes
  const checkboxes = collectionSelector.querySelectorAll('input[type="checkbox"]:checked')
  const collectionIds = Array.from(checkboxes).map((cb) => cb.value)

  console.log('🔍 DEBUG: Checked checkboxes count:', checkboxes.length)
  console.log('🔍 DEBUG: Collection IDs being sent:', collectionIds)
  addLog('info', `Selected ${collectionIds.length} collection(s): ${JSON.stringify(collectionIds)}`)

  if (collectionIds.length === 0) {
    addLog('error', 'Please select at least one collection')
    return
  }

  // Validate mockup template is selected
  const selectedTemplate = mockupTemplateSelector.querySelector('input[type="checkbox"]:checked')
  const mockupTemplatePath = selectedTemplate ? selectedTemplate.value : ''
  if (!mockupTemplatePath) {
    addLog('error', 'Please select a mockup template')
    return
  }

  // Verify we have 3 mockup files loaded
  if (selectedMockupImages.length !== 3) {
    addLog('error', 'Invalid mockup template - expected 3 files')
    return
  }

  // Set the mockup template folder for the processor BEFORE starting automation
  processor.setMockupTemplateFolder(mockupTemplatePath)
  addLog('info', `Using template: ${mockupTemplatePath}`)

  // Get collection names for logging
  let collectionNames = ''
  if (collectionIds.includes('all')) {
    collectionNames = 'All Collections'
  } else {
    const selectedNames = Array.from(checkboxes).map((cb) => cb.getAttribute('data-name'))
    collectionNames = selectedNames.join(', ')
  }

  // Disable button and checkboxes during processing
  startAutomationBtn.disabled = true
  startAutomationBtn.classList.add('processing')
  const allCheckboxes = collectionSelector.querySelectorAll('input[type="checkbox"]')
  allCheckboxes.forEach((cb) => (cb.disabled = true))
  startAutomationBtn.textContent = 'Traitement en cours...'

  try {
    addLog('info', `Starting automation for: ${collectionNames}`)

    // Give immediate visual feedback - activate step 1 right away
    updateStep(1, 'active')

    const response = await fetch(`${config.BACKEND_URL}/api/mockup/start-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collectionIds: collectionIds,
        mockupTemplatePath: mockupTemplatePath,
        targetImagePosition: targetImagePosition,
      }),
    })

    if (response.ok) {
      const data = await response.json()

      // Validate response success field
      if (!data.success) {
        addLog('error', `Failed to start automation: ${data.message || 'Unknown error'}`)
        enableStartButton()
        return
      }

      // Validate required fields
      if (!data.batchId || data.totalJobs === undefined) {
        addLog('error', 'Invalid response from server: missing required fields')
        enableStartButton()
        return
      }

      // Store batch ID for cleanup
      currentBatchId = data.batchId
      console.log('📦 Batch ID received:', currentBatchId)

      addLog('success', `Automation started! Processing ${data.totalJobs} product(s)`)
    } else {
      const error = await response.json()
      addLog('error', `Failed to start automation: ${error.message || response.statusText}`)
      // Re-enable button if start fails
      enableStartButton()
    }
  } catch (error) {
    addLog('error', `Error starting automation: ${error.message}`)
    // Re-enable button if error occurs
    enableStartButton()
  }
}

/**
 * Enable the start button and checkboxes
 */
function enableStartButton() {
  startAutomationBtn.disabled = false
  startAutomationBtn.classList.remove('processing')
  startAutomationBtn.textContent = 'Démarrer le traitement'
  const allCheckboxes = collectionSelector.querySelectorAll('input[type="checkbox"]')
  allCheckboxes.forEach((cb) => (cb.disabled = false))
}

/**
 * Cleanup files for the current failed job
 */
async function cleanupCurrentJobFiles() {
  if (!currentJobFileInfo) {
    console.log('🗑️  No current job files to cleanup')
    return
  }

  console.log('🗑️  Cleaning up current job files:', currentJobFileInfo)

  // Cleanup temp mockup file in plugin
  try {
    const fs = require('uxp').storage.localFileSystem
    const tempFolder = await fs.getTemporaryFolder()
    const tempFile = await tempFolder.getEntry(currentJobFileInfo.fileName)
    await tempFile.delete()
    console.log('   ✅ Deleted temp mockup file:', currentJobFileInfo.fileName)
    addLog('success', `Cleaned up temp mockup file`)
  } catch (err) {
    console.error('   ❌ Failed to delete temp mockup:', err.message || err)
    // File might not exist if it was already cleaned up, that's okay
  }

  // Cleanup downloaded product image on server
  if (currentBatchId && currentJobFileInfo.productId) {
    console.log(
      `🔍 Calling backend cleanup for batch ${currentBatchId}, product ${currentJobFileInfo.productId}`
    )
    try {
      const response = await fetch(`${config.BACKEND_URL}/api/mockup/cleanup-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchId: currentBatchId,
          productId: currentJobFileInfo.productId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.deletedCount !== undefined) {
          console.log('   ✅ Cleaned up server files:', data)
          addLog('success', `Cleaned up ${data.deletedCount} server file(s)`)
        } else {
          console.error('   ❌ Server cleanup returned error:', data)
          addLog('warning', data.message || 'Failed to cleanup server files')
        }
      } else {
        console.error('   ❌ Server cleanup failed:', response.status)
        addLog('warning', 'Failed to cleanup some server files')
      }
    } catch (error) {
      console.error('   ❌ Server cleanup error:', error.message || error)
      addLog('warning', `Server cleanup error: ${error.message}`)
    }
  } else {
    console.log('   ⚠️  No batch ID or product ID for server cleanup')
  }

  // Clear current job file info
  currentJobFileInfo = null
}

/**
 * Cleanup all files for the current batch
 */
async function cleanupBatchFiles() {
  addLog('info', 'Cleaning up temporary files...')

  // Cleanup temp mockup files in plugin
  let tempFilesDeleted = 0
  if (tempMockupFiles.length > 0) {
    console.log(`🗑️  Cleaning up ${tempMockupFiles.length} temp mockup file(s) in plugin`)
    for (const file of tempMockupFiles) {
      try {
        await file.delete()
        tempFilesDeleted++
        console.log('   ✅ Deleted temp mockup file')
      } catch (err) {
        console.error('   ❌ Failed to delete temp mockup:', err)
      }
    }
    tempMockupFiles = []
  }

  // Cleanup server-side files
  if (!currentBatchId) {
    if (tempFilesDeleted > 0) {
      addLog('success', `Cleaned up ${tempFilesDeleted} temp file(s)`)
    }
    return
  }

  try {
    const response = await fetch(`${config.BACKEND_URL}/api/mockup/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        batchId: currentBatchId,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success && data.deletedCount !== undefined) {
        const totalDeleted = tempFilesDeleted + data.deletedCount
        addLog(
          'success',
          `Cleaned up ${totalDeleted} file(s) (${tempFilesDeleted} local, ${data.deletedCount} server)`
        )
        console.log('✅ Cleanup complete:', data)
        currentBatchId = null
      } else {
        console.error('❌ Cleanup returned error:', data)
        addLog('warning', data.message || 'Failed to cleanup some files')
      }
    } else {
      console.error('❌ Cleanup failed:', response.status)
      addLog('warning', 'Failed to cleanup some files')
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error)
    addLog('warning', `Cleanup error: ${error.message}`)
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

  console.log('🔍 DEBUG addJobToQueue:', {
    jobId: job.id,
    isProcessingJob,
    isPaused,
    queueLength: jobQueue.length,
  })

  // Start processing if not already processing
  if (!isProcessingJob) {
    console.log('🔍 DEBUG addJobToQueue: calling processNextJob()')
    processNextJob()
  } else {
    console.log('🔍 DEBUG addJobToQueue: NOT calling processNextJob (already processing)')
  }
}

/**
 * Process jobs sequentially from the queue
 */
async function processNextJob() {
  console.log('🔍 DEBUG processNextJob called:', {
    isPaused,
    isProcessingJob,
    queueLength: jobQueue.length,
    timestamp: Date.now(),
  })

  // Check if paused
  if (isPaused) {
    console.log('🔍 DEBUG processNextJob: PAUSED - returning')
    addLog('info', 'Processing paused, waiting for user action')
    return
  }

  // If already processing or queue is empty, return
  if (isProcessingJob || jobQueue.length === 0) {
    console.log('🔍 DEBUG processNextJob: already processing or queue empty - returning', {
      isProcessingJob,
      queueLength: jobQueue.length,
    })
    return
  }

  console.log('🔍 DEBUG processNextJob: starting to process job')

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
      // Mockup generation complete (step 5)
      updateStep(5, 'completed')
      addLog('success', 'Mockup generated successfully')

      console.log('🔍 DEBUG: result object:', {
        success: result.success,
        resultPath: result.resultPath,
        fileName: result.fileName,
        hasFileData: !!result.fileData,
        fileDataSize: result.fileData ? result.fileData.byteLength : 0,
      })

      // Track current job's file info for cleanup on error
      currentJobFileInfo = {
        fileName: result.fileName,
        resultPath: result.resultPath,
        jobId: job.id,
        productId: job.productId,
      }
      console.log('🗂️  Tracking file for cleanup:', currentJobFileInfo)

      // Send completion message to backend (includes Shopify upload trigger)
      if (client && client.isConnected()) {
        try {
          // Step 6: Uploading mockup file to backend server
          updateStep(6, 'active')
          addLog('info', 'Uploading mockup file to server...')

          console.log('🔍 DEBUG: result.resultPath:', result.resultPath)
          console.log('🔍 DEBUG: result.fileName:', result.fileName)
          console.log(
            '🔍 DEBUG: Has fileData:',
            !!result.fileData,
            'Has outputFile:',
            !!result.outputFile
          )

          let fileData = result.fileData

          // Fallback: If file wasn't read in modal scope, try reading it now
          if (!fileData && result.outputFile) {
            console.log('🔍 DEBUG: Attempting fallback file read from outputFile')
            try {
              const fs = require('uxp').storage
              fileData = await result.outputFile.read({ format: fs.formats.binary })
              console.log('🔍 DEBUG: Fallback read successful, size:', fileData.byteLength)
            } catch (fallbackError) {
              console.error('❌ DEBUG: Fallback read failed:', fallbackError)
              throw new Error(
                `Failed to read mockup file: ${fallbackError?.message || 'Unknown error'}`
              )
            }
          }

          if (!fileData) {
            console.error('❌ DEBUG: No fileData available')
            throw new Error('No mockup file data available for upload')
          }

          console.log('🔍 DEBUG: Using fileData, size:', fileData.byteLength)

          // Create FormData for file upload
          const formData = new FormData()

          const blob = new Blob([fileData], { type: 'image/jpeg' })
          console.log('🔍 DEBUG: Blob created, size:', blob.size)

          formData.append('mockup', blob, result.fileName)
          formData.append('fileName', result.fileName)
          formData.append('batchId', currentBatchId) // Track file to batch for cleanup

          // Upload file to backend
          console.log('🔍 DEBUG: Uploading to:', `${config.BACKEND_URL}/api/mockup/upload`)
          const uploadResponse = await fetch(`${config.BACKEND_URL}/api/mockup/upload`, {
            method: 'POST',
            body: formData,
          })
          console.log('🔍 DEBUG: Upload response status:', uploadResponse.status)

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            console.error('❌ DEBUG: Upload failed:', errorText)
            throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`)
          }

          const uploadResult = await uploadResponse.json()
          console.log('🔍 DEBUG: Upload result:', uploadResult)
          addLog('success', `Mockup uploaded: ${uploadResult.fileName}`)

          // Now send completion message with server file path
          addLog('info', 'Uploading to Shopify...')
          console.log('🔍 DEBUG: Sending completion with filePath:', uploadResult.filePath)

          const response = await client.send({
            jobId: job.id,
            resultPath: uploadResult.filePath,
            imageUrl: job.imageUrl,
            productId: job.productId,
            targetImagePosition: job.targetImagePosition,
            success: true,
          })

          console.log('🔍 DEBUG: Completion response:', response)

          // Check if backend returned an error (Shopify upload failed)
          if (response && response.error) {
            console.error('❌ DEBUG: Backend returned error:', response)
            console.log('🔍 DEBUG: Error details:', {
              errorMessage: response.errorMessage,
              resultPath: response.resultPath,
              productId: response.productId,
            })

            updateStep(6, 'error')
            const error = new Error(response.errorMessage || 'Shopify upload failed')
            // Attach response data to error for modal display
            error.resultPath = response.resultPath || uploadResult.filePath || result.resultPath
            error.productId = response.productId

            console.log('🔍 DEBUG: Error object being thrown:', {
              message: error.message,
              resultPath: error.resultPath,
              productId: error.productId,
            })

            throw error
          }

          // Step 6 complete: Upload to Shopify done
          updateStep(6, 'completed')

          // Step 7: Reorder media (if needed)
          if (response && response.reordered) {
            updateStep(7, 'active')
            addLog('info', 'Reordering images on Shopify...')
            updateStep(7, 'completed')
            addLog('success', 'Images reordered successfully')
          } else {
            updateStep(7, 'completed')
            addLog('info', 'No reordering needed')
          }

          // Step 8: Detach old media (if needed)
          if (response && response.oldMediaDetached) {
            updateStep(8, 'active')
            addLog('info', 'Removing old image from product...')
            updateStep(8, 'completed')
            addLog('success', 'Old image removed from product')
          } else {
            updateStep(8, 'completed')
            addLog('info', 'No old image to remove')
          }

          // Step 9: Final - Saved on Shopify
          updateStep(9, 'active')
          addLog('info', 'Finalizing on Shopify...')
          updateStep(9, 'completed')
          addLog('success', 'File processed and saved on Shopify')

          // Clean up temp mockup file after successful Shopify upload
          try {
            const fs = require('uxp').storage.localFileSystem
            const tempFolder = await fs.getTemporaryFolder()
            const tempFile = await tempFolder.getEntry(result.fileName)
            await tempFile.delete()
            console.log('🗑️  Cleaned up temp mockup file after success:', result.fileName)
            // Clear file info since we successfully cleaned it up
            currentJobFileInfo = null
          } catch (cleanupErr) {
            console.error('⚠️  Failed to delete temp mockup:', cleanupErr.message)
          }

          // Mark job as fully completed
          markJobCompleted(true)

          jobsCompleted++
          updateStats()
          addLog('success', `Job ${job.id} completed successfully`)
        } catch (error) {
          console.error('❌ DEBUG: Error in upload/Shopify flow:', error)
          console.log('🔍 DEBUG: Error object:', {
            message: error.message,
            resultPath: error.resultPath,
            productId: error.productId,
            stack: error.stack,
          })

          addLog('error', `Failed to upload to Shopify: ${error.message}`)

          // Mark current step as error
          updateStep(9, 'error')

          console.log('🔍 DEBUG: Showing error modal with job:', {
            jobTitle: job.productTitle,
            jobId: job.id,
          })

          // Show error modal and pause
          showErrorModal(job, error)

          // Mark as no longer processing so we can resume later
          isProcessingJob = false

          // Don't process next job - wait for user to click Continue
          return
        }
      } else {
        // No backend connection, just mark as complete
        markJobCompleted(true)
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
    console.log('🔍 DEBUG finally block:', {
      isPaused,
      isProcessingJob,
      queueLength: jobQueue.length,
    })

    // Mark as not processing
    isProcessingJob = false

    // Only process next job if not paused (waiting for user input from error modal)
    if (isPaused) {
      console.log('⏸️  Processing paused - waiting for user input')
      console.log('🔍 DEBUG finally: returning because isPaused is true')
      return
    }

    console.log('🔍 DEBUG finally: NOT paused, checking queue')

    // Process next job if any
    if (jobQueue.length > 0) {
      addLog('info', `Processing next job (${jobQueue.length} remaining)`)
      console.log('🔍 DEBUG finally: scheduling processNextJob() with 500ms delay')
      // Small delay before next job to ensure UI updates
      setTimeout(() => processNextJob(), 500)
    } else {
      addLog('success', 'All jobs completed!')
      // Cleanup all temporary files
      await cleanupBatchFiles()
      // Re-enable the start button
      enableStartButton()
      // Reset to idle after showing final state
      resetToIdle()
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
    statusText.textContent = 'Connecté'
    connectBtn.textContent = 'Se déconnecter'
    connectBtn.className = 'button danger'
  } else {
    statusIndicator.className = 'status-indicator disconnected'
    statusText.textContent = 'Déconnecté'
    connectBtn.textContent = 'Se connecter au serveur'
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
 * Reset statistics counters
 */
function resetStats() {
  jobsReceived = 0
  jobsCompleted = 0
  updateStats()
  addLog('info', 'Statistics reset for new automation run')
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
    jobTitle.textContent = 'En attente...'
    resetSteps()
  }, 3000) // Keep completion state visible for 3 seconds
}

/**
 * Reset all steps to initial state
 */
function resetSteps() {
  // Clear any dot animation
  if (dotAnimationInterval) {
    clearInterval(dotAnimationInterval)
    dotAnimationInterval = null
  }

  const steps = [step1, step2, step3, step4, step5, step6, step7, step8, step9]
  steps.forEach((step) => {
    step.classList.remove('active', 'completed', 'error')
    const icon = step.querySelector('.step-icon')
    icon.innerHTML = '○'
  })
  progressBar.style.width = '0%'
  progressText.textContent = 'Étape 0 sur 9'
}

/**
 * Reset all processing steps to initial state
 */
function resetSteps() {
  const steps = [step1, step2, step3, step4, step5, step6, step7, step8, step9]

  // Clear any existing dot animation
  if (dotAnimationInterval) {
    clearInterval(dotAnimationInterval)
    dotAnimationInterval = null
  }

  // Reset each step
  steps.forEach((step) => {
    if (!step) return

    // Remove all status classes
    step.classList.remove('active', 'completed', 'error')

    // Reset icon to circle
    const icon = step.querySelector('.step-icon')
    if (icon) icon.innerHTML = '○'

    // Remove animated dots if they exist
    const textSpan = step.querySelector('span:nth-child(2)')
    if (textSpan) {
      const dotsSpan = textSpan.querySelector('.animated-dots')
      if (dotsSpan) dotsSpan.remove()
    }
  })

  // Reset progress bar
  progressBar.style.width = '0%'
  progressText.textContent = 'Prêt à démarrer'
}

/**
 * Update processing step
 */
function updateStep(stepNumber, status = 'active') {
  const steps = [step1, step2, step3, step4, step5, step6, step7, step8, step9]
  const step = steps[stepNumber - 1]

  if (!step) return

  // Clear any existing dot animation
  if (dotAnimationInterval) {
    clearInterval(dotAnimationInterval)
    dotAnimationInterval = null
  }

  // Remove all status classes from this step
  step.classList.remove('active', 'completed', 'error')

  // Update icon and class based on status
  const icon = step.querySelector('.step-icon')
  const textSpan = step.querySelector('span:nth-child(2)') // Get the text span (second child)

  if (status === 'active') {
    step.classList.add('active')
    // Keep the circle in the icon
    icon.innerHTML = '○'

    // Add animated dots after the text
    if (textSpan && !textSpan.querySelector('.animated-dots')) {
      const dotsSpan = document.createElement('span')
      dotsSpan.className = 'animated-dots'
      textSpan.appendChild(dotsSpan)
    }

    // Start JavaScript-based dot animation
    let dotCount = 0
    dotAnimationInterval = setInterval(() => {
      const dotsSpan = step.querySelector('.animated-dots')
      if (dotsSpan) {
        dotCount = (dotCount + 1) % 4 // Cycle 0, 1, 2, 3
        dotsSpan.textContent = '.'.repeat(dotCount)
      }
    }, 500) // Change every 500ms
  } else if (status === 'completed') {
    step.classList.add('completed')
    icon.innerHTML = '✓'
    // Remove dots if they exist
    if (textSpan) {
      const dotsSpan = textSpan.querySelector('.animated-dots')
      if (dotsSpan) dotsSpan.remove()
    }
  } else if (status === 'error') {
    step.classList.add('error')
    icon.innerHTML = '✗'
    // Remove dots if they exist
    if (textSpan) {
      const dotsSpan = textSpan.querySelector('.animated-dots')
      if (dotsSpan) dotsSpan.remove()
    }
  }

  // Update progress bar
  const progress = (stepNumber / 9) * 100
  progressBar.style.width = `${progress}%`
  progressText.textContent = `Étape ${stepNumber} sur 9`

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
    progressText.textContent = 'Terminé !'

    // Mark all steps as completed
    const steps = [step1, step2, step3, step4, step5, step6, step7]
    steps.forEach((step) => {
      step.classList.remove('active', 'error')
      step.classList.add('completed')
      const icon = step.querySelector('.step-icon')
      icon.innerHTML = '✓'
    })
  } else {
    currentJobSection.classList.add('error')
    progressText.textContent = 'Échec !'
  }

  // Don't reset here - let the next job reset when it starts,
  // or let the batch completion reset after showing final state
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
