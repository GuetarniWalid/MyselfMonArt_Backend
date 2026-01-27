import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import type { Product } from 'types/Product'
import fs from 'fs'
import path from 'path'
import Application from '@ioc:Adonis/Core/Application'
import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'
import MockupQueue from 'App/Services/MockupQueue'
import ClaudeMockup from 'App/Services/Claude/Mockup'
import VideoCompressor from 'App/Services/Video/VideoCompressor'
import VideoStorage from 'App/Services/VideoStorage'

export default class MockupController {
  private queue = MockupQueue.getInstance()
  // Track files created for each automation batch for cleanup (static to persist across requests)
  private static batchFiles: Map<string, string[]> = new Map()
  // Track files by productId for cleanup (since new filenames won't contain productId)
  private static productFiles: Map<string, { batchId: string; filePath: string }[]> = new Map()

  // Simple status endpoint
  public async status({ response }: HttpContextContract) {
    return response.ok({ status: 'ok', message: 'Mockup service is running' })
  }

  // Cleanup files for a batch or specific file paths
  public async cleanupFiles({ request, response }: HttpContextContract) {
    try {
      const { batchId, filePaths } = request.only(['batchId', 'filePaths'])
      let pathsToDelete: string[] = []

      if (batchId) {
        // Get all files for this batch
        pathsToDelete = MockupController.batchFiles.get(batchId) || []
        console.log(`🗑️  Cleaning up batch ${batchId}: ${pathsToDelete.length} files`)
      } else if (filePaths && Array.isArray(filePaths)) {
        pathsToDelete = filePaths
        console.log(`🗑️  Cleaning up ${pathsToDelete.length} specific files`)
      } else {
        return response.badRequest({ error: 'Either batchId or filePaths is required' })
      }

      let deletedCount = 0
      let failedCount = 0

      for (const filePath of pathsToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            deletedCount++
            console.log(`   ✅ Deleted: ${path.basename(filePath)}`)
          }
        } catch (error) {
          failedCount++
          console.error(`   ❌ Failed to delete ${path.basename(filePath)}: ${error.message}`)
        }
      }

      // Remove batch tracking if it was a batch cleanup
      if (batchId) {
        MockupController.batchFiles.delete(batchId)
      }

      console.log(`✅ Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`)

      return response.ok({
        success: true,
        deletedCount,
        failedCount,
        message: `Cleaned up ${deletedCount} file(s)`,
      })
    } catch (error) {
      console.error('❌ Cleanup error:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Failed to cleanup files',
      })
    }
  }

  // Cleanup files for a specific product in a batch
  public async cleanupProductFiles({ request, response }: HttpContextContract) {
    try {
      const { batchId, productId } = request.only(['batchId', 'productId'])

      if (!batchId || !productId) {
        return response.badRequest({ error: 'Both batchId and productId are required' })
      }

      console.log(`🗑️  Cleaning up files for product ${productId} in batch ${batchId}`)

      let deletedCount = 0
      let failedCount = 0

      // Lookup files by productId in tracking map (works with AI-generated filenames)
      const productFilesList = MockupController.productFiles.get(productId) || []
      const filesToDelete = productFilesList
        .filter((f) => f.batchId === batchId)
        .map((f) => f.filePath)

      console.log(`   Found ${filesToDelete.length} file(s) to delete`)

      for (const filePath of filesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            deletedCount++
            console.log(`   ✅ Deleted: ${path.basename(filePath)}`)
          }
        } catch (error) {
          failedCount++
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`   ❌ Failed to delete ${path.basename(filePath)}: ${errorMessage}`)
        }
      }

      // Remove deleted files from batch tracking
      const batchFiles = MockupController.batchFiles.get(batchId) || []
      const remainingFiles = batchFiles.filter((f) => !filesToDelete.includes(f))
      MockupController.batchFiles.set(batchId, remainingFiles)

      console.log(
        `✅ Product cleanup complete: ${deletedCount} deleted, ${failedCount} failed, ${remainingFiles.length} remaining in batch`
      )

      // Clean up product tracking map
      MockupController.productFiles.delete(productId)
      console.log(`   🗑️  Removed product from tracking map`)

      return response.ok({
        success: true,
        deletedCount,
        failedCount,
        remainingFiles: remainingFiles.length,
        message: `Cleaned up ${deletedCount} file(s) for product`,
      })
    } catch (error) {
      console.error('❌ Product cleanup error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to cleanup product files'
      return response.internalServerError({
        success: false,
        message: errorMessage,
      })
    }
  }

  // Get pending jobs
  public async getPendingJobs({ response }: HttpContextContract) {
    const jobs = this.queue.getPendingJobs()
    if (jobs.length > 0) {
      console.log(`🔍 DEBUG getPendingJobs: Sending ${jobs.length} job(s) to plugin`)
      jobs.forEach((job: any) => {
        console.log(`   - Job ${job.id}: templateType = ${job.templateType}`)
      })
    }
    return response.ok(jobs)
  }

  // Add job to queue
  public async addJob({ request, response }: HttpContextContract) {
    const job = request.only(['id', 'productId', 'productTitle', 'imageUrl'])
    console.log('📝 Job added to queue:', job.id)

    this.queue.addJob(job)

    return response.ok({ success: true, jobId: job.id })
  }

  // Get job status
  public async getJobStatus({ request, response }: HttpContextContract) {
    const jobId = request.input('jobId')
    const job = this.queue.getCompletedJob(jobId)

    if (job) {
      return response.ok({ completed: true, job })
    }

    return response.ok({ completed: false })
  }

  // Mark job as complete
  public async completeJob({ request, response }: HttpContextContract) {
    const data = request.all()
    console.log('✅ Job completion received:', data)

    if (data.jobId) {
      this.queue.completeJob(data.jobId, data)

      // Upload to Shopify if successful
      if (data.success && data.resultPath && data.productId) {
        // Get metadata from request body first (for PM2 cluster mode compatibility),
        // then fall back to queue metadata (for single-process mode)
        const jobMetadata = this.queue.getJobMetadata(data.jobId)
        const mockupTemplatePath = data.mockupTemplatePath || jobMetadata?.mockupTemplatePath || ''
        const batchId = data.batchId || jobMetadata?.batchId || ''
        const insertMode =
          (data.insertMode as 'replace' | 'insert') ||
          (jobMetadata?.insertMode as 'replace' | 'insert') ||
          'replace'
        const mockupContext =
          (data.mockupContext as string) || (jobMetadata?.mockupContext as string) || ''
        const copyAltFromMain =
          (data.copyAltFromMain as boolean) || (jobMetadata?.copyAltFromMain as boolean) || false
        const mediaType =
          (data.mediaType as 'IMAGE' | 'VIDEO') ||
          (jobMetadata?.mediaType as 'IMAGE' | 'VIDEO') ||
          'IMAGE'

        console.log('🔍 DEBUG: Starting Shopify upload with:', {
          resultPath: data.resultPath,
          productId: data.productId,
          targetImagePosition: data.targetImagePosition,
          insertMode: insertMode,
          copyAltFromMain: copyAltFromMain,
          mediaType: mediaType,
          mockupContext: mockupContext
            ? `${mockupContext.substring(0, 50)}${mockupContext.length > 50 ? '...' : ''}`
            : '(none)',
          mockupTemplatePath: mockupTemplatePath,
          batchId: batchId,
          source: data.insertMode ? 'request' : jobMetadata ? 'queue' : 'default',
        })

        let uploadResult
        try {
          uploadResult = await this.uploadMockupToShopify({
            productId: data.productId,
            mockupFilePath: data.resultPath,
            targetImagePosition: data.targetImagePosition || 0,
            insertMode: insertMode,
            mockupContext: mockupContext,
            mockupTemplatePath: mockupTemplatePath,
            copyAltFromMain: copyAltFromMain,
            batchId: batchId,
            mediaType: mediaType,
          })
          console.log(`✅ DEBUG: Mockup uploaded to Shopify for product ${data.productId}`)
          console.log(`🎨 Mockup uploaded to Shopify for product ${data.productId}`)

          // Clean up job metadata after successful upload
          this.queue.cleanupJob(data.jobId)

          // Update data.resultPath to the final renamed path for cleanup
          data.resultPath = uploadResult.finalFilePath

          // Return success with uploaded and reordered flags
          const successResult = {
            success: true,
            uploaded: true,
            reordered: uploadResult.reordered,
            oldMediaDetached: uploadResult.oldMediaDetached,
          }
          console.log('🔍 DEBUG: Returning success result:', successResult)
          return response.ok(successResult)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorStack = error instanceof Error ? error.stack : undefined

          console.error(`❌ DEBUG: Failed to upload mockup to Shopify:`, error)
          console.error('❌ DEBUG: Error details:', {
            message: errorMessage,
            stack: errorStack,
            productId: data.productId,
            resultPath: data.resultPath,
          })

          // Clean up job metadata to prevent memory leak
          this.queue.cleanupJob(data.jobId)
          console.log(`🧹 Job metadata cleaned up after upload error: ${data.jobId}`)

          // Generate public URL for the mockup file (use final filename if available)
          const baseUrl = Env.get('BACKEND_URL')
          const fileName = uploadResult?.finalFileName || path.basename(data.resultPath)
          const publicUrl = `${baseUrl}/assets/${fileName}`

          // Return error to frontend (don't throw, return controlled error)
          const errorResult = {
            success: false,
            error: true,
            errorMessage: errorMessage,
            productId: data.productId,
            resultPath: publicUrl, // Use public URL with correct filename
          }

          console.log('🔍 DEBUG: Returning error result:', errorResult)
          return response.ok(errorResult)
        }
      }

      // Clean up source image file if job was successful
      if (data.success && data.imageUrl) {
        try {
          if (fs.existsSync(data.imageUrl)) {
            fs.unlinkSync(data.imageUrl)
            console.log(`🗑️  Cleaned up source image: ${data.imageUrl}`)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`⚠️  Failed to delete source image: ${errorMessage}`)
        }
      }

      // Clean up mockup result after upload
      if (data.success && data.resultPath) {
        try {
          if (fs.existsSync(data.resultPath)) {
            fs.unlinkSync(data.resultPath)
            console.log(`🗑️  Cleaned up mockup result: ${data.resultPath}`)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`⚠️  Failed to delete mockup result: ${errorMessage}`)
        }
      }
    }

    return response.ok({ success: true })
  }

  // Upload mockup file from plugin (supports images and videos)
  public async uploadMockup({ request, response }: HttpContextContract) {
    console.log('🔍 DEBUG: uploadMockup endpoint called')

    try {
      const mockupFile = request.file('mockup', {
        size: '500mb', // Increased for video files
        extnames: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
      })

      console.log('🔍 DEBUG: mockupFile:', {
        hasFile: !!mockupFile,
        fileName: mockupFile?.clientName,
        size: mockupFile?.size,
        extname: mockupFile?.extname,
      })

      if (!mockupFile) {
        console.error('❌ DEBUG: No file in request')
        return response.badRequest({ error: 'No file uploaded' })
      }

      const fileName = request.input('fileName')
      const batchId = request.input('batchId')
      console.log('🔍 DEBUG: fileName from request:', fileName)
      console.log('🔍 DEBUG: batchId from request:', batchId)

      if (!fileName) {
        console.error('❌ DEBUG: No fileName in request')
        return response.badRequest({ error: 'fileName is required' })
      }

      // Ensure assets directory exists
      const assetsDir = Application.publicPath('assets')
      console.log('🔍 DEBUG: assetsDir:', assetsDir)

      if (!fs.existsSync(assetsDir)) {
        console.log('🔍 DEBUG: Creating assets directory')
        fs.mkdirSync(assetsDir, { recursive: true })
      }

      // Save file to public/assets
      const filePath = path.join(assetsDir, fileName)
      console.log('🔍 DEBUG: Saving to filePath:', filePath)

      await mockupFile.move(Application.publicPath('assets'), {
        name: fileName,
        overwrite: true,
      })

      console.log('✅ DEBUG: File saved successfully')
      console.log(`📤 Mockup file uploaded: ${fileName}`)

      // Detect media type from extension
      const extname = mockupFile.extname?.toLowerCase() || ''
      const isVideo = ['mp4', 'mov'].includes(extname)
      const mediaType = isVideo ? 'VIDEO' : 'IMAGE'
      console.log(`🔍 DEBUG: Detected media type: ${mediaType} (extension: ${extname})`)

      // Track file to batch for cleanup
      if (batchId && MockupController.batchFiles.has(batchId)) {
        MockupController.batchFiles.get(batchId)?.push(filePath)
        console.log(`📝 Tracked file to batch ${batchId} for cleanup`)

        // Also track by productId (for cleanup with AI-generated filenames)
        const productId = request.input('productId')
        if (productId) {
          if (!MockupController.productFiles.has(productId)) {
            MockupController.productFiles.set(productId, [])
          }
          MockupController.productFiles.get(productId)?.push({ batchId, filePath })
          console.log(`   📝 Also tracked by productId: ${productId}`)
        }
      }

      const result = {
        success: true,
        filePath: filePath,
        fileName: fileName,
        mediaType: mediaType as 'IMAGE' | 'VIDEO',
      }

      console.log('🔍 DEBUG: Returning upload result:', result)
      return response.ok(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      console.error('❌ DEBUG: uploadMockup error:', error)
      console.error('❌ DEBUG: error stack:', errorStack)
      return response.internalServerError({
        error: 'Failed to upload file',
        details: errorMessage,
      })
    }
  }

  // Download image file (supports both local paths and Shopify URLs for on-demand download)
  public async downloadImage({ request, response }: HttpContextContract) {
    const filePath = request.input('path')
    const batchId = request.input('batchId')
    const productId = request.input('productId')

    if (!filePath) {
      return response.badRequest({ error: 'No file path provided' })
    }

    try {
      let actualFilePath = filePath

      // Check if it's a Shopify URL - download on-demand
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        console.log('📥 Downloading image on-demand from Shopify...')
        console.log(`   URL: ${filePath}`)

        // Download the image from Shopify
        actualFilePath = await this.downloadProductImage(filePath, productId)
        console.log(`   ✅ Downloaded to: ${actualFilePath}`)

        // Track file to batch for cleanup
        if (batchId && MockupController.batchFiles.has(batchId)) {
          MockupController.batchFiles.get(batchId)?.push(actualFilePath)
          console.log(`   📝 Tracked on-demand download to batch ${batchId}`)
        }
      }

      // Check if file exists
      if (!fs.existsSync(actualFilePath)) {
        return response.notFound({ error: 'File not found' })
      }

      // Read file
      const fileBuffer = fs.readFileSync(actualFilePath)
      const fileName = path.basename(actualFilePath)

      // Send file
      response.header('Content-Type', 'image/jpeg')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)
      return response.send(fileBuffer)
    } catch (error) {
      console.error('❌ Download error:', error)
      return response.internalServerError({ error: 'Failed to download file' })
    }
  }

  // Get all painting collections with product counts
  public async getPaintingCollections({ response }: HttpContextContract) {
    console.log('🎨 Fetching painting collections...')

    try {
      const shopify = new Shopify()
      const allCollections = await shopify.collection.getAll()

      // Filter by custom.type_of_collection = 'painting'
      const paintingCollections = allCollections.filter((collection) => {
        if (!collection.metafields?.edges) return false
        return collection.metafields.edges.some((edge) => {
          const node = edge.node as any // Cast to any to access value property
          return (
            node.namespace === 'custom' &&
            node.key === 'type_of_collection' &&
            node.value === 'painting'
          )
        })
      })

      console.log(`📦 Found ${paintingCollections.length} painting collections`)

      // Get all products to count products per collection
      const allProducts = await shopify.product.getAll(true)

      // Build response with ID, title, product count, and products
      const collectionsWithCounts = paintingCollections.map((collection) => {
        // Filter products by mother_collection metafield
        const collectionProducts = allProducts.filter((product) => {
          if (!product.metafields?.edges) return false
          return product.metafields.edges.some(
            (edge) =>
              edge.node.namespace === 'link' &&
              edge.node.key === 'mother_collection' &&
              edge.node.reference?.title === collection.title
          )
        })

        // Map products to minimal format (include draft products too)
        const products = collectionProducts.map((product) => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          onlineStoreUrl: product.onlineStoreUrl || null, // null for draft products
        }))

        console.log(
          `📦 Collection "${collection.title}": ${collectionProducts.length} total, ${products.filter((p) => !p.onlineStoreUrl).length} draft`
        )

        return {
          id: collection.id,
          title: collection.title,
          productCount: collectionProducts.length,
          products: products, // NEW: Add products array
        }
      })

      // Sort alphabetically
      collectionsWithCounts.sort((a, b) => a.title.localeCompare(b.title))

      console.log(`✅ Returning ${collectionsWithCounts.length} collections with product counts`)

      return response.ok(collectionsWithCounts)
    } catch (error) {
      console.error('❌ Error fetching painting collections:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Failed to fetch painting collections',
      })
    }
  }

  /**
   * Determine image orientation from dimensions
   * Reuses same logic as ShopifyProductPublisher service (app/Services/ShopifyProductPublisher/index.ts)
   */
  private getImageOrientation(width: number, height: number): 'square' | 'portrait' | 'landscape' {
    if (width === height) {
      return 'square'
    } else if (width < height) {
      return 'portrait'
    } else {
      return 'landscape'
    }
  }

  // Start mockup automation for specific collection(s)
  public async startAutomation({ request, response }: HttpContextContract) {
    const {
      collectionIds,
      productIds,
      mockupTemplatePath,
      targetImagePosition,
      insertMode,
      mockupContext,
      copyAltFromMain,
      templateType,
    } = request.only([
      'collectionIds',
      'productIds',
      'mockupTemplatePath',
      'targetImagePosition',
      'insertMode',
      'mockupContext',
      'copyAltFromMain',
      'templateType',
    ])

    // Validate template path
    if (!mockupTemplatePath) {
      return response.badRequest({
        success: false,
        message: 'Mockup template path is required',
      })
    }

    // Validate image position
    if (targetImagePosition === undefined || targetImagePosition < 0 || targetImagePosition > 5) {
      return response.badRequest({
        success: false,
        message: 'Target image position must be between 0 and 5',
      })
    }

    // Validate insert mode (optional, defaults to 'replace')
    const validInsertMode = insertMode === 'insert' ? 'insert' : 'replace'

    // Validate template type (defaults to 'image')
    const validTemplateType = templateType === 'video' ? 'video' : 'image'

    console.log('🎨 Starting Mockup Automation via API')
    console.log(`   Insert Mode: ${validInsertMode}`)
    console.log(
      `   Template Type: ${validTemplateType}${validTemplateType === 'video' ? ' 🎬' : ''}`
    )
    console.log(
      `   Mockup Context: ${mockupContext ? `"${mockupContext.substring(0, 50)}${mockupContext.length > 50 ? '...' : ''}"` : '(none, using template path)'}`
    )

    // Determine if using range selection (productIds) or collection selection (collectionIds)
    const useRangeSelection = productIds && Array.isArray(productIds) && productIds.length > 0

    if (useRangeSelection) {
      console.log(`   Product IDs (range selection): ${productIds.length} products`)
      console.log(
        `   IDs: ${JSON.stringify(productIds.slice(0, 5))}${productIds.length > 5 ? '...' : ''}`
      )
    } else {
      console.log(`   Collection IDs: ${JSON.stringify(collectionIds)}`)
    }
    console.log(`   Mockup Template: ${mockupTemplatePath}`)

    // Generate unique batch ID for file tracking and cleanup
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    MockupController.batchFiles.set(batchId, [])
    console.log(`📦 Batch ID: ${batchId}`)

    try {
      const shopify = new Shopify()

      let productsToUpdate: Product[] = []

      if (useRangeSelection) {
        // Range selection mode - get products by IDs directly
        console.log(`📦 Fetching ${productIds.length} products by ID...`)

        // Deduplicate product IDs (in case frontend sends duplicates)
        const uniqueProductIds = [...new Set(productIds)]
        if (uniqueProductIds.length !== productIds.length) {
          console.log(`⚠️  Removed ${productIds.length - uniqueProductIds.length} duplicate ID(s)`)
        }

        // Get all products (we need this for metadata)
        const allProducts = await shopify.product.getAll(true)

        // Filter to only the products in productIds array, maintaining order
        productsToUpdate = uniqueProductIds
          .map((productId) => allProducts.find((p) => p.id === productId))
          .filter((product) => product !== undefined) as Product[]

        console.log(`📝 Found ${productsToUpdate.length} products from range selection`)
      } else {
        // Collection-based selection mode (existing logic)
        // Get all products from Shopify (including unpublished) and filter painting products first
        const allProducts = await shopify.product.getAll(true)
        const paintingProducts = allProducts.filter(
          (product) => product.artworkTypeMetafield?.value === 'painting'
        )

        console.log(`📦 Total painting products found: ${paintingProducts.length}`)

        // Validate collectionIds exists in collection-based mode
        if (!collectionIds || !Array.isArray(collectionIds)) {
          return response.badRequest({
            success: false,
            message: 'Collection IDs are required for collection-based selection',
          })
        }

        if (collectionIds.includes('all')) {
          // Process all painting products
          productsToUpdate = paintingProducts

          console.log(`📦 Processing ALL painting products`)
          console.log(`📝 Total products selected: ${productsToUpdate.length}`)
        } else {
          // Get all collections
          const allCollections = await shopify.collection.getAll()

          // Find target collections
          const targetCollections = allCollections.filter((c) => collectionIds.includes(c.id))

          if (targetCollections.length === 0) {
            return response.badRequest({
              success: false,
              message: 'No valid collections found',
            })
          }

          const targetTitles = targetCollections.map((c) => c.title)
          console.log(`📦 Target collections: ${targetTitles.join(', ')}`)

          // Filter painting products that match ANY of the selected collections
          productsToUpdate = paintingProducts.filter((product) => {
            if (!product.metafields?.edges) return false

            return product.metafields.edges.some((edge) => {
              const node = edge.node as any
              return (
                node.namespace === 'link' &&
                node.key === 'mother_collection' &&
                node.reference?.title &&
                targetTitles.includes(node.reference.title)
              )
            })
          })

          console.log(`📝 Products in selected collections: ${productsToUpdate.length}`)
        }
      }

      if (productsToUpdate.length === 0) {
        return response.ok({
          success: true,
          totalJobs: 0,
          jobIds: [],
          message: 'No products found to process',
        })
      }

      const jobs: string[] = []

      // Process each product
      for (const product of productsToUpdate) {
        console.log(`📸 Processing product: ${product.title}`)

        // Extract second image
        const secondImage = this.getSecondImage(product)
        if (!secondImage) {
          console.log(`   ⚠️  No second image found - skipping`)
          continue
        }

        console.log(`   ✅ Second image found`)

        // Calculate orientation from image dimensions
        const orientation = this.getImageOrientation(secondImage.width, secondImage.height)
        console.log(
          `   📐 Orientation: ${orientation} (${secondImage.width}x${secondImage.height})`
        )

        // Store Shopify URL directly - image will be downloaded on-demand when plugin requests it
        console.log(`   📋 Image URL: ${secondImage.url}`)

        // Create and send mockup job
        const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
        const job = {
          id: jobId,
          productId: product.id,
          productTitle: product.title,
          imageUrl: secondImage.url, // Shopify URL (will be downloaded on-demand)
          mockupTemplatePath: mockupTemplatePath,
          orientation: orientation,
          targetImagePosition: targetImagePosition,
          insertMode: validInsertMode, // 'replace' or 'insert'
          mockupContext: mockupContext || '', // Context from context.txt
          copyAltFromMain: copyAltFromMain || false, // Copy alt from main image or generate with AI
          batchId: batchId, // Track batch for cleanup
          templateType: validTemplateType, // 'image' or 'video'
        }

        this.queue.addJob(job)
        console.log(`   📝 Job added to queue: ${jobId}`)
        console.log(`   🔍 DEBUG: Job templateType = ${job.templateType}`)
        jobs.push(jobId)
      }

      return response.ok({
        success: true,
        totalJobs: jobs.length,
        jobIds: jobs,
        batchId: batchId, // Return batch ID for cleanup
        message: `Started processing ${jobs.length} product(s)`,
      })
    } catch (error) {
      console.error('❌ Error starting automation:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Failed to start automation',
      })
    }
  }

  /**
   * Extract the second image from product media
   */
  private getSecondImage(product: Product) {
    if (!product.media?.nodes || product.media.nodes.length < 2) {
      return null
    }

    const secondNode = product.media.nodes[1]
    if (!secondNode.image?.url) {
      return null
    }

    return {
      url: secondNode.image.url,
      alt: secondNode.alt,
      width: secondNode.image.width,
      height: secondNode.image.height,
    }
  }

  /**
   * Download image from URL to public/assets directory
   */
  private async downloadProductImage(url: string, productId: string): Promise<string> {
    try {
      // Extract file extension from URL
      const urlObj = new URL(url)
      const extension = path.extname(urlObj.pathname) || '.jpg'

      // Generate unique filename
      const timestamp = Date.now()
      const filename = `mockup-${productId.replace('gid://shopify/Product/', '')}-${timestamp}${extension}`

      // Define file path in public/assets
      const assetsDir = Application.publicPath('assets')
      const filePath = path.join(assetsDir, filename)

      // Ensure assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true })
      }

      // Download image
      const imageResponse = await axios.get(url, {
        responseType: 'arraybuffer',
      })

      // Write to file
      fs.writeFileSync(filePath, imageResponse.data)

      return filePath
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`)
    }
  }

  /**
   * Upload mockup to Shopify and replace or insert product image at target position
   * @param insertMode - 'replace' to replace existing image, 'insert' to insert and shift others
   * @param mediaType - Type of media: 'IMAGE' or 'VIDEO' (default: 'IMAGE')
   */
  private async uploadMockupToShopify({
    productId,
    mockupFilePath,
    targetImagePosition,
    insertMode = 'replace',
    mockupTemplatePath,
    mockupContext,
    copyAltFromMain = false,
    batchId,
    mediaType = 'IMAGE',
  }: {
    productId: string
    mockupFilePath: string
    targetImagePosition: number
    insertMode?: 'replace' | 'insert'
    mockupTemplatePath?: string
    mockupContext?: string
    copyAltFromMain?: boolean
    batchId?: string
    mediaType?: 'IMAGE' | 'VIDEO'
  }): Promise<{
    reordered: boolean
    oldMediaDetached: boolean
    finalFilePath: string
    finalFileName: string
  }> {
    const shopify = new Shopify()

    // 1. Get product to check current media and save old media ID at target position
    const product = await shopify.product.getProductById(productId)
    const currentMediaCount = product.media?.nodes?.length || 0

    console.log(
      `📸 Product has ${currentMediaCount} images, target position: ${targetImagePosition + 1}, mode: ${insertMode}`
    )

    // Save the old media ID at target position (if exists) - only for replace mode
    let oldMediaId: string | null = null
    if (
      insertMode === 'replace' &&
      currentMediaCount > targetImagePosition &&
      product.media?.nodes
    ) {
      oldMediaId = (product.media.nodes[targetImagePosition] as any).id
      console.log(
        `📝 Old media at position ${targetImagePosition + 1}: ${oldMediaId} (will be replaced)`
      )
    } else if (insertMode === 'insert') {
      console.log(`📝 Insert mode: existing media will be shifted right`)
    }

    // 2. Generate public URL for mockup (file already uploaded by plugin)
    const fileName = path.basename(mockupFilePath)

    // Verify file exists in public/assets
    if (!fs.existsSync(mockupFilePath)) {
      throw new Error(`Mockup file not found at: ${mockupFilePath}`)
    }

    // Variables for final filename and path (may be renamed)
    let finalFileName = fileName
    let finalFilePath = mockupFilePath

    // 2.5. Generate AI alt text and filename based on product metadata (no image sent to AI)
    let altText: string | undefined
    try {
      const isVierge = mockupTemplatePath?.toLowerCase().includes('vierge') ?? false
      console.log(
        `🤖 Generating AI alt text and filename for ${isVierge ? 'VIERGE (artwork-focused)' : 'LIFESTYLE'} mockup (metadata-based)...`
      )
      if (mockupTemplatePath) {
        console.log(`   📁 Template: ${mockupTemplatePath}`)
      }
      if (mockupContext) {
        console.log(
          `   📝 Context: ${mockupContext.substring(0, 80)}${mockupContext.length > 80 ? '...' : ''}`
        )
      }

      const claudeMockup = new ClaudeMockup()

      // Extract mainAlt from second media item (index 1) - the main artwork image
      // Index 0 is typically a mockup/lifestyle image, index 1 is the actual artwork
      const mainArtworkMedia = product.media?.nodes?.[1] as any
      const mainAlt = mainArtworkMedia?.alt || ''

      // Extract collectionTitle from mother_collection metafield
      let collectionTitle = ''
      if (product.metafields?.edges) {
        const motherCollectionEdge = product.metafields.edges.find(
          (edge) => edge.node.namespace === 'link' && edge.node.key === 'mother_collection'
        )
        const reference = (motherCollectionEdge?.node as any)?.reference
        if (reference?.title) {
          collectionTitle = reference.title
        }
      }

      // Map artworkType to productType
      const artworkType = product.artworkTypeMetafield?.value || 'painting'
      const productType: 'poster' | 'painting' | 'tapestry' =
        artworkType === 'poster' ? 'poster' : artworkType === 'tapestry' ? 'tapestry' : 'painting'

      // Build MockupMetadata for the generator
      const mockupMetadata = {
        mainAlt: mainAlt,
        description: product.description || '',
        title: product.title,
        tags: product.tags || [],
        collectionTitle: collectionTitle,
        productType: productType,
      }

      console.log(
        `   🖼️  Artwork alt (media[1]): ${mainAlt ? mainAlt.substring(0, 50) + (mainAlt.length > 50 ? '...' : '') : '(empty)'}`
      )
      console.log(`   📁 Collection: ${collectionTitle || '(none)'}`)

      let generatedFilename: string | undefined

      // Convert mediaType for alt generator (lowercase format)
      const altMediaType = mediaType === 'VIDEO' ? 'video' : 'image'

      if (copyAltFromMain && mainAlt && mainAlt.length >= 10) {
        // COPY MODE: Use mainAlt directly, only generate filename via Claude
        console.log(`🔄 Copy alt mode: using mainAlt directly, generating filename only`)
        altText = mainAlt
        console.log(`✅ Using copied alt text (${mainAlt.length} chars): ${mainAlt}`)

        // Generate filename only via Claude
        generatedFilename = await claudeMockup.generateMockupFilename(
          mockupMetadata,
          mockupContext || mockupTemplatePath || '',
          altMediaType
        )
        console.log(`   📝 Generated filename: ${generatedFilename}`)
      } else {
        // GENERATE MODE: Current behavior - generate both via Claude
        if (copyAltFromMain) {
          console.warn(`⚠️  Main alt too short or missing, falling back to full AI generation`)
        }
        console.log(`🤖 Generate alt mode: generating both alt and filename via Claude`)

        const altResult = await claudeMockup.generateMockupAlt(
          mockupMetadata,
          mockupContext || mockupTemplatePath || '',
          altMediaType
        )

        // Validate minimum length (50 chars for quality)
        if (altResult.alt.length >= 50) {
          altText = altResult.alt
          if (altResult.alt.length > 130) {
            console.log(
              `⚠️  Alt text longer than preferred (${altText.length} chars), but accepted`
            )
          }
          console.log(`✅ Generated alt text (${altText.length} chars): ${altText}`)
          console.log(`   📝 Generated filename: ${altResult.filename}`)
        } else {
          console.warn(`⚠️  Alt text too short (${altResult.alt.length} chars), using fallback`)
          altText = this.generateFallbackAlt(product)
        }

        generatedFilename = altResult.filename
      }

      // === VIDEO COMPRESSION (before rename) ===
      // Compress video files using FFmpeg to reduce size before Shopify upload
      if (mediaType === 'VIDEO') {
        console.log(`🎬 Video detected, compressing before upload...`)
        const videoCompressor = new VideoCompressor()

        const compressionResult = await videoCompressor.compressVideo(mockupFilePath, {
          crf: 23, // Good quality/size balance (18-28, lower = better quality)
          preset: 'medium', // Balanced encoding speed
          maxWidth: 1920,
          maxHeight: 1080,
          timeout: 10 * 60 * 1000, // 10 minutes max
        })

        if (compressionResult.success) {
          console.log(
            `✅ Video compressed: ${videoCompressor.formatFileSize(compressionResult.originalSize)} → ${videoCompressor.formatFileSize(compressionResult.compressedSize)} (${compressionResult.compressionRatio.toFixed(2)}x reduction)`
          )
          // Update file path if extension changed (e.g., .mov → .mp4)
          if (compressionResult.outputPath !== mockupFilePath) {
            console.log(`   📝 Output path updated: ${compressionResult.outputPath}`)
            mockupFilePath = compressionResult.outputPath
            // Note: fileName is const, but subsequent code uses mockupFilePath for file operations
          }
        } else {
          // Log warning but continue with original file (graceful degradation)
          console.warn(`⚠️  Video compression failed: ${compressionResult.error}`)
          console.warn(`   Continuing with original video file`)
        }
      }
      // === END VIDEO COMPRESSION ===

      // Handle AI-generated filename and file rename (always use AI filename, sanitize if needed)
      if (generatedFilename) {
        const sanitizedFilename = this.sanitizeFilename(generatedFilename)
        console.log(`🏷️  AI-generated filename: ${generatedFilename}`)
        if (sanitizedFilename !== generatedFilename) {
          console.log(`   📝 Sanitized to: ${sanitizedFilename}`)
        }

        // Use original file extension (supports both images and videos)
        const originalExtension =
          path.extname(mockupFilePath) || (mediaType === 'VIDEO' ? '.mp4' : '.jpg')

        // Find unique filename (handles duplicates)
        const assetsDir = Application.publicPath('assets')
        const uniqueFilename = this.findUniqueFilename(
          sanitizedFilename,
          originalExtension,
          assetsDir
        )

        if (uniqueFilename !== `${sanitizedFilename}${originalExtension}`) {
          console.log(`   ⚠️  Duplicate detected, using: ${uniqueFilename}`)
        }

        // Rename the file
        const newFilePath = path.join(assetsDir, uniqueFilename)

        try {
          fs.renameSync(mockupFilePath, newFilePath)
          console.log(`✅ File renamed: ${fileName} → ${uniqueFilename}`)

          // Update tracking variables
          finalFileName = uniqueFilename
          finalFilePath = newFilePath

          // Update batch tracking (replace old path with new path)
          if (batchId) {
            const batchFiles = MockupController.batchFiles.get(batchId) || []
            const oldPathIndex = batchFiles.indexOf(mockupFilePath)
            if (oldPathIndex !== -1) {
              batchFiles[oldPathIndex] = newFilePath
              MockupController.batchFiles.set(batchId, batchFiles)
              console.log(`   📝 Updated batch tracking to new path`)
            }
          }

          // Update product tracking
          const productFilesList = MockupController.productFiles.get(productId) || []
          const productFileIndex = productFilesList.findIndex((f) => f.filePath === mockupFilePath)
          if (productFileIndex !== -1) {
            productFilesList[productFileIndex].filePath = newFilePath
            MockupController.productFiles.set(productId, productFilesList)
            console.log(`   📝 Updated product tracking to new path`)
          }
        } catch (renameError) {
          const errorMessage =
            renameError instanceof Error ? renameError.message : String(renameError)
          console.error(`❌ Failed to rename file: ${errorMessage}`)
          console.log(`   Using original filename`)
          // Keep original filename on error
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Failed to generate AI alt text:', errorMessage)
      console.log('   Using fallback alt text')
      altText = this.generateFallbackAlt(product)
    }

    // Create final public URL with final filename
    const baseUrl = Env.get('BACKEND_URL')
    const finalPublicUrl = `${baseUrl}/assets/${finalFileName}`
    console.log(`🌐 Final public URL: ${finalPublicUrl}`)

    // 3. Handle media upload based on type
    console.log(`🎬 Processing media with type: ${mediaType}`)

    // For VIDEO: Upload to Digital Ocean Spaces and set metafield (NOT Shopify media)
    if (mediaType === 'VIDEO') {
      console.log(`🎬 Video detected - uploading to Digital Ocean Spaces...`)

      const videoStorage = new VideoStorage()
      const uploadResult = await videoStorage.upload(productId, finalFilePath)

      if (!uploadResult.success) {
        throw new Error(`Failed to upload video to DO Spaces: ${uploadResult.error}`)
      }

      console.log(`✅ Video uploaded to DO Spaces: ${uploadResult.url}`)

      // Set the video URL in the product metafield
      await shopify.metafield.setVideoUrl(productId, uploadResult.url)

      // Set the video alt text in the product metafield
      if (altText) {
        await shopify.metafield.setVideoAlt(productId, altText)
      }

      console.log(`✅ Video metafields updated (url + alt)`)

      // Clean up local file after successful upload
      try {
        if (fs.existsSync(finalFilePath)) {
          fs.unlinkSync(finalFilePath)
          console.log(`🗑️  Local video file cleaned up: ${finalFileName}`)
        }
      } catch (cleanupError) {
        console.warn(`⚠️  Failed to clean up local file: ${cleanupError}`)
      }

      // For videos, we're done - no need to reorder media since it's stored in metafield
      return {
        reordered: false,
        oldMediaDetached: false,
        finalFilePath,
        finalFileName,
      }
    }

    // For IMAGE: Use existing Shopify media upload flow
    const allMedia = await shopify.product.createMedia(
      productId,
      finalPublicUrl,
      altText,
      mediaType,
      undefined
    )

    // Validate that we got media back
    if (!allMedia || allMedia.length === 0) {
      throw new Error('Failed to add media to product: No media returned from Shopify')
    }

    // productUpdate returns ALL media nodes - the new one is at the end
    const newMediaId = allMedia[allMedia.length - 1].id
    console.log(`✅ New media added with ID: ${newMediaId} (appended to end)`)

    // 5. Get updated product to see current media state
    const updatedProduct = await shopify.product.getProductById(productId)
    const newMediaCount = updatedProduct.media?.nodes?.length || 0
    console.log(`📸 Product now has ${newMediaCount} images`)

    // 6. Reorder media to move new media from end to target position
    // New media is currently at position (newMediaCount - 1), we want it at targetImagePosition
    const currentNewMediaPosition = newMediaCount - 1
    let reordered = false

    console.log(
      `🔍 DEBUG: insertMode = "${insertMode}", currentNewMediaPosition = ${currentNewMediaPosition}, targetImagePosition = ${targetImagePosition}`
    )

    if (currentNewMediaPosition !== targetImagePosition) {
      if (insertMode === 'insert') {
        // Insert mode: insert new media at target position, shifting existing media right
        console.log(
          `🔄 Insert mode: inserting new media at position ${targetImagePosition + 1} and shifting others`
        )

        const moves: Array<{ id: string; newPosition: string }> = []
        const mediaNodes = updatedProduct.media?.nodes || []

        console.log(`   📊 Total media nodes: ${mediaNodes.length}`)
        console.log(`   📊 New media ID: ${newMediaId}`)
        console.log(`   📊 Target position: ${targetImagePosition}`)

        // Build the desired order:
        // - Items before targetImagePosition keep their positions (0 to targetImagePosition-1)
        // - New item goes to targetImagePosition
        // - Items that were at targetImagePosition and after shift right by 1

        // Collect all media IDs except the new one, in their current order
        const existingMediaIds: string[] = []
        for (const node of mediaNodes) {
          const mediaId = (node as any).id
          if (mediaId !== newMediaId) {
            existingMediaIds.push(mediaId)
          }
        }

        console.log(`   📊 Existing media count (excluding new): ${existingMediaIds.length}`)

        // Build the new order
        let positionCounter = 0
        for (let i = 0; i < existingMediaIds.length; i++) {
          if (positionCounter === targetImagePosition) {
            // Insert new media at target position
            console.log(`   🆕 New media → position ${positionCounter}`)
            moves.push({
              id: newMediaId,
              newPosition: positionCounter.toString(),
            })
            positionCounter++
          }

          // Place existing media
          console.log(
            `   📍 Existing media ${i} (${existingMediaIds[i].slice(-8)}) → position ${positionCounter}`
          )
          moves.push({
            id: existingMediaIds[i],
            newPosition: positionCounter.toString(),
          })
          positionCounter++
        }

        // If target position is at the end, add new media there
        if (targetImagePosition >= existingMediaIds.length) {
          console.log(`   🆕 New media → position ${positionCounter} (at end)`)
          moves.push({
            id: newMediaId,
            newPosition: positionCounter.toString(),
          })
        }

        console.log(`   📋 Reorder moves (${moves.length} total): ${JSON.stringify(moves)}`)
        await shopify.product.reorderMedia(productId, moves)
        console.log(`✅ Media inserted and shifted successfully`)
        reordered = true
      } else {
        // Replace mode: just move new media to target position
        console.log(
          `🔄 Reordering: moving new media from position ${currentNewMediaPosition + 1} to position ${targetImagePosition + 1}`
        )

        await shopify.product.reorderMedia(productId, [
          {
            id: newMediaId,
            newPosition: targetImagePosition.toString(),
          },
        ])

        console.log(`✅ Media reordered successfully`)
        reordered = true
      }
    } else {
      console.log(`✅ New media already at correct position ${targetImagePosition + 1}`)
    }

    // Only delete old media in replace mode
    let oldMediaDetached = false
    if (insertMode === 'replace' && oldMediaId) {
      try {
        console.log(`🗑️  Removing old media from product: ${oldMediaId}`)
        const result = await shopify.product.detachMediaFromProduct(productId, [oldMediaId])
        const fileStatus = result[0]?.fileStatus || 'UNKNOWN'
        console.log(`✅ Old media detached from product (status: ${fileStatus})`)

        if (fileStatus === 'PROCESSING') {
          console.warn(`⚠️  File still processing - may need time to complete`)
        }
        oldMediaDetached = true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`⚠️  Failed to detach old media: ${errorMessage}`)
        console.warn(`   Old media remains at position ${targetImagePosition + 1}`)
      }
    } else if (insertMode === 'insert') {
      console.log(`✅ Insert mode: no media deleted, total images now: ${newMediaCount}`)
    }

    const actionVerb = insertMode === 'insert' ? 'insertion' : 'replacement'
    console.log(`🎨 Mockup ${actionVerb} complete at position ${targetImagePosition + 1}`)
    return { reordered, oldMediaDetached, finalFilePath, finalFileName }
  }

  /**
   * Generate fallback alt text when AI generation fails
   * @param product Product object with title and artworkTypeMetafield
   * @returns Fallback alt text (respects 125 character limit)
   */
  private generateFallbackAlt(product: any): string {
    const artworkType = product.artworkTypeMetafield?.value
    const suffix = artworkType === 'tapestry' ? 'tapisserie' : 'tableau'
    const alt = `${product.title} - ${suffix} décoratif mural en situation`
    return alt
  }

  /**
   * Sanitize filename by removing accents, special characters, and formatting as slug
   * @param filename The filename to sanitize (without extension)
   * @returns Sanitized filename (lowercase, hyphens only)
   */
  private sanitizeFilename(filename: string): string {
    return (
      filename
        // Normalize unicode to decompose accented characters (é → e + ́)
        .normalize('NFD')
        // Remove diacritics/accents (the combining characters)
        .replace(/[\u0300-\u036f]/g, '')
        // Convert to lowercase
        .toLowerCase()
        // Replace spaces, underscores, and other separators with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove any character that's not a-z, 0-9, or hyphen
        .replace(/[^a-z0-9-]/g, '')
        // Replace multiple consecutive hyphens with single hyphen
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
    )
  }

  /**
   * Find unique filename by appending counter if needed
   * @param baseFilename Base filename without extension
   * @param extension File extension (e.g., '.jpg')
   * @param directory Directory to check for existing files
   * @returns Unique filename with extension
   */
  private findUniqueFilename(baseFilename: string, extension: string, directory: string): string {
    let filename = `${baseFilename}${extension}`
    let filePath = path.join(directory, filename)

    // If file doesn't exist, use as-is
    if (!fs.existsSync(filePath)) {
      return filename
    }

    // File exists, try with counter suffix
    let counter = 2
    while (counter < 1000) {
      // Safety limit
      filename = `${baseFilename}-${counter}${extension}`
      filePath = path.join(directory, filename)

      if (!fs.existsSync(filePath)) {
        return filename
      }
      counter++
    }

    // Fallback: add timestamp
    const timestamp = Date.now()
    return `${baseFilename}-${timestamp}${extension}`
  }
}
