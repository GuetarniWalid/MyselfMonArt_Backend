import { test } from '@japa/runner'
import PublicationSelector from 'App/Services/Pinterest/PublicationSelector'
import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import type { Board, PinterestPin } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'

test.group('PublicationSelector', (group) => {
  // Clean up database before and after each test
  group.each.setup(async () => {
    await Database.beginGlobalTransaction()
    return () => Database.rollbackGlobalTransaction()
  })

  const mockBoards: Board[] = [
    {
      id: 'board1',
      name: 'Board 1',
      privacy: 'PUBLIC',
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    },
    {
      id: 'board2',
      name: 'Board 2',
      privacy: 'PUBLIC',
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    },
    {
      id: 'board3',
      name: 'Board 3',
      privacy: 'PUBLIC',
      created_at: new Date().toISOString(),
      board_pins_modified_at: new Date().toISOString(),
      pin_count: 0,
      follower_count: 0,
      collaborator_count: 0,
      is_ads_only: false,
      owner: { username: 'test' },
      media: { pin_thumbnail_urls: [], image_cover_url: null },
    },
  ]

  const mockShopifyProducts: ShopifyProduct[] = [
    {
      id: 'product1',
      title: 'Product 1',
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
    {
      id: 'product2',
      title: 'Product 2',
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
    {
      id: 'product3',
      title: 'Product 3',
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

  const mockPins: PinterestPin[] = [
    {
      id: 'pin1',
      board_id: 'board1',
      link: 'https://example.com?shopify_product_id=product1',
      alt_text: '',
      is_removable: false,
      creative_type: 'REGULAR',
      board_owner: { username: 'test', full_name: 'Test User', id: '1' },
      pin_metrics: null,
      is_owner: true,
      title: 'Test Pin',
      product_tags: [],
      created_at: new Date().toISOString(),
      media: { type: 'image', url: '', width: 0, height: 0 },
      board_section_id: null,
      description: '',
      dominant_color: '#000000',
      is_standard: true,
      parent_pin_id: null,
      has_been_promoted: false,
      note: '',
    },
    {
      id: 'pin2',
      board_id: 'board2',
      link: 'https://example.com?shopify_product_id=product1',
      alt_text: '',
      is_removable: false,
      creative_type: 'REGULAR',
      board_owner: { username: 'test', full_name: 'Test User', id: '1' },
      pin_metrics: null,
      is_owner: true,
      title: 'Test Pin',
      product_tags: [],
      created_at: new Date().toISOString(),
      media: { type: 'image', url: '', width: 0, height: 0 },
      board_section_id: null,
      description: '',
      dominant_color: '#000000',
      is_standard: true,
      parent_pin_id: null,
      has_been_promoted: false,
      note: '',
    },
    {
      id: 'pin3',
      board_id: 'board1',
      link: 'https://example.com?shopify_product_id=product2',
      alt_text: '',
      is_removable: false,
      creative_type: 'REGULAR',
      board_owner: { username: 'test', full_name: 'Test User', id: '1' },
      pin_metrics: null,
      is_owner: true,
      title: 'Test Pin',
      product_tags: [],
      created_at: new Date().toISOString(),
      media: { type: 'image', url: '', width: 0, height: 0 },
      board_section_id: null,
      description: '',
      dominant_color: '#000000',
      is_standard: true,
      parent_pin_id: null,
      has_been_promoted: false,
      note: '',
    },
    {
      id: 'pin4',
      board_id: 'board2',
      link: 'https://example.com?shopify_product_id=product2',
      alt_text: '',
      is_removable: false,
      creative_type: 'REGULAR',
      board_owner: { username: 'test', full_name: 'Test User', id: '1' },
      pin_metrics: null,
      is_owner: true,
      title: 'Test Pin',
      product_tags: [],
      created_at: new Date().toISOString(),
      media: { type: 'image', url: '', width: 0, height: 0 },
      board_section_id: null,
      description: '',
      dominant_color: '#000000',
      is_standard: true,
      parent_pin_id: null,
      has_been_promoted: false,
      note: '',
    },
  ]

  test('should select next product to publish', async ({ assert }) => {
    // Create test recommendations in the database
    await Promise.all([
      PinterestBoardRecommendation.create({
        productId: 'product1',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
      PinterestBoardRecommendation.create({
        productId: 'product2',
        boardIds: ['board1', 'board2'],
        updatedAt: DateTime.now(),
      }),
      PinterestBoardRecommendation.create({
        productId: 'product3',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
    ])

    const selector = new PublicationSelector(mockBoards, mockPins, mockShopifyProducts)
    const result = await selector.selectNextProductToPublish()

    // Product3 should be selected as it has no pins
    assert.equal(result.product.id, 'product3')
    assert.include(['board1', 'board2', 'board3'], result.board.id)
  })

  test('should get eligible products', async ({ assert }) => {
    // Create test recommendations in the database
    await Promise.all([
      PinterestBoardRecommendation.create({
        productId: 'product1',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
      PinterestBoardRecommendation.create({
        productId: 'product2',
        boardIds: ['board1', 'board2'],
        updatedAt: DateTime.now(),
      }),
      PinterestBoardRecommendation.create({
        productId: 'product3',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
    ])
    const recommendations = await PinterestBoardRecommendation.all()

    const selector = new PublicationSelector(mockBoards, mockPins, mockShopifyProducts)
    selector['productsWithBoardRecommendations'] = recommendations
    const eligibleProducts = selector['getEligibleProducts']()

    // Product3 should be eligible as it has no pins
    assert.equal(eligibleProducts.length, 2)
    assert.equal(eligibleProducts[0].productId, 'product3')
    assert.equal(eligibleProducts[1].productId, 'product1')
  })

  test('should get least published product', async ({ assert }) => {
    // Create test recommendations in the database
    const recommendations = await Promise.all([
      PinterestBoardRecommendation.create({
        productId: 'product1',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
      PinterestBoardRecommendation.create({
        productId: 'product2',
        boardIds: ['board1', 'board2'],
        updatedAt: DateTime.now(),
      }),
      PinterestBoardRecommendation.create({
        productId: 'product3',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
    ])

    const selector = new PublicationSelector(mockBoards, mockPins, mockShopifyProducts)
    const leastPublished = selector['getLeastPublishedProduct'](recommendations)

    // Product3 should be selected as it has no pins
    assert.equal(leastPublished.productId, 'product3')
  })

  test('should get next available board', async ({ assert }) => {
    // Create test recommendations in the database
    const recommendations = await Promise.all([
      PinterestBoardRecommendation.create({
        productId: 'product1',
        boardIds: ['board1', 'board2', 'board3'],
        updatedAt: DateTime.now(),
      }),
    ])

    const selector = new PublicationSelector(mockBoards, mockPins, mockShopifyProducts)
    const nextBoard = selector['getNextAvailableBoard'](recommendations[0])

    // Should return board3 as product1 is already on board1 and board2
    assert.equal(nextBoard.id, 'board3')
  })

  test('should correctly identify product pins', async ({ assert }) => {
    const selector = new PublicationSelector(mockBoards, mockPins, mockShopifyProducts)
    const productPins = selector['getProductPins']('product1')

    assert.equal(productPins.length, 2)
    assert.equal(productPins[0].id, 'pin1')
    assert.equal(productPins[1].id, 'pin2')
  })

  test('should handle invalid pin URLs', async ({ assert }) => {
    const invalidPins: PinterestPin[] = [
      {
        id: 'invalid1',
        board_id: 'board1',
        link: 'invalid-url',
        alt_text: '',
        is_removable: false,
        creative_type: 'REGULAR',
        board_owner: { username: 'test', full_name: 'Test User', id: '1' },
        pin_metrics: null,
        is_owner: true,
        title: 'Test Pin',
        product_tags: [],
        created_at: new Date().toISOString(),
        media: { type: 'image', url: '', width: 0, height: 0 },
        board_section_id: null,
        description: '',
        dominant_color: '#000000',
        is_standard: true,
        parent_pin_id: null,
        has_been_promoted: false,
        note: '',
      },
    ]

    const selector = new PublicationSelector(mockBoards, invalidPins, mockShopifyProducts)
    const productPins = selector['getProductPins']('product1')

    assert.equal(productPins.length, 0)
  })

  test('should pick random available board', async ({ assert }) => {
    const selector = new PublicationSelector(mockBoards, mockPins, mockShopifyProducts)
    const availableBoards = mockBoards.filter((b) => b.id !== 'board1')
    const randomBoard = selector['pickRandomAvailableBoard'](availableBoards)

    assert.include(['board2', 'board3'], randomBoard.id)
  })
})
