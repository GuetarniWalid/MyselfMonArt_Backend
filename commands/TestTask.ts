import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import ImageComposer from 'App/Services/Midjourney/ImageComposer'
import { backgrounds } from 'App/Services/Midjourney/backgroundsData'
import fs from 'fs/promises'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test image composition with background and shadow'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Test Image Composition')

    try {
      // Read the test image and convert to base64
      const testImagePath = 'public/uploads/test.png'
      const testImageBuffer = await fs.readFile(testImagePath)
      const testImageBase64 = testImageBuffer.toString('base64')

      // Create ImageComposer instance
      const imageComposer = new ImageComposer(testImageBase64)

      // Test composition with all backgrounds
      console.log('🎨 Composing image with all backgrounds...')

      // Use all backgrounds (no filter)
      const composedImageUrl = await this.testWithTopLayerBackgrounds(
        imageComposer,
        'portrait',
        backgrounds // Pass all backgrounds here
      )

      console.log('✅ Composed image URLs:', composedImageUrl)

      // Extract filenames from URLs for display
      const filenames = composedImageUrl.map((url) => url.split('/').pop())
      console.log(' Generated filenames:', filenames)
    } catch (error) {
      console.error('❌ Error during image composition:', error)
    }

    logTaskBoundary(false, 'Test Image Composition')
  }

  private async testWithTopLayerBackgrounds(
    imageComposer: ImageComposer,
    ratio: 'portrait' | 'landscape' | 'square',
    backgroundsWithTopLayers: any[]
  ): Promise<string[]> {
    // Use all backgrounds for testing
    const selectedBackgrounds = backgroundsWithTopLayers
    console.log(`🎯 Using ${selectedBackgrounds.length} backgrounds for testing`)

    const newImageUrlsPromises = selectedBackgrounds.map(async (background) => {
      // Access the private method using any type to bypass TypeScript restrictions
      const composeMethod = (imageComposer as any).composeImageWithBackground.bind(imageComposer)
      const composedImageBuffer = await composeMethod(background, ratio)
      const saveMethod = (imageComposer as any).saveImageLocally.bind(imageComposer)
      const newImageUrl = await saveMethod(composedImageBuffer)
      return newImageUrl
    })

    const newImageUrls = await Promise.all(newImageUrlsPromises)
    return newImageUrls
  }
}
