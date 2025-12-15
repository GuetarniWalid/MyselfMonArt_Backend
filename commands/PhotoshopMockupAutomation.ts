import type { Product } from 'types/Product'
import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import Application from '@ioc:Adonis/Core/Application'

export default class PhotoshopMockupAutomation extends BaseCommand {
  public static commandName = 'photoshop:mockup_automation'
  public static description = 'Automate Photoshop mockup generation for paintings'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  private downloadedFiles: string[] = []
  private serverUrl = 'http://localhost:3333'

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
    console.log('🎨 Photoshop Mockup Automation - Phase 5')
    console.log('============================================')
    console.log(`Total painting products found: ${paintingProducts.length}`)
    console.log(`Products selected for processing: ${productsToUpdate.length}`)
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

        // Create and send mockup job to server
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const job = {
          id: jobId,
          productId: product.id,
          productTitle: product.title,
          imageUrl: filePath,
        }

        try {
          await axios.post(`${this.serverUrl}/api/mockup/add-job`, job)
          console.log(`   📝 Job sent to server: ${jobId}`)
          jobs.push(jobId)
        } catch (error) {
          console.error(`   ❌ Failed to send job: ${error.message}`)
        }

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
      console.log('✅ Phase 5 completed successfully!')
      console.log(`   Total jobs processed: ${jobs.length}`)
      console.log('============================================')
    } finally {
      // Cleanup files
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
   * Wait for job completion by polling the server
   */
  private async waitForJobCompletion(
    jobId: string,
    timeoutMs: number = 300000,
    pollIntervalMs: number = 2000
  ): Promise<{ jobId: string; resultPath: string }> {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        // Check for timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval)
          reject(new Error(`Job ${jobId} timed out`))
          return
        }

        try {
          // Check if job is completed
          const response = await axios.get(`${this.serverUrl}/api/mockup/job-status`, {
            params: { jobId },
          })

          if (response.data.completed) {
            clearInterval(checkInterval)
            const job = response.data.job

            // Check if job failed
            if (job.error) {
              reject(new Error(job.error))
            } else {
              resolve({
                jobId: job.jobId,
                resultPath: job.resultPath,
              })
            }
          }
        } catch (error) {
          // Don't fail on polling errors, just continue
          console.error(`   ⚠️  Polling error: ${error.message}`)
        }
      }, pollIntervalMs)
    })
  }
}
