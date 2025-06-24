import { test } from '@japa/runner'
import PinterestPoster from 'App/Services/Pinterest/PinterestPoster'
import { PinPayload } from 'Types/Pinterest'

test.group('PinterestPoster', () => {
  test('should validate a valid pin payload', async ({ assert }) => {
    const poster = new PinterestPoster()
    const validPayload: PinPayload = {
      board_id: '123',
      title: 'Test Pin',
      description: 'Test Description',
      link: 'https://example.com',
      alt_text: 'Test Alt Text',
      media_source: {
        url: 'https://example.com/image.jpg',
        source_type: 'image_url',
      },
    }

    // This should not throw an error
    try {
      await poster['validatePinPayload'](validPayload)
      assert.isTrue(true) // If we reach here, validation passed
    } catch (error) {
      assert.fail('Validation should not have failed')
    }
  })

  test('should throw error for invalid pin payload', async ({ assert }) => {
    const poster = new PinterestPoster()
    const invalidPayload = {
      board_id: '123',
      // Missing required fields
    } as PinPayload

    await assert.rejects(() => poster['validatePinPayload'](invalidPayload), 'Invalid pin payload')
  })

  test('should throw error for invalid media source type', async ({ assert }) => {
    const poster = new PinterestPoster()
    const invalidPayload: PinPayload = {
      board_id: '123',
      title: 'Test Pin',
      description: 'Test Description',
      link: 'https://example.com',
      alt_text: 'Test Alt Text',
      media_source: {
        url: 'https://example.com/image.jpg',
        // @ts-expect-error - Invalid source type
        source_type: 'VIDEO' as const,
      },
    }

    await assert.rejects(() => poster['validatePinPayload'](invalidPayload), 'Invalid pin payload')
  })

  test('should create and delete a pin on Pinterest', async ({ assert }) => {
    const poster = new PinterestPoster()

    const pinPayload: PinPayload = {
      board_id: '1029424496015515152',
      title: 'Mon produit XYZ',
      description: 'Blabla descriptif SEO',
      link: 'https://www.myselfmonart.com/',
      media_source: {
        source_type: 'image_url',
        url: 'https://www.bigfootdigital.co.uk/wp-content/uploads/2020/07/image-optimisation-scaled.jpg',
      },
      alt_text: 'Vue de face du produit',
    }

    // Create pin
    const createResponse = (await poster['sendPinToPinterest'](pinPayload)) as any
    assert.exists(createResponse.id, 'Pin creation should return an id')
    assert.equal(createResponse.title, pinPayload.title)
    assert.equal(createResponse.board_id, pinPayload.board_id)
  })
})
