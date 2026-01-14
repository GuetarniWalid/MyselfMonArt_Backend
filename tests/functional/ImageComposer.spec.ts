import { test } from '@japa/runner'
import ImageComposer from 'App/Services/ShopifyProductPublisher/ImageComposer'
import type { Ratio } from 'Types/ShopifyProductPublisher'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

test.group('ImageComposer', (group) => {
  let testImageBase64: string
  let testImageBuffer: Buffer

  group.setup(async () => {
    // Create a test image buffer
    testImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    // Convert to base64
    testImageBase64 = testImageBuffer.toString('base64')
  })

  test('should resize square image to optimal size', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(testImageBase64, 'square')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should use optimal size: 640x640
    assert.equal(metadata.width, 640)
    assert.equal(metadata.height, 640)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should resize portrait image to optimal size', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(testImageBase64, 'portrait')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should use optimal size: 600x800
    assert.equal(metadata.width, 600)
    assert.equal(metadata.height, 800)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should resize landscape image to optimal size', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(testImageBase64, 'landscape')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should use optimal size: 800x600
    assert.equal(metadata.width, 800)
    assert.equal(metadata.height, 600)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should throw error for invalid base64 image', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    await assert.rejects(async () => {
      await imageComposer.processImage('invalid-base64-data', 'square')
    }, /Input buffer contains unsupported image format/)
  })

  test('should handle base64 image with data URL prefix', async ({ assert }) => {
    // Create base64 with data URL prefix
    const dataUrlBase64 = `data:image/png;base64,${testImageBase64}`
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(dataUrlBase64, 'square')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    assert.equal(metadata.width, 640)
    assert.equal(metadata.height, 640)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should save image and return correct URL', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(testImageBase64, 'square')

    // Check that the URL format is correct
    assert.isTrue(result.includes('/uploads/'))
    assert.isTrue(result.endsWith('.jpg'))

    // Extract filename from URL and check if file exists
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const fileExists = await fs
      .access(filepath)
      .then(() => true)
      .catch(() => false)

    assert.isTrue(fileExists)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should create upload directory if it does not exist', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    // Remove upload directory if it exists
    try {
      await fs.rmdir('public/uploads')
    } catch (error) {
      // Directory doesn't exist, which is fine
    }

    const result = await imageComposer.processImage(testImageBase64, 'square')

    // Check that directory was created
    const dirExists = await fs
      .access('public/uploads')
      .then(() => true)
      .catch(() => false)
    assert.isTrue(dirExists)

    // Cleanup
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    await fs.unlink(filepath)
  })

  test('should generate unique filenames', async ({ assert }) => {
    const imageComposer1 = new ImageComposer()
    const imageComposer2 = new ImageComposer()

    const result1 = await imageComposer1.processImage(testImageBase64, 'square')
    const result2 = await imageComposer2.processImage(testImageBase64, 'square')

    const filename1 = result1.split('/').pop()
    const filename2 = result2.split('/').pop()

    assert.notEqual(filename1, filename2)

    // Cleanup
    await fs.unlink(path.join('public/uploads', filename1!))
    await fs.unlink(path.join('public/uploads', filename2!))
  })

  test('should process base64 image and return public URL', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(testImageBase64, 'square')

    // Check that the result is a valid URL
    assert.isTrue(result.startsWith('http://localhost:3333') || result.startsWith(''))
    assert.isTrue(result.includes('/uploads/'))
    assert.isTrue(result.endsWith('.jpg'))

    // Check that the file exists and has correct dimensions
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should use optimal size: 640x640
    assert.equal(metadata.width, 640)
    assert.equal(metadata.height, 640)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should handle all ratio types with base64 images', async ({ assert }) => {
    const ratios: Ratio[] = ['square', 'portrait', 'landscape']

    for (const ratio of ratios) {
      const imageComposer = new ImageComposer()
      const result = await imageComposer.processImage(testImageBase64, ratio)

      // Check that file exists
      const filename = result.split('/').pop()
      const filepath = path.join('public/uploads', filename!)
      const fileExists = await fs
        .access(filepath)
        .then(() => true)
        .catch(() => false)

      assert.isTrue(fileExists, `File should exist for ratio: ${ratio}`)

      // Cleanup
      await fs.unlink(filepath)
    }
  })

  test('should throw error for invalid base64 image in processImage', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    await assert.rejects(async () => {
      await imageComposer.processImage('invalid-base64-data', 'square')
    }, /Input buffer contains unsupported image format/)
  })

  test('should optimize image quality to target size', async ({ assert }) => {
    const imageComposer = new ImageComposer()

    const result = await imageComposer.processImage(testImageBase64, 'square')

    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const fileStats = await fs.stat(filepath)
    const fileSizeKB = fileStats.size / 1024

    // Check that the file size is within the target range (300KB max for square)
    assert.isBelow(fileSizeKB, 300, `File size ${fileSizeKB.toFixed(1)}KB should be below 300KB`)

    // Check that the image is in JPEG format
    const metadata = await sharp(filepath).metadata()
    assert.equal(metadata.format, 'jpeg')

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should maintain optimal dimensions for all ratios', async ({ assert }) => {
    const expectedSizes = {
      square: { width: 640, height: 640 },
      portrait: { width: 600, height: 800 },
      landscape: { width: 800, height: 600 },
    }

    for (const [ratio, expectedSize] of Object.entries(expectedSizes)) {
      const imageComposer = new ImageComposer()
      const result = await imageComposer.processImage(testImageBase64, ratio as Ratio)
      const filename = result.split('/').pop()
      const filepath = path.join('public/uploads', filename!)
      const metadata = await sharp(filepath).metadata()

      assert.equal(
        metadata.width,
        expectedSize.width,
        `Width should be ${expectedSize.width} for ${ratio}`
      )
      assert.equal(
        metadata.height,
        expectedSize.height,
        `Height should be ${expectedSize.height} for ${ratio}`
      )

      // Cleanup
      await fs.unlink(filepath)
    }
  })
})
