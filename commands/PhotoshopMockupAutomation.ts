import type { Product } from 'types/Product'
import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import Application from '@ioc:Adonis/Core/Application'
import WebSocket from 'ws'
import { EventEmitter } from 'events'

export default class PhotoshopMockupAutomation extends BaseCommand {
  public static commandName = 'photoshop:mockup_automation'
  public static description = 'Automate Photoshop mockup generation for paintings'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  private downloadedFiles: string[] = []
  private ws: WebSocket | null = null
  private eventEmitter = new EventEmitter()
  private isConnected = false

  public async run() {
    const shouldUpdateAllProducts = await this.askIfWeShouldUpdateAllProducts()
    let numberOfProducts = 0
    if (!shouldUpdateAllProducts) {
      numberOfProducts = await this.askForNumberOfProducts()
    }

    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    const paintingProducts = this.getPaintingProducts(products)

    const productsToUpdate = shouldUpdateAllProducts
      ? paintingProducts
      : paintingProducts.slice(0, numberOfProducts)

    console.log('============================================')
    console.log('🎨 Photoshop Mockup Automation - Phase 3')
    console.log('============================================')
    console.log(`Total painting products found: ${paintingProducts.length}`)
    console.log(`Products selected for processing: ${productsToUpdate.length}`)
    console.log('============================================')

    // Connect to WebSocket server
    console.log('\n🔌 Connecting to WebSocket server...')
    try {
      await this.connectToWebSocket()
      console.log('✅ Connected to WebSocket server')
    } catch (error) {
      console.error('\n❌ Error: Could not connect to WebSocket server')
      console.error('   Please make sure the dev server is running:')
      console.error('   npm run dev\n')
      console.error(`   Error: ${error.message}`)
      return
    }

    console.log('============================================\n')

    const jobs: string[] = []

    try {
      for (const product of productsToUpdate) {
        console.log('--------------------------------------------')
        console.log(`📸 Processing product: ${product.title}`)
        console.log(`   Product ID: ${product.id}`)

        // Extract second image
        const secondImage = this.getSecondImage(product)
        if (!secondImage) {
          console.log(`   ⚠️  No second image found - skipping`)
          console.log('--------------------------------------------')
          continue
        }

        console.log(`   ✅ Second image found: ${secondImage.url}`)

        // Download image
        const filePath = await this.downloadImage(secondImage.url, product.id)
        console.log(`   ✅ Downloaded to: ${filePath}`)

        // Create and send mockup job via WebSocket
        const jobId = await this.sendMockupJob(product.id, product.title, filePath)
        console.log(`   📝 Job sent: ${jobId}`)
        jobs.push(jobId)

        console.log('--------------------------------------------')
      }

      console.log('\n⏳ Waiting for jobs to complete...\n')

      // Wait for all jobs to complete
      for (const jobId of jobs) {
        try {
          const result = await this.waitForJobCompletion(jobId)
          console.log(`✅ Job ${jobId} completed`)
          console.log(`   Result: ${result.resultPath}`)
        } catch (error) {
          console.error(`❌ Job ${jobId} failed: ${error.message}`)
        }
      }

      console.log('\n============================================')
      console.log('✅ Phase 3 completed successfully!')
      console.log(`   Total jobs processed: ${jobs.length}`)
      console.log('============================================')
    } finally {
      // Cleanup WebSocket and files
      this.disconnectWebSocket()
      await this.cleanup()
    }
  }

  private async askIfWeShouldUpdateAllProducts() {
    const shouldUpdateAllProducts = await this.prompt.confirm(
      'Do you want to process all paintings? (y/n)'
    )
    return shouldUpdateAllProducts
  }

  private async askForNumberOfProducts() {
    const numberOfProducts = await this.prompt.ask('Enter the number of paintings to process')
    return Number(numberOfProducts)
  }

  private getPaintingProducts(products: Product[]) {
    return products.filter((product) => product.templateSuffix === 'painting')
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
  private async downloadImage(url: string, productId: string): Promise<string> {
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
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
      })

      // Write to file
      fs.writeFileSync(filePath, response.data)

      // Track downloaded file for cleanup
      this.downloadedFiles.push(filePath)

      return filePath
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`)
    }
  }

  /**
   * Cleanup downloaded files
   */
  private async cleanup() {
    if (this.downloadedFiles.length === 0) {
      return
    }

    console.log('\n🧹 Cleaning up temporary files...')

    for (const filePath of this.downloadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log(`   ✅ Deleted: ${path.basename(filePath)}`)
        }
      } catch (error) {
        console.error(`   ❌ Failed to delete ${path.basename(filePath)}: ${error.message}`)
      }
    }

    console.log('✅ Cleanup completed\n')
    this.downloadedFiles = []
  }

  /**
   * Connect to WebSocket server
   */
  private async connectToWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:8081')

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 5000)

      this.ws.on('open', () => {
        clearTimeout(timeout)
        this.isConnected = true
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleWebSocketMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error.message)
        }
      })

      this.ws.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      this.ws.on('close', () => {
        this.isConnected = false
      })

      // Wait for 'connected' message from server
      this.eventEmitter.once('connected', () => {
        resolve()
      })
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'connected':
        this.eventEmitter.emit('connected')
        break

      case 'job_completed':
        this.eventEmitter.emit(`job:${message.jobId}:completed`, {
          jobId: message.jobId,
          resultPath: message.resultPath,
        })
        break

      case 'job_failed':
        this.eventEmitter.emit(`job:${message.jobId}:failed`, {
          jobId: message.jobId,
          error: message.error,
        })
        break

      default:
        // Ignore other messages
        break
    }
  }

  /**
   * Send a mockup job via WebSocket
   */
  private async sendMockupJob(
    productId: string,
    productTitle: string,
    imageUrl: string
  ): Promise<string> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected')
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const message = {
      type: 'new_job',
      job: {
        id: jobId,
        productId,
        productTitle,
        imageUrl,
      },
    }

    this.ws.send(JSON.stringify(message))
    return jobId
  }

  /**
   * Wait for job completion (event-based)
   */
  private async waitForJobCompletion(
    jobId: string,
    timeoutMs: number = 300000
  ): Promise<{ jobId: string; resultPath: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventEmitter.removeAllListeners(`job:${jobId}:completed`)
        this.eventEmitter.removeAllListeners(`job:${jobId}:failed`)
        reject(new Error(`Job ${jobId} timed out`))
      }, timeoutMs)

      this.eventEmitter.once(`job:${jobId}:completed`, (result) => {
        clearTimeout(timeout)
        this.eventEmitter.removeAllListeners(`job:${jobId}:failed`)
        resolve(result)
      })

      this.eventEmitter.once(`job:${jobId}:failed`, (error) => {
        clearTimeout(timeout)
        this.eventEmitter.removeAllListeners(`job:${jobId}:completed`)
        reject(new Error(error.error || 'Job failed'))
      })
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  private disconnectWebSocket() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }
}
