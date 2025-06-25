import { test } from '@japa/runner'
import PinFormatter from 'App/Services/Pinterest/PinFormatter'
import type { Product as ShopifyProduct } from 'Types/Product'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

// Ensure we're in test environment
process.env.NODE_ENV = 'test'

test.group('PinFormatter', () => {
  const mockProduct = {
    id: 'gid://shopify/Product/123456789',
    title: 'Test Product',
    description: 'A test product for testing',
    onlineStoreUrl: 'https://example.com/products/test-product',
    media: {
      nodes: [
        {
          alt: "Tableau cuisine vintage, petits tas d'épices colorées disposés en colonnes",
          mediaContentType: 'IMAGE',
          image: {
            width: 1700,
            height: 1877,
            url: 'https://cdn.shopify.com/s/files/1/0623/2388/4287/products/Tableau-epices-pour-cuisine-indienne-100x100.jpg?v=1676038316',
          },
        },
        {
          alt: "cadre cuisine vintage à l'aspect papier impériale",
          mediaContentType: 'IMAGE',
          image: {
            width: 1664,
            height: 1664,
            url: 'https://cdn.shopify.com/s/files/1/0623/2388/4287/products/Tableau-epices-pour-cuisine-indienne.jpg?v=1676038316',
          },
        },
        {
          alt: 'Représentation un tableau en 3D',
          mediaContentType: 'MODEL_3D',
        },
      ],
    },
  } as ShopifyProduct

  test('should get image from media nodes', async ({ assert }) => {
    const formatter = new PinFormatter()
    const image = formatter['getImage'](mockProduct.media.nodes)

    assert.equal(image.mediaContentType, 'IMAGE')
    assert.exists(image.image)
    if (!image.image) throw new Error('Image is undefined')
    assert.exists(image.image.url)
    assert.equal(
      image.alt,
      "Tableau cuisine vintage, petits tas d'épices colorées disposés en colonnes"
    )
  })

  test('should throw error when no images are available', async ({ assert }) => {
    const formatter = new PinFormatter()
    await assert.rejects(() => formatter['getImage']([]), 'No image found')
  })

  test('should download image and return buffer', async ({ assert }) => {
    const formatter = new PinFormatter()
    const imageUrl = mockProduct.media.nodes[0].image!.url
    const buffer = await formatter['downloadImage'](imageUrl)

    assert.isTrue(Buffer.isBuffer(buffer))
    assert.isAbove(buffer.length, 0)
  })

  test('should crop image to correct dimensions', async ({ assert }) => {
    const formatter = new PinFormatter()
    const imageUrl = mockProduct.media.nodes[0].image!.url
    const buffer = await formatter['downloadImage'](imageUrl)
    const croppedBuffer = await formatter['cropImage'](buffer)

    const image = sharp(croppedBuffer)
    const metadata = await image.metadata()

    assert.equal(metadata.width, 1000)
    assert.equal(metadata.height, 1500)
  })

  test('should add red border to image', async ({ assert }) => {
    const formatter = new PinFormatter()
    const imageUrl = mockProduct.media.nodes[0].image!.url
    const buffer = await formatter['downloadImage'](imageUrl)
    const croppedBuffer = await formatter['cropImage'](buffer)
    const borderedBuffer = await formatter['addBorder'](croppedBuffer, {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board with color Ref: 42.126.78.45',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    })

    assert.isTrue(Buffer.isBuffer(borderedBuffer))
    assert.isAbove(borderedBuffer.length, 0)
  })

  test('should save image locally and return correct URL', async ({ assert }) => {
    const formatter = new PinFormatter()
    const imageUrl = mockProduct.media.nodes[0].image!.url
    const buffer = await formatter['downloadImage'](imageUrl)
    const croppedBuffer = await formatter['cropImage'](buffer)
    const borderedBuffer = await formatter['addBorder'](croppedBuffer, {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board with color Ref: 42.126.78.45',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    })
    const publicUrl = await formatter['saveImageLocally'](borderedBuffer)

    assert.isTrue(publicUrl.startsWith('/uploads/'))
    assert.isTrue(publicUrl.endsWith('.png'))

    const filename = path.basename(publicUrl)
    const filepath = path.join('public/uploads', filename)
    const fileExists = await fs
      .access(filepath)
      .then(() => true)
      .catch(() => false)

    assert.isTrue(fileExists)

    // Cleanup
    await formatter.removeImage(publicUrl)
  })

  test('should remove image file', async ({ assert }) => {
    const formatter = new PinFormatter()
    const imageUrl = mockProduct.media.nodes[0].image!.url
    const buffer = await formatter['downloadImage'](imageUrl)
    const croppedBuffer = await formatter['cropImage'](buffer)
    const borderedBuffer = await formatter['addBorder'](croppedBuffer, {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board with color Ref: 42.126.78.45',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    })
    const publicUrl = await formatter['saveImageLocally'](borderedBuffer)

    await formatter.removeImage(publicUrl)

    const filename = path.basename(publicUrl)
    const filepath = path.join('public/uploads', filename)
    const fileExists = await fs
      .access(filepath)
      .then(() => true)
      .catch(() => false)

    assert.isFalse(fileExists)
  })

  test('should build complete pin payload', async ({ assert }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const pinPayload = await formatter.buildPinPayload(mockProduct, board)

    assert.equal(pinPayload.board_id, board.id)
    assert.exists(pinPayload.title)
    assert.exists(pinPayload.description)
    assert.equal(
      pinPayload.link,
      'https://example.com/products/test-product?shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F123456789'
    )
    assert.exists(pinPayload.alt_text)
    assert.exists(pinPayload.media_source)
    assert.equal(pinPayload.media_source.source_type, 'image_url')
    assert.isTrue(pinPayload.media_source.url.startsWith('/uploads/'))
    assert.isTrue(pinPayload.media_source.url.endsWith('.png'))

    // Cleanup
    await formatter.removeImage(pinPayload.media_source.url)
  })

  test('should return default color when board has no description', ({ assert }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      description: undefined,
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const color = formatter['chooseBorderColor'](board)
    assert.deepEqual(color, { r: 0, g: 0, b: 0, alpha: 0 })
  })

  test('should return default color when description has no color reference', ({ assert }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board without color reference',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const color = formatter['chooseBorderColor'](board)
    assert.deepEqual(color, { r: 0, g: 0, b: 0, alpha: 0 })
  })

  test('should extract color values from board description', ({ assert }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board with color Ref: 42.126.78.45',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const color = formatter['chooseBorderColor'](board)
    assert.deepEqual(color, {
      r: 42,
      g: 126,
      b: 78,
      alpha: 0.45,
    })
  })

  test('should handle color reference with different spacing', ({ assert }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board with color Ref:42.126.78.45',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const color = formatter['chooseBorderColor'](board)
    assert.deepEqual(color, {
      r: 42,
      g: 126,
      b: 78,
      alpha: 0.45,
    })
  })

  test('should handle color reference with missing alpha and default to 1', ({ assert }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      description: 'This is a test board with color Ref: 3.3.3',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const color = formatter['chooseBorderColor'](board)
    assert.deepEqual(color, {
      r: 3,
      g: 3,
      b: 3,
      alpha: 1,
    })
  })

  test('should generate product link with product ID for simple URL', ({ assert }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/123456789',
      onlineStoreUrl: 'https://example.com/product',
    } as ShopifyProduct

    const result = formatter['getProductLinkWithProductId'](shopifyProduct)

    assert.equal(
      result,
      'https://example.com/product?shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F123456789'
    )
  })

  test('should generate product link with product ID for URL with existing query parameters', ({
    assert,
  }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/987654321',
      onlineStoreUrl: 'https://example.com/product?existing=param&another=value',
    } as ShopifyProduct

    const result = formatter['getProductLinkWithProductId'](shopifyProduct)

    assert.equal(
      result,
      'https://example.com/product?existing=param&another=value&shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F987654321'
    )
  })

  test('should generate product link with product ID for URL with hash fragment', ({ assert }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/555666777',
      onlineStoreUrl: 'https://example.com/product#section',
    } as ShopifyProduct

    const result = formatter['getProductLinkWithProductId'](shopifyProduct)

    assert.equal(
      result,
      'https://example.com/product?shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F555666777#section'
    )
  })

  test('should generate product link with product ID for URL with both query parameters and hash fragment', ({
    assert,
  }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/111222333',
      onlineStoreUrl: 'https://example.com/product?param=value#section',
    } as ShopifyProduct

    const result = formatter['getProductLinkWithProductId'](shopifyProduct)

    assert.equal(
      result,
      'https://example.com/product?param=value&shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F111222333#section'
    )
  })

  test('should handle URL with trailing slash', ({ assert }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/777888999',
      onlineStoreUrl: 'https://example.com/product/',
    } as ShopifyProduct

    const result = formatter['getProductLinkWithProductId'](shopifyProduct)

    assert.equal(
      result,
      'https://example.com/product/?shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F777888999'
    )
  })

  test('should handle product ID with special characters', ({ assert }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/123-456_789',
      onlineStoreUrl: 'https://example.com/product',
    } as ShopifyProduct

    const result = formatter['getProductLinkWithProductId'](shopifyProduct)

    assert.equal(
      result,
      'https://example.com/product?shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F123-456_789'
    )
  })

  test('should verify getProductLinkWithProductId is used in buildPinPayload', async ({
    assert,
  }) => {
    const formatter = new PinFormatter()
    const board = {
      id: '123',
      name: 'Test Board',
      privacy: 'PUBLIC' as const,
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    // Create a mock product with a specific onlineStoreUrl and id
    const mockProductWithUrl = {
      ...mockProduct,
      id: 'gid://shopify/Product/123456789',
      onlineStoreUrl: 'https://myselfmonart.com/products/test-product',
    } as ShopifyProduct

    const pinPayload = await formatter.buildPinPayload(mockProductWithUrl, board)

    // Verify that the link contains the product ID as a query parameter
    assert.equal(
      pinPayload.link,
      'https://myselfmonart.com/products/test-product?shopify_product_id=gid%3A%2F%2Fshopify%2FProduct%2F123456789'
    )

    // Cleanup
    await formatter.removeImage(pinPayload.media_source.url)
  })

  test('should throw error for empty onlineStoreUrl', ({ assert }) => {
    const formatter = new PinFormatter()
    const shopifyProduct = {
      id: 'gid://shopify/Product/444555666',
      onlineStoreUrl: '',
    } as ShopifyProduct

    assert.throws(() => formatter['getProductLinkWithProductId'](shopifyProduct), 'Invalid URL')
  })
})
