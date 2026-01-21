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
   * Recursively search for smart object layer with path tracking
   */
  findSmartObjectInLayers(layers, targetName = null, currentPath = '') {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i]
      const layerPath = currentPath ? `${currentPath} > ${layer.name}` : layer.name

      // 🔍 DEBUG LOG: Show every layer we're checking
      this.log(
        'info',
        `🔍 Checking layer: "${layer.name}" | kind: "${layer.kind}" | path: "${layerPath}"`
      )

      if (targetName) {
        const nameMatch = layer.name.toLowerCase().trim() === targetName.toLowerCase().trim()
        const kindMatch = layer.kind === 'smartObject'
        this.log(
          'info',
          `  → Name match ("${layer.name.trim()}" === "${targetName}"): ${nameMatch}`
        )
        this.log('info', `  → Kind match (${layer.kind} === smartObject): ${kindMatch}`)
      }

      // Check if this layer is the smart object we're looking for
      if (
        targetName &&
        layer.name.toLowerCase().trim() === targetName.toLowerCase().trim() &&
        layer.kind === 'smartObject'
      ) {
        this.log('success', `✅ FOUND MATCH: "${layer.name}" at "${layerPath}"`)
        return { layer, path: layerPath }
      }

      // If no target name, return first smart object
      if (!targetName && layer.kind === 'smartObject') {
        return { layer, path: layerPath }
      }

      // If this is a group, search recursively inside it
      if (layer.kind === 'group' && layer.layers) {
        this.log(
          'info',
          `  → Entering group "${layer.name}" (has ${layer.layers.length} sublayers)`
        )
        const found = this.findSmartObjectInLayers(layer.layers, targetName, layerPath)
        if (found) {
          return found
        }
      }
    }

    return null
  }

  /**
   * Find smart object layer named "Artwork"
   */
  async findSmartObjectLayer(doc) {
    this.log('info', 'Searching for smart object layer named "Artwork"...')

    try {
      // Search for layer named "Artwork" (case-insensitive, recursive)
      const result = this.findSmartObjectInLayers(doc.layers, 'Artwork')

      if (result) {
        const { layer, path } = result
        this.log('success', `Found smart object "Artwork" at: ${path}`)

        // Log nesting level for transparency
        const nestingLevel = path.split(' > ').length - 1
        if (nestingLevel > 0) {
          this.log('info', `Layer is nested ${nestingLevel} level(s) deep`)
        } else {
          this.log('info', 'Layer is at root level')
        }

        return layer
      }

      // No fallback - "Artwork" is mandatory
      throw new Error(
        'Smart object layer "Artwork" not found in template. ' +
          'Please ensure your PSD template contains a smart object layer named "Artwork" (case-insensitive).'
      )
    } catch (error) {
      this.log('error', `Smart object search failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Validate all mockup templates in folder for "Artwork" smart object
   * @returns {Object} { valid: boolean, errors: Array<{fileName, error}> }
   */
  async validateMockupTemplates(mockupTemplatePath) {
    this.log('info', '🔍 Starting mockup template validation...')
    this.log('info', `Checking all PSD files in: ${mockupTemplatePath}`)

    const errors = []

    try {
      // Get plugin folder and navigate to template folder
      const pluginFolder = await fs.getPluginFolder()
      const mockupsFolder = await pluginFolder.getEntry('mockups')

      const [categoryName, subfolderName] = mockupTemplatePath.split('/')
      const categoryFolder = await mockupsFolder.getEntry(categoryName)
      const templateFolder = await categoryFolder.getEntry(subfolderName)

      // Get all PSD/PSB files in the template folder
      const entries = await templateFolder.getEntries()
      const psdFiles = entries.filter((entry) => {
        const ext = entry.name.toLowerCase().split('.').pop()
        return !entry.isFolder && (ext === 'psd' || ext === 'psb')
      })

      if (psdFiles.length === 0) {
        this.log('error', 'No PSD/PSB files found in template folder')
        return {
          valid: false,
          errors: [{ fileName: mockupTemplatePath, error: 'No PSD/PSB files found' }],
        }
      }

      this.log('info', `Found ${psdFiles.length} PSD file(s) to validate`)

      // Validate each PSD file
      for (const psdFile of psdFiles) {
        this.log('info', `Validating: ${psdFile.name}...`)

        let fileHasArtwork = false

        try {
          // Open document in modal scope
          await require('photoshop').core.executeAsModal(
            async () => {
              let doc = null
              try {
                // Open the document
                doc = await app.open(psdFile)
                this.log('info', `  ✓ Opened: ${psdFile.name}`)

                // Try to find "Artwork" smart object
                const result = this.findSmartObjectInLayers(doc.layers, 'Artwork')

                if (result) {
                  const { path } = result
                  this.log('success', `  ✓ Found "Artwork" at: ${path}`)
                  fileHasArtwork = true
                } else {
                  // "Artwork" not found
                  this.log('error', `  ✗ Smart object "Artwork" NOT FOUND in ${psdFile.name}`)
                  fileHasArtwork = false
                }
              } finally {
                // Always close the document without saving
                if (doc) {
                  await doc.close('no')
                  this.log('info', `  ✓ Closed: ${psdFile.name}`)
                }
              }
            },
            {
              commandName: `Validate ${psdFile.name}`,
              interactive: false,
            }
          )

          // Add error after modal scope if Artwork not found
          if (!fileHasArtwork) {
            const errorMsg = 'Smart object "Artwork" not found'
            errors.push({ fileName: psdFile.name, error: errorMsg })
            this.log('error', `  ✗ Added ${psdFile.name} to error list`)
          }
        } catch (error) {
          this.log('error', `  ✗ Exception validating ${psdFile.name}: ${error.message}`)
          errors.push({ fileName: psdFile.name, error: error.message })
        }
      }

      // Report results
      if (errors.length > 0) {
        this.log('error', `❌ Validation failed: ${errors.length} file(s) with errors`)
        return { valid: false, errors }
      } else {
        this.log(
          'success',
          `✅ Validation passed: All ${psdFiles.length} file(s) contain "Artwork"`
        )
        return { valid: true, errors: [] }
      }
    } catch (error) {
      this.log('error', `Validation error: ${error.message}`)
      return {
        valid: false,
        errors: [{ fileName: 'Unknown', error: error.message }],
      }
    }
  }

  /**
   * Replace smart object contents using "Replace Contents" command
   */
  async replaceSmartObject(layer, imageFile, mainDoc) {
    this.log('info', `Replacing smart object with: ${imageFile.name}`)

    try {
      const { batchPlay } = require('photoshop').action
      const { storage } = require('uxp')

      // Get file token for the image file
      const token = await storage.localFileSystem.createSessionToken(imageFile)

      // Open the smart object for editing
      this.log('info', 'Opening smart object for editing...')
      const { app } = require('photoshop')

      const beforeDocCount = app.documents.length
      this.log(
        'info',
        `Before opening: active doc = "${app.activeDocument?.name}", total docs = ${beforeDocCount}`
      )

      // Diagnostic: Log layer properties
      this.log('info', '🔍 Layer diagnostics:')
      this.log('info', `  - Layer name: "${layer.name}"`)
      this.log('info', `  - Layer kind: ${layer.kind}`)
      this.log('info', `  - Layer locked: ${layer.locked}`)
      this.log('info', `  - Layer visible: ${layer.visible}`)
      this.log('info', `  - Layer typename: ${layer.typename}`)
      this.log('info', `  - Layer id: ${layer.id}`)
      this.log('info', `  - Layer bounds: ${JSON.stringify(layer.bounds)}`)

      // Select the smart object layer explicitly by ID using batchPlay
      this.log('info', `Selecting layer by ID: ${layer.id}`)
      try {
        await batchPlay(
          [
            {
              _obj: 'select',
              _target: [{ _ref: 'layer', _id: layer.id }],
              makeVisible: false,
            },
          ],
          {}
        )
        this.log('info', 'Layer selected via batchPlay')
      } catch (error) {
        this.log('error', `Failed to select layer: ${error.message}`)
      }

      // Try to open the smart object with explicit layer reference
      try {
        await batchPlay(
          [
            {
              _obj: 'placedLayerEditContents',
              _target: [{ _ref: 'layer', _id: layer.id }],
            },
          ],
          {}
        )
      } catch (error) {
        this.log('error', `Failed to open smart object: ${error.message}`)
        throw new Error(`Cannot open smart object for editing: ${error.message}`)
      }

      // Wait longer for smart object to open (some templates need more time)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const smartObjectDoc = app.activeDocument
      const afterDocCount = app.documents.length
      this.log(
        'info',
        `After opening: active doc = "${smartObjectDoc?.name}", ID = ${smartObjectDoc?.id}, total docs = ${afterDocCount}`
      )

      // Verify the smart object actually opened
      if (afterDocCount === beforeDocCount) {
        this.log('error', 'Smart object did not open! Document count did not increase.')
        throw new Error(
          `Smart object failed to open. The layer might be locked, corrupted, or not a valid embedded smart object.`
        )
      }

      // List all open documents
      const docNames = app.documents.map((d) => `"${d.name}" (ID:${d.id})`).join(', ')
      this.log('info', `All open documents: ${docNames}`)

      // Place the new image
      this.log('info', 'Placing new image as top layer in smart object...')
      await batchPlay(
        [
          {
            _obj: 'placeEvent',
            null: { _path: token, _kind: 'local' },
            freeTransformCenterState: { _enum: 'quadCenterState', _value: 'QCSAverage' },
          },
        ],
        {}
      )

      // Get canvas and image dimensions for cover calculation
      const canvas = { width: smartObjectDoc.width, height: smartObjectDoc.height }
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
      const scale = Math.max(scaleX, scaleY) * 100

      this.log('info', `Applying cover scale: ${scale.toFixed(2)}%`)

      // Transform the image to cover the canvas
      await batchPlay(
        [
          {
            _obj: 'transform',
            freeTransformCenterState: { _enum: 'quadCenterState', _value: 'QCSAverage' },
            offset: {
              _obj: 'offset',
              horizontal: { _unit: 'pixelsUnit', _value: 0 },
              vertical: { _unit: 'pixelsUnit', _value: 0 },
            },
            width: { _unit: 'percentUnit', _value: scale },
            height: { _unit: 'percentUnit', _value: scale },
            interfaceIconFrameDimmed: { _enum: 'interpolationType', _value: 'bicubic' },
          },
        ],
        {}
      )

      // Center the image
      await batchPlay(
        [
          {
            _obj: 'align',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            using: { _enum: 'alignDistributeSelector', _value: 'ADSCentersH' },
          },
          {
            _obj: 'align',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
            using: { _enum: 'alignDistributeSelector', _value: 'ADSCentersV' },
          },
        ],
        {}
      )

      // Rasterize
      await batchPlay(
        [
          {
            _obj: 'rasterizeLayer',
            _target: [{ _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
          },
        ],
        {}
      )

      // Save the smart object - DO NOT CLOSE IT
      this.log('info', 'Saving smart object (leaving it open)...')
      await batchPlay([{ _obj: 'save' }], {})

      // Switch back to main document by making it active
      // Find it in the documents array (should be there alongside the smart object doc)
      this.log('info', 'Switching back to main document...')
      const mainDocInArray = app.documents.find(
        (d) => d.id === mainDoc.id || d.name === mainDoc.name
      )

      if (mainDocInArray) {
        // Make main doc active by selecting it
        await batchPlay(
          [
            {
              _obj: 'select',
              _target: [{ _ref: 'document', _id: mainDocInArray.id }],
            },
          ],
          {}
        )
        this.log('success', 'Switched to main document')

        // Update the smart object layer to reflect changes (auto-click "Update")
        this.log('info', 'Updating smart object layer in main document...')
        await batchPlay(
          [
            {
              _obj: 'placedLayerUpdateAllModified',
            },
          ],
          {}
        )
        this.log('success', 'Smart object layer updated')

        // Now close the smart object document to prevent accumulation
        this.log('info', `Closing smart object document: ${smartObjectDoc.name}`)
        await smartObjectDoc.close('no') // Don't save again, we already saved
        this.log('success', 'Smart object document closed')

        return mainDocInArray
      }

      // Fallback: just return the original reference and hope it still works
      this.log('warning', 'Could not find main doc in array, using original reference')
      return mainDoc
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
          const mainDocAfter = await this.replaceSmartObject(smartObject, productImage, doc)
          this.step(4, 'completed')

          // Use the returned main document reference (found by ID)
          doc = mainDocAfter
          this.log('info', 'Using main document reference returned from smart object replacement')

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
let jobsFailed = 0 // Counter for failed jobs
let failedProducts = [] // Array of {productId, productTitle, errorMessage, resultPath, timestamp}

// Client and processor
let client = null
let processor = null
let paintingCollections = []

// Range selection state
let mergedProducts = [] // All products from selected collections (merged)
let rangeStart = 1
let rangeEnd = 1
let filteredProducts = [] // Final products after range filter
let isFirstRangeUpdate = true // Track if this is the first time range UI is shown
let previousTotalProducts = 0 // Track previous total to detect if user had full range

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
let insertMode = 'replace' // 'replace' or 'insert' - default to replace (current behavior)
let selectedMockupContext = '' // Content from context.txt file in template folder
let dotAnimationInterval = null // Track the dot animation interval

// Mode selection state
let currentMode = 'collections' // 'collections' or 'products'
let allProducts = [] // Flat list of ALL products from all collections
let selectedProductIds = new Set() // Track selected products in Products mode
let productSearchQuery = '' // Current search query

/**
 * Centralized UI visibility management
 * Controls what sections are visible based on connection state and current mode
 */
function updateUIVisibility() {
  const isConnected = client && client.isConnected()
  const mode = currentMode || 'collections'

  console.log('🎨 Updating UI visibility:', { isConnected, mode })

  // Get elements
  const modeToggleSection = document.getElementById('modeToggleSection')
  const collectionSelectorWrapper = document.getElementById('collectionSelectorWrapper')
  const productsModeSection = document.getElementById('productsModeSection')
  const mockupTemplateSection = document.getElementById('mockupTemplateSection')
  const imagePositionSection = document.getElementById('imagePositionSection')
  const insertModeSection = document.getElementById('insertModeSection')
  const startAutomationBtn = document.getElementById('startAutomationBtn')

  // Mode toggle: visible when connected
  if (modeToggleSection) {
    modeToggleSection.style.display = isConnected ? 'block' : 'none'
  }

  // Collections mode UI: visible when connected AND collections mode
  if (collectionSelectorWrapper) {
    collectionSelectorWrapper.style.display =
      isConnected && mode === 'collections' ? 'block' : 'none'
  }

  // Products mode UI: visible when connected AND products mode
  if (productsModeSection) {
    productsModeSection.style.display = isConnected && mode === 'products' ? 'block' : 'none'
  }

  // Shared elements: visible when connected
  if (mockupTemplateSection) {
    mockupTemplateSection.style.display = isConnected ? 'block' : 'none'
  }

  if (imagePositionSection) {
    imagePositionSection.style.display = isConnected ? 'block' : 'none'
  }

  if (insertModeSection) {
    insertModeSection.style.display = isConnected ? 'block' : 'none'
  }

  if (startAutomationBtn) {
    startAutomationBtn.style.display = isConnected ? 'block' : 'none'
  }

  console.log('✅ UI visibility updated')
}

/**
 * Validate if Start Processing button should be enabled
 */
function validateStartButton() {
  // Safety check - ensure elements exist
  if (!collectionSelector || !mockupTemplateSelector || !startAutomationBtn) {
    console.log('Validation skipped - elements not ready')
    return
  }

  // Check based on current mode (default to 'collections' if undefined)
  let hasValidSelection = false

  if (!currentMode || currentMode === 'collections') {
    // Collections mode: check collections OR range products
    const checkedCollections = collectionSelector.querySelectorAll('input[type="checkbox"]:checked')
    const hasCollection = checkedCollections.length > 0
    const hasRangeProducts = filteredProducts.length > 0
    hasValidSelection = hasCollection || hasRangeProducts
  } else if (currentMode === 'products') {
    // Products mode: check if any products selected
    hasValidSelection = selectedProductIds.size > 0
  }

  // Check if a template is selected
  const selectedTemplate = mockupTemplateSelector.querySelector('input[type="checkbox"]:checked')
  const templateValue = selectedTemplate ? selectedTemplate.value : ''
  const hasTemplate = templateValue !== '' && templateValue !== null && templateValue !== undefined

  console.log('Validation:', {
    mode: currentMode,
    hasValidSelection,
    selectedCount: currentMode === 'products' ? selectedProductIds.size : filteredProducts.length,
    hasTemplate,
    templateValue,
  })

  // Enable button if valid selection AND template selected
  const isValid = hasValidSelection && hasTemplate

  if (isValid) {
    startAutomationBtn.disabled = false
    startAutomationBtn.title = ''
    console.log('✅ Button enabled')
  } else {
    startAutomationBtn.disabled = true
    if (!hasValidSelection && !hasTemplate) {
      startAutomationBtn.title =
        currentMode === 'collections'
          ? 'Please select collections and a mockup template'
          : 'Please select products and a mockup template'
    } else if (!hasValidSelection) {
      startAutomationBtn.title =
        currentMode === 'collections'
          ? 'Please select at least one collection'
          : 'Please select at least one product'
    } else {
      startAutomationBtn.title = 'Please select a mockup template'
    }
    console.log('❌ Button disabled:', startAutomationBtn.title)
  }
}

/**
 * Merge all products from selected collections into single array
 * @returns {Array} Array of products with {id, title, collectionName} structure
 */
function getMergedProducts() {
  const checkedCollections = collectionSelector.querySelectorAll('.collection-checkbox:checked')
  const allCheckbox = collectionSelector.querySelector('input[value="all"]')

  let products = []

  if (allCheckbox && allCheckbox.checked) {
    // All collections selected - merge all products
    paintingCollections.forEach((collection) => {
      if (collection.products && collection.products.length > 0) {
        collection.products.forEach((product) => {
          products.push({
            id: product.id,
            title: product.title,
            collectionName: collection.title,
            onlineStoreUrl: product.onlineStoreUrl,
          })
        })
      }
    })
  } else {
    // Specific collections selected
    checkedCollections.forEach((checkbox) => {
      const collectionId = checkbox.value
      const collection = paintingCollections.find((c) => c.id === collectionId)

      if (collection && collection.products && collection.products.length > 0) {
        collection.products.forEach((product) => {
          products.push({
            id: product.id,
            title: product.title,
            collectionName: collection.title,
            onlineStoreUrl: product.onlineStoreUrl,
          })
        })
      }
    })
  }

  // Deduplicate products by ID (in case a product appears in multiple collections)
  const uniqueProducts = []
  const seenIds = new Set()

  products.forEach((product) => {
    if (!seenIds.has(product.id)) {
      seenIds.add(product.id)
      uniqueProducts.push(product)
    }
  })

  if (products.length !== uniqueProducts.length) {
    console.log(`⚠️  Removed ${products.length - uniqueProducts.length} duplicate product(s)`)
  }

  console.log(`📦 Merged ${uniqueProducts.length} unique products from selected collections`)
  return uniqueProducts
}

/**
 * Update range selection section visibility and state
 */
function updateRangeSelectionUI() {
  const rangeSection = document.getElementById('rangeSelectionSection')
  const totalCountSpan = document.getElementById('totalProductsCount')
  const rangeStartInput = document.getElementById('rangeStartInput')
  const rangeEndInput = document.getElementById('rangeEndInput')

  // Get merged products
  mergedProducts = getMergedProducts()
  const totalProducts = mergedProducts.length

  // Show/hide range section based on whether collections are selected
  if (totalProducts > 0) {
    rangeSection.style.display = 'block'
    totalCountSpan.textContent = `${totalProducts} produits au total dans les collections sélectionnées`

    // Set max values for inputs
    rangeStartInput.max = totalProducts
    rangeEndInput.max = totalProducts

    const currentEnd = parseInt(rangeEndInput.value) || 1

    // Auto-update end value in these cases:
    // 1. First time showing range UI
    // 2. Current end exceeds new total (clamp down)
    // 3. User had full range selected before (end === previousTotal) and total increased
    if (isFirstRangeUpdate) {
      // First show - set to full range
      rangeEndInput.value = totalProducts
      rangeEnd = totalProducts
      isFirstRangeUpdate = false
    } else if (currentEnd > totalProducts) {
      // Current end exceeds new total - clamp down
      rangeEndInput.value = totalProducts
      rangeEnd = totalProducts
    } else if (currentEnd === previousTotalProducts && totalProducts > previousTotalProducts) {
      // User had full range selected and total increased - expand to new total
      rangeEndInput.value = totalProducts
      rangeEnd = totalProducts
    }

    // Update previous total for next comparison
    previousTotalProducts = totalProducts

    // Validate and update preview
    validateRange()
  } else {
    rangeSection.style.display = 'none'
    // Clear filtered products to prevent stale data
    filteredProducts = []
    // Clear preview
    const previewList = document.getElementById('productPreviewList')
    previewList.innerHTML =
      '<div style="color: #999; font-size: 12px; text-align: center; padding: 20px;">Sélectionnez des collections pour voir les produits</div>'
    // Reset flags so next time range UI appears, it auto-sets end value
    isFirstRangeUpdate = true
    previousTotalProducts = 0
    // Re-validate start button since filteredProducts changed
    validateStartButton()
  }
}

/**
 * Validate range inputs and show/hide error messages
 * @returns {boolean} True if valid, false otherwise
 */
function validateRange() {
  const rangeStartInput = document.getElementById('rangeStartInput')
  const rangeEndInput = document.getElementById('rangeEndInput')
  const errorDiv = document.getElementById('rangeValidationError')
  const errorText = document.getElementById('rangeValidationText')

  rangeStart = parseInt(rangeStartInput.value) || 1
  rangeEnd = parseInt(rangeEndInput.value) || 1

  const totalProducts = mergedProducts.length

  // Validation checks
  if (rangeStart < 1) {
    errorDiv.style.display = 'block'
    errorText.textContent = "L'index de début doit être >= 1"
    filteredProducts = []
    updateProductPreview()
    validateStartButton()
    return false
  }

  if (rangeEnd > totalProducts) {
    errorDiv.style.display = 'block'
    errorText.textContent = `L'index de fin ne peut pas dépasser ${totalProducts}`
    filteredProducts = []
    updateProductPreview()
    validateStartButton()
    return false
  }

  if (rangeStart > rangeEnd) {
    errorDiv.style.display = 'block'
    errorText.textContent = "L'index de début doit être <= index de fin"
    filteredProducts = []
    updateProductPreview()
    validateStartButton()
    return false
  }

  // Valid range - hide error
  errorDiv.style.display = 'none'

  // Calculate filtered products (1-based to 0-based indexing)
  filteredProducts = mergedProducts.slice(rangeStart - 1, rangeEnd)

  console.log(`✅ Valid range: ${rangeStart}-${rangeEnd} (${filteredProducts.length} products)`)

  // Update preview
  updateProductPreview()

  // Re-validate start button
  validateStartButton()

  return true
}

/**
 * Update the product preview list showing filtered products
 */
function updateProductPreview() {
  const previewList = document.getElementById('productPreviewList')
  const countSpan = document.getElementById('selectedProductCount')

  countSpan.textContent = filteredProducts.length

  if (filteredProducts.length === 0) {
    previewList.innerHTML =
      '<div style="color: #999; font-size: 12px; text-align: center; padding: 20px;">Aucun produit dans cette plage</div>'
    return
  }

  // Build preview HTML (using map for better performance)
  const html = filteredProducts
    .map((product, index) => {
      const displayIndex = rangeStart + index
      const numericId = product.id.split('/').pop()
      // Escape HTML to prevent XSS attacks
      const escapedTitle = product.title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

      return `
      <div class="product-preview-item" data-product-id="${numericId}" title="Cliquer pour copier l'ID: ${numericId}">
        <span style="color: #2196f3; font-weight: 500; min-width: 40px;">${displayIndex}.</span>
        <span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapedTitle}</span>
        <span class="product-preview-id">#${numericId}</span>
      </div>
    `
    })
    .join('')

  previewList.innerHTML = html

  // Add click handlers to copy product ID to clipboard
  const previewItems = previewList.querySelectorAll('.product-preview-item')
  previewItems.forEach((item) => {
    item.addEventListener('click', async () => {
      const productId = item.getAttribute('data-product-id')
      try {
        await navigator.clipboard.writeText(productId)
        // Visual feedback
        const originalBg = item.style.backgroundColor
        item.style.backgroundColor = '#2196f3'
        setTimeout(() => {
          item.style.backgroundColor = originalBg
        }, 200)
        addLog('success', `✅ Product ID copied: ${productId}`)
      } catch (error) {
        addLog('error', `Failed to copy ID: ${error.message}`)
      }
    })
  })
}

/**
 * Setup event listeners for range inputs
 */
function setupRangeInputListeners() {
  const rangeStartInput = document.getElementById('rangeStartInput')
  const rangeEndInput = document.getElementById('rangeEndInput')

  rangeStartInput.addEventListener('input', () => {
    validateRange()
  })

  rangeEndInput.addEventListener('input', () => {
    validateRange()
  })

  // Also validate on blur to handle empty/invalid values
  rangeStartInput.addEventListener('blur', () => {
    if (!rangeStartInput.value) {
      rangeStartInput.value = 1
    }
    validateRange()
  })

  rangeEndInput.addEventListener('blur', () => {
    if (!rangeEndInput.value) {
      // Set to total products, or 1 if no products (edge case safety)
      rangeEndInput.value = mergedProducts.length || 1
    }
    validateRange()
  })
}

/**
 * Show error modal (DEPRECATED - kept for rollback purposes)
 * Note: No longer used in automatic error flow
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
 * Hide error modal (DEPRECATED - kept for rollback purposes)
 */
function hideErrorModal() {
  console.log('🔍 DEBUG: hideErrorModal called')
  document.getElementById('errorModal').style.display = 'none'
}

/**
 * Track failed product for end-of-batch summary
 */
function trackFailedProduct(job, error) {
  try {
    const failureRecord = {
      productId: job.productId,
      productTitle: job.productTitle,
      errorMessage: error.message || 'Unknown error',
      resultPath: error.resultPath || 'N/A',
      timestamp: new Date().toISOString(),
      jobId: job.id,
    }

    failedProducts.push(failureRecord)
    console.log('📝 Tracked failed product:', failureRecord)
    console.log(`📊 Total failures in batch: ${failedProducts.length}`)
  } catch (trackingError) {
    // Fallback: don't crash if tracking fails
    console.error('❌ Error tracking failed product:', trackingError)
    failedProducts.push({
      productId: job?.productId || 'unknown',
      productTitle: job?.productTitle || 'Unknown Product',
      errorMessage: error?.message || 'Unknown error',
      resultPath: 'N/A',
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(unsafe) {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Show batch summary modal with failed products
 */
function showBatchSummaryModal() {
  try {
    const totalJobs = jobsCompleted
    const successJobs = totalJobs - jobsFailed
    const failedJobs = jobsFailed

    console.log('📊 Showing batch summary:', { totalJobs, successJobs, failedJobs })

    // Update statistics
    document.getElementById('summaryTotalJobs').textContent = totalJobs.toString()
    document.getElementById('summarySuccessJobs').textContent = successJobs.toString()
    document.getElementById('summaryFailedJobs').textContent = failedJobs.toString()

    // Build failed products list
    const container = document.getElementById('failedProductsContainer')

    if (failedJobs === 0) {
      // All successful
      container.innerHTML = `
        <div style="background: #1e5e1e; padding: 20px; border-radius: 4px; text-align: center; border: 2px solid #4caf50;">
          <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
          <div style="font-size: 16px; color: #4caf50; font-weight: 600;">
            Tous les produits ont été traités avec succès !
          </div>
        </div>
      `
    } else {
      // Build error list
      let html = `
        <div style="background: #1e1e1e; padding: 16px; border-radius: 4px; max-height: 400px; overflow-y: auto;">
          <div style="font-weight: 600; margin-bottom: 12px; color: #f44336; font-size: 14px;">
            ⚠️ Produits en échec (${failedJobs}) :
          </div>
      `

      failedProducts.forEach((failure, index) => {
        html += `
          <div style="background: #2d2d2d; padding: 12px; border-radius: 4px; margin-bottom: 8px; border-left: 3px solid #f44336;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
              <div style="font-weight: 600; color: #fff; flex: 1;">${index + 1}. ${escapeHtml(failure.productTitle)}</div>
              <div style="font-size: 10px; color: #666;">${new Date(failure.timestamp).toLocaleTimeString()}</div>
            </div>
            <div style="font-size: 12px; color: #f44336; margin-bottom: 8px;">
              <strong>Erreur:</strong> ${escapeHtml(failure.errorMessage)}
            </div>
            <div style="font-size: 11px; color: #4caf50; font-family: monospace; word-break: break-all;">
              <strong>Fichier:</strong> ${escapeHtml(failure.resultPath)}
            </div>
          </div>
        `
      })

      html += '</div>'
      container.innerHTML = html
    }

    // Show modal
    document.getElementById('batchSummaryModal').style.display = 'block'

    addLog('info', `Batch summary: ${successJobs} success, ${failedJobs} failed`)
  } catch (error) {
    console.error('❌ CRITICAL: Error showing batch summary modal:', error)
    addLog('error', 'Failed to show summary modal - check console')
    alert(
      `Batch complete: ${jobsCompleted - jobsFailed} success, ${jobsFailed} failed\n\nError showing modal: ${error.message}`
    )
  }
}

/**
 * Copy failed products list to clipboard
 */
async function copyErrorsToClipboard() {
  try {
    if (failedProducts.length === 0) {
      addLog('info', 'No errors to copy')
      return
    }

    // Format errors for clipboard
    let clipboardText = `Mockup Automation - Rapport d'erreurs\n`
    clipboardText += `Date: ${new Date().toLocaleString()}\n`
    clipboardText += `Total traités: ${jobsCompleted}\n`
    clipboardText += `Réussis: ${jobsCompleted - jobsFailed}\n`
    clipboardText += `Échecs: ${jobsFailed}\n`
    clipboardText += `\n`
    clipboardText += `==============================================\n`
    clipboardText += `PRODUITS EN ÉCHEC (${failedProducts.length})\n`
    clipboardText += `==============================================\n\n`

    failedProducts.forEach((failure, index) => {
      clipboardText += `${index + 1}. ${failure.productTitle}\n`
      clipboardText += `   Product ID: ${failure.productId}\n`
      clipboardText += `   Erreur: ${failure.errorMessage}\n`
      clipboardText += `   Fichier: ${failure.resultPath}\n`
      clipboardText += `   Heure: ${new Date(failure.timestamp).toLocaleString()}\n`
      clipboardText += `\n`
    })

    // Copy to clipboard (permission already granted in manifest.json line 30)
    await navigator.clipboard.writeText(clipboardText)

    addLog('success', `${failedProducts.length} erreur(s) copiée(s) dans le presse-papier`)

    // Visual feedback
    const btn = document.getElementById('copyErrorsBtn')
    const originalText = btn.textContent
    btn.style.background = '#4caf50'
    btn.textContent = '✅ Copié !'

    setTimeout(() => {
      btn.textContent = originalText
      btn.style.background = '#ff9800'
    }, 2000)
  } catch (error) {
    console.error('❌ Clipboard copy error:', error)
    addLog('error', `Échec de la copie: ${error.message}`)

    // Fallback: Show in alert
    const errorSummary = failedProducts
      .map((f, i) => `${i + 1}. ${f.productTitle}: ${f.errorMessage}`)
      .join('\n')
    alert(`Impossible de copier dans le presse-papier.\n\nErreurs:\n${errorSummary}`)
  }
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

  // Range selection event listeners
  setupRangeInputListeners()

  // Automation form event listeners
  startAutomationBtn.addEventListener('click', handleStartAutomation)
  // Template change listeners are added when radio buttons are created

  // Mode toggle event listeners
  document.querySelectorAll('input[name="selectionMode"]').forEach((radio) => {
    radio.addEventListener('change', handleModeToggle)
  })

  // Product search event listener (debounced)
  const productSearchInput = document.getElementById('productSearchInput')
  if (productSearchInput) {
    productSearchInput.addEventListener('input', handleProductSearch)
  }

  // Select all products checkbox
  const selectAllCheckbox = document.getElementById('selectAllProductsCheckbox')
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', handleSelectAllProducts)
  }

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

  // Insert mode toggle event listeners
  document.querySelectorAll('input[name="insertMode"]').forEach((radio) => {
    radio.addEventListener('change', handleInsertModeToggle)
  })

  // Validation modal event listener
  const validationCloseBtn = document.getElementById('validationCloseBtn')
  if (validationCloseBtn) {
    validationCloseBtn.addEventListener('click', () => {
      document.getElementById('validationModal').style.display = 'none'
      enableStartButton()
    })
  }

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

  // Batch summary modal event listeners
  const closeSummaryBtn = document.getElementById('closeSummaryBtn')
  const copyErrorsBtn = document.getElementById('copyErrorsBtn')

  if (closeSummaryBtn) {
    closeSummaryBtn.addEventListener('click', () => {
      document.getElementById('batchSummaryModal').style.display = 'none'
    })
  }

  if (copyErrorsBtn) {
    copyErrorsBtn.addEventListener('click', async () => {
      await copyErrorsToClipboard()
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

  // Update UI visibility based on connection state and mode
  updateUIVisibility()
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
    updateRangeSelectionUI() // Update range selection when all collections change
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

      updateRangeSelectionUI() // Update range selection when individual collection changes
      validateStartButton()
    })
  })

  // Initial validation
  validateStartButton()

  // NEW: Setup product link click handlers
  setupProductLinkHandlers()

  addLog('info', 'Collection selector populated')

  // Initialize products list when collections are loaded
  initializeAllProducts()
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
 * Extract all products from collections into flat array and sort alphabetically
 */
function initializeAllProducts() {
  allProducts = []
  const seenIds = new Set()

  paintingCollections.forEach((collection) => {
    if (collection.products && collection.products.length > 0) {
      collection.products.forEach((product) => {
        // Deduplicate (product might be in multiple collections)
        if (!seenIds.has(product.id)) {
          seenIds.add(product.id)
          allProducts.push({
            id: product.id,
            title: product.title,
            handle: product.handle,
            onlineStoreUrl: product.onlineStoreUrl,
          })
        }
      })
    }
  })

  // Sort alphabetically by title
  allProducts.sort((a, b) => a.title.localeCompare(b.title))

  console.log(`📦 Initialized ${allProducts.length} unique products`)
}

/**
 * Filter products based on search query
 * Searches both title (case-insensitive) and numeric ID
 * @param {string} query - Search query
 * @returns {Array} Filtered products
 */
function filterProductsBySearch(query) {
  if (!query || query.trim() === '') {
    return allProducts
  }

  const lowerQuery = query.toLowerCase().trim()

  return allProducts.filter((product) => {
    if (!product) return false

    // Search in title (safely)
    const title = product.title || ''
    const titleMatch = title.toLowerCase().includes(lowerQuery)

    // Search in numeric ID (extract from "gid://shopify/Product/12345")
    const numericId = product.id ? product.id.split('/').pop() : ''
    const idMatch = numericId.toLowerCase().includes(lowerQuery)

    return titleMatch || idMatch
  })
}

/**
 * Render products list with checkboxes
 * Applies search filter and maintains selection state
 */
function renderProductsList() {
  console.log('📋 renderProductsList() called, search query:', productSearchQuery)

  const container = document.getElementById('productsListContainer')
  if (!container) {
    console.error('❌ Products list container not found!')
    return
  }

  console.log('✅ Container found, proceeding to filter products...')

  const filteredProducts = filterProductsBySearch(productSearchQuery)
  console.log('🔍 Filtered products count:', filteredProducts.length, 'out of', allProducts.length)

  if (filteredProducts.length === 0) {
    container.innerHTML = `
      <div style="color: #999; font-size: 12px; text-align: center; padding: 20px">
        ${productSearchQuery ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
      </div>
    `
    updateProductsCount()
    return
  }

  // Clear container
  container.innerHTML = ''

  // Create DOM elements (like Collections mode does)
  filteredProducts.forEach((product) => {
    // Safely extract numeric ID from GraphQL format
    const numericId = product.id ? product.id.split('/').pop() : 'unknown'
    const isChecked = selectedProductIds.has(product.id)
    const escapedTitle = (product.title || 'Untitled Product')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    // Create checkbox item element
    const checkboxItem = document.createElement('div')
    checkboxItem.className = 'checkbox-item'
    checkboxItem.innerHTML = `
      <label>
        <input
          type="checkbox"
          class="product-checkbox"
          value="${product.id}"
          ${isChecked ? 'checked' : ''}
        />
        <span>${escapedTitle}</span>
        <span style="color: #888; margin-left: auto">#${numericId}</span>
      </label>
    `
    container.appendChild(checkboxItem)

    // Attach event listener
    const checkbox = checkboxItem.querySelector('.product-checkbox')
    if (checkbox) {
      checkbox.addEventListener('change', handleProductCheckboxChange)
    }
  })

  updateProductsCount()
}

/**
 * Update products count displays
 */
function updateProductsCount() {
  const allProductsCountSpan = document.getElementById('allProductsCount')
  const selectedProductsCountSpan = document.getElementById('selectedProductsCount')
  const selectAllCheckbox = document.getElementById('selectAllProductsCheckbox')

  if (allProductsCountSpan) {
    allProductsCountSpan.textContent = `(${allProducts.length})`
  }

  if (selectedProductsCountSpan) {
    selectedProductsCountSpan.textContent = selectedProductIds.size
  }

  // Update "Select All" checkbox state
  if (selectAllCheckbox) {
    selectAllCheckbox.checked =
      selectedProductIds.size === allProducts.length && allProducts.length > 0
  }
}

/**
 * Handle individual product checkbox change
 */
function handleProductCheckboxChange(event) {
  const checkbox = event.target
  const productId = checkbox.value

  if (checkbox.checked) {
    selectedProductIds.add(productId)
  } else {
    selectedProductIds.delete(productId)
    // If unchecking a product, also uncheck "Select All"
    const selectAllCheckbox = document.getElementById('selectAllProductsCheckbox')
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false
    }
  }

  updateProductsCount()
  validateStartButton()
}

/**
 * Handle "Select All Products" checkbox
 */
function handleSelectAllProducts(event) {
  const isChecked = event.target.checked

  if (isChecked) {
    // Select all products (not just filtered ones)
    allProducts.forEach((product) => {
      selectedProductIds.add(product.id)
    })
  } else {
    // Deselect all
    selectedProductIds.clear()
  }

  // Re-render to update checkboxes
  renderProductsList()
  validateStartButton()
}

/**
 * Handle product search input (debounced for performance)
 */
let searchDebounceTimer = null
function handleProductSearch(event) {
  const query = event.target.value

  // Debounce search for 300ms
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    productSearchQuery = query
    renderProductsList()
  }, 300)
}

/**
 * Handle mode toggle between Collections and Products
 */
function handleModeToggle(event) {
  const selectedMode = event.target.value
  currentMode = selectedMode

  // Clear search debounce timer when switching modes
  clearTimeout(searchDebounceTimer)

  console.log(`🔄 Switching to ${selectedMode} mode`)

  // Update radio label styling
  const collectionsLabel = document.getElementById('collectionsRadioLabel')
  const productsLabel = document.getElementById('productsRadioLabel')

  if (collectionsLabel && productsLabel) {
    if (selectedMode === 'collections') {
      collectionsLabel.classList.add('checked')
      productsLabel.classList.remove('checked')
    } else {
      productsLabel.classList.add('checked')
      collectionsLabel.classList.remove('checked')
    }
  }

  // Initialize products list if switching to products mode
  if (selectedMode === 'products') {
    if (allProducts.length === 0) {
      initializeAllProducts()
    }
    renderProductsList()
  }

  // Update UI visibility and validate button
  updateUIVisibility()
  validateStartButton()
}

/**
 * Handle insert mode toggle between Replace and Insert
 */
function handleInsertModeToggle(event) {
  const selectedMode = event.target.value
  insertMode = selectedMode

  console.log(`🔄 Switching to ${selectedMode} insert mode`)

  // Update radio label styling
  const replaceLabel = document.getElementById('replaceModeLabel')
  const insertLabel = document.getElementById('insertModeLabel')

  if (replaceLabel && insertLabel) {
    if (selectedMode === 'replace') {
      replaceLabel.classList.add('checked')
      insertLabel.classList.remove('checked')
    } else {
      insertLabel.classList.add('checked')
      replaceLabel.classList.remove('checked')
    }
  }

  addLog('info', `Insert mode set to: ${selectedMode}`)
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

    // Read context.txt file if it exists
    const contextFile = entries.find(
      (entry) => !entry.isFolder && entry.name.toLowerCase() === 'context.txt'
    )

    if (contextFile) {
      try {
        const uxpStorage = require('uxp').storage
        const contextData = await contextFile.read({ format: uxpStorage.formats.utf8 })
        selectedMockupContext = contextData.trim()
        addLog(
          'info',
          `Context loaded: "${selectedMockupContext.substring(0, 50)}${selectedMockupContext.length > 50 ? '...' : ''}"`
        )
      } catch (contextError) {
        console.error('Failed to read context.txt:', contextError)
        selectedMockupContext = ''
        addLog('warn', 'Failed to read context.txt')
      }
    } else {
      selectedMockupContext = ''
      addLog('info', 'No context.txt found, using template path as context')
    }

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
 * Show validation error modal
 */
function showValidationModal(errors) {
  const modal = document.getElementById('validationModal')
  const errorList = document.getElementById('validationErrorList')

  // Clear previous errors
  errorList.innerHTML = ''

  // Populate error list
  errors.forEach((error) => {
    const errorItem = document.createElement('div')
    errorItem.style.marginBottom = '8px'
    errorItem.style.paddingBottom = '8px'
    errorItem.style.borderBottom = '1px solid #333'
    errorItem.innerHTML = `
      <div style="color: #f44336; font-weight: 500; margin-bottom: 4px;">
        ❌ ${error.fileName}
      </div>
      <div style="color: #999; font-size: 11px; padding-left: 20px;">
        ${error.error}
      </div>
    `
    errorList.appendChild(errorItem)
  })

  // Show modal
  modal.style.display = 'block'
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

  // Determine mode and validate
  let useProductsMode = false
  let productIds = []
  let collectionIds = []
  let usingRangeSelection = false

  if (currentMode === 'products') {
    // Products mode
    useProductsMode = true
    productIds = Array.from(selectedProductIds)

    if (productIds.length === 0) {
      addLog('error', 'Please select at least one product')
      return
    }

    addLog('info', `Products mode: ${productIds.length} products selected`)
  } else {
    // Collections mode (existing logic)
    const checkboxes = collectionSelector.querySelectorAll('input[type="checkbox"]:checked')
    collectionIds = Array.from(checkboxes).map((cb) => cb.value)
    usingRangeSelection = filteredProducts.length > 0

    if (!usingRangeSelection) {
      if (collectionIds.length === 0) {
        addLog('error', 'Please select at least one collection')
        return
      }
      addLog('info', `Collections mode: ${collectionIds.length} collection(s)`)
    } else {
      addLog('info', `Range mode: ${filteredProducts.length} products`)
    }
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

  // Disable button during validation
  startAutomationBtn.disabled = true
  startAutomationBtn.classList.add('processing')
  startAutomationBtn.textContent = 'Validation des templates...'

  // PRE-FLIGHT VALIDATION: Check all mockup templates for "Artwork" smart object
  addLog('info', '🔍 Pre-flight validation: Checking mockup templates...')
  try {
    const validationResult = await processor.validateMockupTemplates(mockupTemplatePath)

    if (!validationResult.valid) {
      // Validation failed - show error modal
      addLog(
        'error',
        `❌ Template validation failed: ${validationResult.errors.length} file(s) with errors`
      )
      showValidationModal(validationResult.errors)
      enableStartButton()
      return
    }

    // Validation passed
    addLog('success', '✅ All mockup templates validated successfully')
  } catch (error) {
    addLog('error', `Validation error: ${error.message}`)
    enableStartButton()
    return
  }

  // Set the mockup template folder for the processor BEFORE starting automation
  processor.setMockupTemplateFolder(mockupTemplatePath)
  addLog('info', `Using template: ${mockupTemplatePath}`)

  // Get collection names for logging (only needed for collection mode)
  let collectionNames = ''
  if (!useProductsMode && !usingRangeSelection && collectionIds && collectionIds.length > 0) {
    if (collectionIds.includes('all')) {
      collectionNames = 'All Collections'
    } else {
      const checkboxes = collectionSelector.querySelectorAll('input[type="checkbox"]:checked')
      const selectedNames = Array.from(checkboxes).map((cb) => cb.getAttribute('data-name'))
      collectionNames = selectedNames.join(', ')
    }
  }

  // Update button state for processing
  startAutomationBtn.textContent = 'Traitement en cours...'

  // Disable UI elements based on current mode
  if (currentMode === 'products') {
    // Disable Products mode UI
    const productCheckboxes = document.querySelectorAll('.product-checkbox')
    productCheckboxes.forEach((cb) => (cb.disabled = true))

    const productSearchInput = document.getElementById('productSearchInput')
    if (productSearchInput) productSearchInput.disabled = true

    const selectAllCheckbox = document.getElementById('selectAllProductsCheckbox')
    if (selectAllCheckbox) selectAllCheckbox.disabled = true
  } else {
    // Disable Collections mode UI
    const allCheckboxes = collectionSelector.querySelectorAll('input[type="checkbox"]')
    allCheckboxes.forEach((cb) => (cb.disabled = true))
  }

  // Disable mode toggle
  const modeRadios = document.querySelectorAll('input[name="selectionMode"]')
  modeRadios.forEach((radio) => (radio.disabled = true))

  try {
    let requestBody = {}

    if (useProductsMode) {
      // Products mode - send productIds
      addLog('info', `Starting automation for ${productIds.length} selected products`)

      requestBody = {
        productIds: productIds,
        mockupTemplatePath: mockupTemplatePath,
        targetImagePosition: targetImagePosition,
        insertMode: insertMode,
        mockupContext: selectedMockupContext,
      }
    } else if (usingRangeSelection) {
      // Range selection mode - send productIds from range
      const rangeProductIds = filteredProducts.map((p) => p.id)
      addLog(
        'info',
        `Starting automation for ${rangeProductIds.length} products (range ${rangeStart}-${rangeEnd})`
      )

      requestBody = {
        productIds: rangeProductIds,
        mockupTemplatePath: mockupTemplatePath,
        targetImagePosition: targetImagePosition,
        insertMode: insertMode,
        mockupContext: selectedMockupContext,
      }
    } else {
      // Collection selection mode - send collectionIds
      addLog('info', `Starting automation for: ${collectionNames}`)

      requestBody = {
        collectionIds: collectionIds,
        mockupTemplatePath: mockupTemplatePath,
        targetImagePosition: targetImagePosition,
        insertMode: insertMode,
        mockupContext: selectedMockupContext,
      }
    }

    // Give immediate visual feedback - activate step 1 right away
    updateStep(1, 'active')

    const response = await fetch(`${config.BACKEND_URL}/api/mockup/start-automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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

  // Re-enable UI elements based on current mode
  if (currentMode === 'products') {
    // Re-enable Products mode UI
    const productCheckboxes = document.querySelectorAll('.product-checkbox')
    productCheckboxes.forEach((cb) => (cb.disabled = false))

    const productSearchInput = document.getElementById('productSearchInput')
    if (productSearchInput) productSearchInput.disabled = false

    const selectAllCheckbox = document.getElementById('selectAllProductsCheckbox')
    if (selectAllCheckbox) selectAllCheckbox.disabled = false
  } else {
    // Re-enable Collections mode UI
    const allCheckboxes = collectionSelector.querySelectorAll('input[type="checkbox"]')
    allCheckboxes.forEach((cb) => (cb.disabled = false))
  }

  // Re-enable mode toggle
  const modeRadios = document.querySelectorAll('input[name="selectionMode"]')
  modeRadios.forEach((radio) => (radio.disabled = false))
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
    isProcessingJob,
    queueLength: jobQueue.length,
    timestamp: Date.now(),
  })

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
            // Include metadata for cross-process compatibility (PM2 cluster mode)
            insertMode: job.insertMode || 'replace',
            mockupContext: job.mockupContext || '',
            mockupTemplatePath: job.mockupTemplatePath || '',
            batchId: job.batchId || '',
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

          // Track failed product for summary
          trackFailedProduct(job, error)

          // Log error for visibility
          addLog('error', `Failed: ${job.productTitle} - ${error.message}`)

          // Mark current step as error
          updateStep(9, 'error')

          // Increment failure counter
          jobsFailed++
          jobsCompleted++
          updateStats()

          // Mark job as failed
          markJobCompleted(false)

          // Clean up files for failed job (non-critical, don't block backend notification)
          try {
            await cleanupCurrentJobFiles()
          } catch (cleanupError) {
            console.error('⚠️ Cleanup failed (non-critical):', cleanupError.message)
            addLog('warning', `Cleanup warning: ${cleanupError.message}`)
          }

          // Send failure to backend
          if (client && client.isConnected()) {
            await client.send({
              jobId: job.id,
              error: error.message,
              success: false,
            })
          }

          // NO MODAL, NO PAUSE - continue to finally block
        }
      } else {
        // No backend connection, just mark as complete
        markJobCompleted(true)
      }
    } else {
      // ProcessJob returned failure - track for summary
      const processError = new Error(result.error || 'Processing failed')
      trackFailedProduct(job, processError)

      // Increment counters
      jobsFailed++
      jobsCompleted++
      updateStats()

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

    // Track failed product for summary
    trackFailedProduct(job, error)

    // Increment counters (both failed AND completed)
    jobsFailed++
    jobsCompleted++
    updateStats()

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
      isProcessingJob,
      queueLength: jobQueue.length,
    })

    // Mark as not processing
    isProcessingJob = false

    // Process next job if any
    if (jobQueue.length > 0) {
      addLog('info', `Processing next job (${jobQueue.length} remaining)`)
      console.log('🔍 DEBUG finally: scheduling processNextJob() with 500ms delay')
      // Small delay before next job to ensure UI updates
      setTimeout(() => processNextJob(), 500)
    } else {
      addLog('success', 'All jobs completed!')

      // Show summary modal if there were any errors
      if (jobsFailed > 0) {
        showBatchSummaryModal()
      }

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

  // Add this line:
  const jobsFailedEl = document.getElementById('jobsFailed')
  if (jobsFailedEl) {
    jobsFailedEl.textContent = jobsFailed.toString()
  }
}

/**
 * Reset statistics counters
 */
function resetStats() {
  jobsReceived = 0
  jobsCompleted = 0
  jobsFailed = 0 // Add this
  failedProducts = [] // Add this
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
