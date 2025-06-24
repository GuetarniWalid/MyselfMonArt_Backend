import { test } from '@japa/runner'
import UpdateProductHandler from 'App/Services/Pinterest/UpdateProductHandler'
import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'

test.group('UpdateProductHandler', (group) => {
  // Clean up database before and after each test
  group.each.setup(async () => {
    await Database.beginGlobalTransaction()
    return () => Database.rollbackGlobalTransaction()
  })

  test('should not update recommendations when no new boards exist', async ({ assert }) => {
    const oldDate = DateTime.now().minus({ days: 1 })
    const products = [
      {
        id: 'product-1',
        title: 'Test Product',
        description: 'Test Description',
        handle: 'test-product',
        media: { nodes: [] },
        metafields: { edges: [] },
        options: [],
        seo: { title: '', description: '' },
        tags: [],
        templateSuffix: '',
        vendor: 'Test Vendor',
        onlineStoreUrl: '',
      },
    ]

    // Create a board that's older than the recommendation
    const oldBoard = {
      id: 'old-board',
      name: 'Old Board',
      description: '',
      privacy: 'PUBLIC' as const,
      created_at: oldDate.minus({ days: 1 }).toISO(), // Even older than the recommendation
      board_pins_modified_at: oldDate.minus({ days: 1 }).toISO(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    }

    const boards = [oldBoard]

    const recommendations = [
      await PinterestBoardRecommendation.create({
        productId: 'product-1',
        boardIds: ['different-board'], // Convert to JSON string
        updatedAt: oldDate,
      }),
    ]

    const handler = new UpdateProductHandler(products, recommendations, boards)
    await handler.refreshBoardRecommendations()

    const updatedRecommendation = await PinterestBoardRecommendation.findOrFail(
      recommendations[0].id
    )
    assert.equal(updatedRecommendation.boardIds.length, 1)
    assert.deepEqual(updatedRecommendation.boardIds, ['different-board']) // Should keep original board
  })

  test('should update recommendations when new boards exist', async ({ assert }) => {
    const oldDate = DateTime.now().minus({ days: 1 })
    const newDate = DateTime.now()

    const products = [
      {
        id: 'product-1',
        title: 'Test Product',
        description: 'Test Description',
        handle: 'test-product',
        media: { nodes: [] },
        metafields: { edges: [] },
        options: [],
        seo: { title: '', description: '' },
        tags: [],
        templateSuffix: '',
        vendor: 'Test Vendor',
        onlineStoreUrl: '',
      },
    ]

    const boards = [
      {
        id: 'board-1',
        name: 'Test Board',
        description: '',
        privacy: 'PUBLIC' as const,
        created_at: oldDate.toISO(),
        board_pins_modified_at: oldDate.toISO(),
        pin_count: 0,
        follower_count: 0,
        collaborator_count: 0,
        is_ads_only: false,
        owner: { username: 'test' },
        media: { pin_thumbnail_urls: [], image_cover_url: null },
      },
      {
        id: 'board-2',
        name: 'New Board',
        description: '',
        privacy: 'PUBLIC' as const,
        created_at: newDate.toISO(),
        board_pins_modified_at: newDate.toISO(),
        pin_count: 0,
        follower_count: 0,
        collaborator_count: 0,
        is_ads_only: false,
        owner: { username: 'test' },
        media: { pin_thumbnail_urls: [], image_cover_url: null },
      },
    ]

    const recommendations = [
      await PinterestBoardRecommendation.create({
        productId: 'product-1',
        boardIds: ['board-1'],
        updatedAt: oldDate,
      }),
    ]

    const handler = new UpdateProductHandler(products, recommendations, boards)
    await handler.refreshBoardRecommendations()

    const updatedRecommendation = await PinterestBoardRecommendation.findOrFail(
      recommendations[0].id
    )
    assert.isTrue(updatedRecommendation.updatedAt > oldDate)
  })

  test('should not update recommendations for non-existent products', async ({ assert }) => {
    const oldDate = DateTime.now().minus({ days: 1 })
    const newDate = DateTime.now()

    const products = [
      {
        id: 'product-2', // Different from recommendation
        title: 'Test Product',
        description: 'Test Description',
        handle: 'test-product',
        media: { nodes: [] },
        metafields: { edges: [] },
        options: [],
        seo: { title: '', description: '' },
        tags: [],
        templateSuffix: '',
        vendor: 'Test Vendor',
        onlineStoreUrl: '',
      },
    ]

    const boards = [
      {
        id: 'board-1',
        name: 'Test Board',
        description: '',
        privacy: 'PUBLIC' as const,
        created_at: oldDate.toISO(),
        board_pins_modified_at: oldDate.toISO(),
        pin_count: 0,
        follower_count: 0,
        collaborator_count: 0,
        is_ads_only: false,
        owner: { username: 'test' },
        media: { pin_thumbnail_urls: [], image_cover_url: null },
      },
      {
        id: 'board-2',
        name: 'New Board',
        description: '',
        privacy: 'PUBLIC' as const,
        created_at: newDate.toISO(),
        board_pins_modified_at: newDate.toISO(),
        pin_count: 0,
        follower_count: 0,
        collaborator_count: 0,
        is_ads_only: false,
        owner: { username: 'test' },
        media: { pin_thumbnail_urls: [], image_cover_url: null },
      },
    ]

    const recommendations = [
      await PinterestBoardRecommendation.create({
        productId: 'product-1', // Different from products
        boardIds: ['board-1'], // Convert to JSON string
        updatedAt: oldDate,
      }),
    ]

    const handler = new UpdateProductHandler(products, recommendations, boards)
    await handler.refreshBoardRecommendations()

    const updatedRecommendation = await PinterestBoardRecommendation.findOrFail(
      recommendations[0].id
    )
    assert.equal(updatedRecommendation.boardIds.length, 1)
    assert.deepEqual(updatedRecommendation.boardIds, ['board-1'])
  })

  test('should update recommendation timestamp even when no new boards are relevant', async ({
    assert,
  }) => {
    const oldDate = DateTime.now().minus({ days: 1 })
    const newDate = DateTime.now()

    const products = [
      {
        id: 'product-1',
        title: 'Test Product',
        description: 'Test Description',
        handle: 'test-product',
        media: { nodes: [] },
        metafields: { edges: [] },
        options: [],
        seo: { title: '', description: '' },
        tags: [],
        templateSuffix: '',
        vendor: 'Test Vendor',
        onlineStoreUrl: '',
      },
    ]

    const boards = [
      {
        id: 'board-1',
        name: 'Test Board',
        description: '',
        privacy: 'PUBLIC' as const,
        created_at: oldDate.toISO(),
        board_pins_modified_at: oldDate.toISO(),
        pin_count: 0,
        follower_count: 0,
        collaborator_count: 0,
        is_ads_only: false,
        owner: { username: 'test' },
        media: { pin_thumbnail_urls: [], image_cover_url: null },
      },
      {
        id: 'board-2',
        name: 'New Board',
        description: '',
        privacy: 'PUBLIC' as const,
        created_at: newDate.toISO(),
        board_pins_modified_at: newDate.toISO(),
        pin_count: 0,
        follower_count: 0,
        collaborator_count: 0,
        is_ads_only: false,
        owner: { username: 'test' },
        media: { pin_thumbnail_urls: [], image_cover_url: null },
      },
    ]

    const recommendations = [
      await PinterestBoardRecommendation.create({
        productId: 'product-1',
        boardIds: ['board-1'],
        updatedAt: oldDate,
      }),
    ]

    const handler = new UpdateProductHandler(products, recommendations, boards)
    await handler.refreshBoardRecommendations()

    const updatedRecommendation = await PinterestBoardRecommendation.findOrFail(
      recommendations[0].id
    )
    assert.isTrue(updatedRecommendation.updatedAt > oldDate)
    assert.equal(updatedRecommendation.boardIds.length, 1)
  })
})
