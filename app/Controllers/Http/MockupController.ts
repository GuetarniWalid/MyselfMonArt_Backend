import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import type { Product } from 'types/Product'
import fs from 'fs'
import path from 'path'
import Application from '@ioc:Adonis/Core/Application'
import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'
import MockupQueue from 'App/Services/MockupQueue'

export default class MockupController {
  private queue = MockupQueue.getInstance()
  // Track files created for each automation batch for cleanup (static to persist across requests)
  private static batchFiles: Map<string, string[]> = new Map()

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

      const batchFiles = MockupController.batchFiles.get(batchId) || []
      let deletedCount = 0
      let failedCount = 0

      // Find and delete files that match this product ID
      // Files are named like: mockup-1234567890-timestamp.jpg
      const productIdNumeric = productId.replace('gid://shopify/Product/', '')
      const filesToDelete = batchFiles.filter((filePath) => {
        const fileName = path.basename(filePath)
        return fileName.includes(productIdNumeric)
      })

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
          console.error(`   ❌ Failed to delete ${path.basename(filePath)}: ${error.message}`)
        }
      }

      // Remove deleted files from batch tracking
      const remainingFiles = batchFiles.filter((f) => !filesToDelete.includes(f))
      MockupController.batchFiles.set(batchId, remainingFiles)

      console.log(
        `✅ Product cleanup complete: ${deletedCount} deleted, ${failedCount} failed, ${remainingFiles.length} remaining in batch`
      )

      return response.ok({
        success: true,
        deletedCount,
        failedCount,
        remainingFiles: remainingFiles.length,
        message: `Cleaned up ${deletedCount} file(s) for product`,
      })
    } catch (error) {
      console.error('❌ Product cleanup error:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Failed to cleanup product files',
      })
    }
  }

  // Get pending jobs
  public async getPendingJobs({ response }: HttpContextContract) {
    const jobs = this.queue.getPendingJobs()
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
        console.log('🔍 DEBUG: Starting Shopify upload with:', {
          resultPath: data.resultPath,
          productId: data.productId,
          targetImagePosition: data.targetImagePosition,
        })

        try {
          const uploadResult = await this.uploadMockupToShopify({
            productId: data.productId,
            mockupFilePath: data.resultPath,
            targetImagePosition: data.targetImagePosition || 0,
          })
          console.log(`✅ DEBUG: Mockup uploaded to Shopify for product ${data.productId}`)
          console.log(`🎨 Mockup uploaded to Shopify for product ${data.productId}`)

          // Return success with uploaded and reordered flags
          const successResult = {
            success: true,
            uploaded: true,
            reordered: uploadResult.reordered,
          }
          console.log('🔍 DEBUG: Returning success result:', successResult)
          return response.ok(successResult)
        } catch (error) {
          console.error(`❌ DEBUG: Failed to upload mockup to Shopify:`, error)
          console.error('❌ DEBUG: Error details:', {
            message: error.message,
            stack: error.stack,
            productId: data.productId,
            resultPath: data.resultPath,
          })

          // Generate public URL for the mockup file (so user can view it in browser)
          const fileName = path.basename(data.resultPath)
          const baseUrl = Env.get('BACKEND_URL')
          const publicUrl = `${baseUrl}/assets/${fileName}`

          // Return error to frontend (don't throw, return controlled error)
          const errorResult = {
            success: false,
            error: true,
            errorMessage: error.message,
            productId: data.productId,
            resultPath: publicUrl, // Use public URL instead of local file path
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
          console.error(`⚠️  Failed to delete source image: ${error.message}`)
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
          console.error(`⚠️  Failed to delete mockup result: ${error.message}`)
        }
      }
    }

    return response.ok({ success: true })
  }

  // Upload mockup file from plugin
  public async uploadMockup({ request, response }: HttpContextContract) {
    console.log('🔍 DEBUG: uploadMockup endpoint called')

    try {
      const mockupFile = request.file('mockup', {
        size: '20mb',
        extnames: ['jpg', 'jpeg', 'png'],
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

      // Track file to batch for cleanup
      if (batchId && MockupController.batchFiles.has(batchId)) {
        MockupController.batchFiles.get(batchId)?.push(filePath)
        console.log(`📝 Tracked file to batch ${batchId} for cleanup`)
      }

      const result = {
        success: true,
        filePath: filePath,
        fileName: fileName,
      }

      console.log('🔍 DEBUG: Returning upload result:', result)
      return response.ok(result)
    } catch (error) {
      console.error('❌ DEBUG: uploadMockup error:', error)
      console.error('❌ DEBUG: error stack:', error.stack)
      return response.internalServerError({
        error: 'Failed to upload file',
        details: error.message,
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

      // Build response with ID, title, and product count
      const collectionsWithCounts = paintingCollections.map((collection) => {
        // Count products that have this collection as mother_collection
        const productCount = allProducts.filter((product) => {
          if (!product.metafields?.edges) return false
          return product.metafields.edges.some(
            (edge) =>
              edge.node.namespace === 'link' &&
              edge.node.key === 'mother_collection' &&
              edge.node.reference?.title === collection.title
          )
        }).length

        return {
          id: collection.id,
          title: collection.title,
          productCount: productCount,
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
   * Reuses same logic as Midjourney service (app/Services/Midjourney/index.ts)
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
    const { collectionIds, mockupTemplatePath, targetImagePosition } = request.only([
      'collectionIds',
      'mockupTemplatePath',
      'targetImagePosition',
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

    console.log('🎨 Starting Mockup Automation via API')
    console.log(`   Collection IDs: ${JSON.stringify(collectionIds)}`)
    console.log(`   Mockup Template: ${mockupTemplatePath}`)

    // Generate unique batch ID for file tracking and cleanup
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    MockupController.batchFiles.set(batchId, [])
    console.log(`📦 Batch ID: ${batchId}`)

    try {
      const shopify = new Shopify()

      // Get all products from Shopify (including unpublished) and filter painting products first
      const allProducts = await shopify.product.getAll(true)
      const paintingProducts = allProducts.filter(
        (product) => product.templateSuffix === 'painting'
      )

      console.log(`📦 Total painting products found: ${paintingProducts.length}`)

      let productsToUpdate: typeof allProducts = []

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
          batchId: batchId, // Track batch for cleanup
        }

        this.queue.addJob(job)
        console.log(`   📝 Job added to queue: ${jobId}`)
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
   * Upload mockup to Shopify and replace product image at target position
   */
  private async uploadMockupToShopify({
    productId,
    mockupFilePath,
    targetImagePosition,
  }: {
    productId: string
    mockupFilePath: string
    targetImagePosition: number
  }): Promise<{ reordered: boolean }> {
    const shopify = new Shopify()

    // 1. Get product to check current media and save old media ID at target position
    const product = await shopify.product.getProductById(productId)
    const currentMediaCount = product.media?.nodes?.length || 0

    console.log(
      `📸 Product has ${currentMediaCount} images, target position: ${targetImagePosition + 1}`
    )

    // Save the old media ID at target position (if exists) - we'll delete it after reordering
    let oldMediaId: string | null = null
    if (currentMediaCount > targetImagePosition && product.media?.nodes) {
      oldMediaId = (product.media.nodes[targetImagePosition] as any).id
      console.log(`📝 Old media at position ${targetImagePosition + 1}: ${oldMediaId}`)
    }

    // 2. Generate public URL for mockup (file already uploaded by plugin)
    const fileName = path.basename(mockupFilePath)

    // Verify file exists in public/assets
    if (!fs.existsSync(mockupFilePath)) {
      throw new Error(`Mockup file not found at: ${mockupFilePath}`)
    }

    const baseUrl = Env.get('BACKEND_URL')
    const publicUrl = `${baseUrl}/assets/${fileName}`

    console.log(`🌐 Public URL: ${publicUrl}`)

    // 3. Add new media to product using public URL (productUpdate handles upload internally)
    const allMedia = await shopify.product.createMedia(productId, publicUrl)

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

    if (currentNewMediaPosition !== targetImagePosition) {
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
    } else {
      console.log(`✅ New media already at correct position ${targetImagePosition + 1}`)
    }

    // 7. Delete old media if it existed at target position
    // After reordering, the old media has been shifted one position to the right
    if (oldMediaId) {
      console.log(`🗑️  Deleting old media: ${oldMediaId}`)
      await shopify.product.deleteMedia(productId, [oldMediaId])
      console.log(`✅ Old media deleted`)
    }

    console.log(`🎨 Mockup replacement complete at position ${targetImagePosition + 1}`)
    return { reordered }
  }
}
