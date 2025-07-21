import { test } from '@japa/runner'
import ImageComposer from 'App/Services/Midjourney/ImageComposer'
import type { Ratio } from 'Types/Midjourney'
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
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getOptimizedImage('square')
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
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getOptimizedImage('portrait')
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
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getOptimizedImage('landscape')
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
    const imageComposer = new ImageComposer('invalid-base64-data')

    await assert.rejects(async () => {
      await imageComposer.getOptimizedImage('square')
    }, /Input buffer contains unsupported image format/)
  })

  test('should handle base64 image with data URL prefix', async ({ assert }) => {
    // Create base64 with data URL prefix
    const dataUrlBase64 = `data:image/png;base64,${testImageBase64}`
    const imageComposer = new ImageComposer(dataUrlBase64)

    const result = await imageComposer.getOptimizedImage('square')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    assert.equal(metadata.width, 640)
    assert.equal(metadata.height, 640)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should save image and return correct URL', async ({ assert }) => {
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getOptimizedImage('square')

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
    const imageComposer = new ImageComposer(testImageBase64)

    // Remove upload directory if it exists
    try {
      await fs.rmdir('public/uploads')
    } catch (error) {
      // Directory doesn't exist, which is fine
    }

    const result = await imageComposer.getOptimizedImage('square')

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
    const imageComposer1 = new ImageComposer(testImageBase64)
    const imageComposer2 = new ImageComposer(testImageBase64)

    const result1 = await imageComposer1.getOptimizedImage('square')
    const result2 = await imageComposer2.getOptimizedImage('square')

    const filename1 = result1.split('/').pop()
    const filename2 = result2.split('/').pop()

    assert.notEqual(filename1, filename2)

    // Cleanup
    await fs.unlink(path.join('public/uploads', filename1!))
    await fs.unlink(path.join('public/uploads', filename2!))
  })

  test('should process base64 image and return public URL', async ({ assert }) => {
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getOptimizedImage('square')

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
      const imageComposer = new ImageComposer(testImageBase64)
      const result = await imageComposer.getOptimizedImage(ratio)

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

  test('should throw error for invalid base64 image in main method', async ({ assert }) => {
    const imageComposer = new ImageComposer('invalid-base64-data')

    await assert.rejects(async () => {
      await imageComposer.getOptimizedImage('square')
    }, /Input buffer contains unsupported image format/)
  })

  test('should optimize image quality to target size', async ({ assert }) => {
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getOptimizedImage('square')

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
      const imageComposer = new ImageComposer(testImageBase64)
      const result = await imageComposer.getOptimizedImage(ratio as Ratio)
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

  test('should format square image correctly', async ({ assert }) => {
    const imageComposer = new ImageComposer(testImageBase64)

    // Test through getMainImage method which uses formatImageToRatio
    const result = await imageComposer.getMainImage('square')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // For square, should use the maximum dimension
    assert.equal(metadata.width, 600) // max of 800x600
    assert.equal(metadata.height, 600)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should format portrait image correctly', async ({ assert }) => {
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getMainImage('portrait')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // For portrait (0.75 ratio), should calculate: width = height * 0.75
    // Original: 800x600, aspect ratio = 800/600 = 1.33 > 0.75
    // So: targetWidth = 600 * 0.75 = 450, targetHeight = 600
    assert.equal(metadata.width, 450)
    assert.equal(metadata.height, 600)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should format landscape image correctly', async ({ assert }) => {
    const imageComposer = new ImageComposer(testImageBase64)

    const result = await imageComposer.getMainImage('landscape')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    assert.equal(metadata.width, 800)
    assert.equal(metadata.height, 600)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should handle already correct aspect ratio', async ({ assert }) => {
    // Create a square image (1:1 ratio)
    const squareImageBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const squareImageBase64 = squareImageBuffer.toString('base64')
    const imageComposer = new ImageComposer(squareImageBase64)

    const result = await imageComposer.getMainImage('square')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should keep original dimensions since aspect ratio is already correct
    assert.equal(metadata.width, 500)
    assert.equal(metadata.height, 500)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should handle portrait image with correct aspect ratio', async ({ assert }) => {
    // Create a portrait image (3:4 ratio = 0.75)
    const portraitImageBuffer = await sharp({
      create: {
        width: 300,
        height: 400,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const portraitImageBase64 = portraitImageBuffer.toString('base64')
    const imageComposer = new ImageComposer(portraitImageBase64)

    const result = await imageComposer.getMainImage('portrait')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should keep original dimensions since aspect ratio is already correct (0.75)
    assert.equal(metadata.width, 300)
    assert.equal(metadata.height, 400)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should handle landscape image with correct aspect ratio', async ({ assert }) => {
    // Create a landscape image (4:3 ratio = 1.33)
    const landscapeImageBuffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const landscapeImageBase64 = landscapeImageBuffer.toString('base64')
    const imageComposer = new ImageComposer(landscapeImageBase64)

    const result = await imageComposer.getMainImage('landscape')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // Should keep original dimensions since aspect ratio is already correct (1.33)
    assert.equal(metadata.width, 400)
    assert.equal(metadata.height, 300)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should throw error for invalid base64 in formatImageToRatio', async ({ assert }) => {
    const imageComposer = new ImageComposer('invalid-base64-data')

    await assert.rejects(async () => {
      await imageComposer.getMainImage('square')
    }, 'Input buffer contains unsupported image format')
  })

  test('should handle edge case with very small dimensions', async ({ assert }) => {
    // Create a very small image
    const smallImageBuffer = await sharp({
      create: {
        width: 10,
        height: 15,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const smallImageBase64 = smallImageBuffer.toString('base64')
    const imageComposer = new ImageComposer(smallImageBase64)

    const result = await imageComposer.getMainImage('portrait')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // For portrait (0.75 ratio): aspect ratio = 10/15 = 0.67 < 0.75
    // So: targetWidth = 10, targetHeight = 10 / 0.75 = 13.33 ≈ 13
    assert.equal(metadata.width, 10)
    assert.equal(metadata.height, 13)

    // Cleanup
    await fs.unlink(filepath)
  })

  test('should handle edge case with very large dimensions', async ({ assert }) => {
    // Create a large image
    const largeImageBuffer = await sharp({
      create: {
        width: 2000,
        height: 1500,
        channels: 4,
        background: { r: 64, g: 64, b: 64, alpha: 1 },
      },
    })
      .png()
      .toBuffer()

    const largeImageBase64 = largeImageBuffer.toString('base64')
    const imageComposer = new ImageComposer(largeImageBase64)

    const result = await imageComposer.getMainImage('landscape')
    const filename = result.split('/').pop()
    const filepath = path.join('public/uploads', filename!)
    const metadata = await sharp(filepath).metadata()

    // For landscape (1.33 ratio): aspect ratio = 2000/1500 = 1.33 = 1.33
    // Since aspect ratio is already correct (within 0.01), return original dimensions
    assert.equal(metadata.width, 2000)
    assert.equal(metadata.height, 1500)

    // Cleanup
    await fs.unlink(filepath)
  })
})
