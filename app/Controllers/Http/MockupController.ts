import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import type { Product } from 'types/Product'
import fs from 'fs'
import path from 'path'
import Application from '@ioc:Adonis/Core/Application'
import axios from 'axios'
import Shopify from 'App/Services/Shopify'
import MockupQueue from 'App/Services/MockupQueue'

export default class MockupController {
  private queue = MockupQueue.getInstance()

  // Simple status endpoint
  public async status({ response }: HttpContextContract) {
    return response.ok({ status: 'ok', message: 'Mockup service is running' })
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
    }

    return response.ok({ success: true })
  }

  // Download image file
  public async downloadImage({ request, response }: HttpContextContract) {
    const filePath = request.input('path')

    if (!filePath) {
      return response.badRequest({ error: 'No file path provided' })
    }

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return response.notFound({ error: 'File not found' })
      }

      // Read file
      const fileBuffer = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)

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
      const allProducts = await shopify.product.getAll()

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

  // Start mockup automation
  public async startAutomation({ request, response }: HttpContextContract) {
    const { processAll, numberOfProducts } = request.only(['processAll', 'numberOfProducts'])

    console.log('🎨 Starting Mockup Automation via API')
    console.log(`   Process all: ${processAll}`)
    console.log(`   Number of products: ${numberOfProducts}`)

    try {
      // Get all products from Shopify
      const shopify = new Shopify()
      const products = await shopify.product.getAll()
      const paintingProducts = products.filter((product) => product.templateSuffix === 'painting')

      const productsToUpdate = processAll
        ? paintingProducts
        : paintingProducts.slice(0, numberOfProducts)

      console.log(`📦 Total painting products found: ${paintingProducts.length}`)
      console.log(`📝 Products selected for processing: ${productsToUpdate.length}`)

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

        // Download image
        const filePath = await this.downloadProductImage(secondImage.url, product.id)
        console.log(`   ✅ Downloaded to: ${filePath}`)

        // Create and send mockup job
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const job = {
          id: jobId,
          productId: product.id,
          productTitle: product.title,
          imageUrl: filePath,
        }

        this.queue.addJob(job)
        console.log(`   📝 Job added to queue: ${jobId}`)
        jobs.push(jobId)
      }

      return response.ok({
        success: true,
        totalJobs: jobs.length,
        jobIds: jobs,
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
}
