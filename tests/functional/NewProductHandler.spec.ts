import { test } from '@japa/runner'
import NewProductHandler from 'App/Services/Pinterest/NewProductHandler'
import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import type { Product as ShopifyProduct } from 'Types/Product'
import type { Board } from 'Types/Pinterest'
import Database from '@ioc:Adonis/Lucid/Database'

// Mock Pinterest class
class MockPinterest {
  public boardAI = {
    suggestRelevantBoards: async (_product: ShopifyProduct, _boardNames: string[]) => {
      return ['Board 1', 'Board 2']
    },
  }
}

test.group('NewProductHandler', (group) => {
  let origPinterest: any

  group.setup(() => {
    origPinterest = require('App/Services/ChatGPT/Pinterest').default
    require('App/Services/ChatGPT/Pinterest').default = MockPinterest
  })

  group.teardown(() => {
    require('App/Services/ChatGPT/Pinterest').default = origPinterest
  })

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
  ]

  const mockProducts: ShopifyProduct[] = [
    {
      id: 'product1',
      title: 'Product 1',
      description: 'desc',
      handle: 'handle1',
      media: { nodes: [] },
      metafields: { edges: [] },
      options: [],
      seo: { title: '', description: '' },
      tags: [],
      templateSuffix: '',
      vendor: 'Vendor',
      onlineStoreUrl: 'https://test.com/product1',
      productType: '',
      translations: [],
    },
    {
      id: 'product2',
      title: 'Product 2',
      description: 'desc',
      handle: 'handle2',
      media: { nodes: [] },
      metafields: { edges: [] },
      options: [],
      seo: { title: '', description: '' },
      tags: [],
      templateSuffix: '',
      vendor: 'Vendor',
      onlineStoreUrl: 'https://test.com/product2',
      productType: '',
      translations: [],
    },
  ]

  test('should process unstored products and create recommendations', async ({ assert }) => {
    // No recommendations exist yet
    const handler = new NewProductHandler(mockProducts, [], mockBoards)
    await handler.processNewProducts()
    const recommendations = await PinterestBoardRecommendation.all()
    assert.lengthOf(recommendations, 2)
    assert.sameMembers(recommendations[0].boardIds, ['board1', 'board2'])
    assert.sameMembers(recommendations[1].boardIds, ['board1', 'board2'])
  })

  test('should do nothing if all products already have recommendations', async ({ assert }) => {
    await Promise.all([
      PinterestBoardRecommendation.create({ productId: 'product1', boardIds: ['board1'] }),
      PinterestBoardRecommendation.create({ productId: 'product2', boardIds: ['board2'] }),
    ])
    const recommendations = await PinterestBoardRecommendation.all()
    const handler = new NewProductHandler(mockProducts, recommendations, mockBoards)
    await handler.processNewProducts()
    const recs = await PinterestBoardRecommendation.all()
    assert.lengthOf(recs, 2)
  })

  test('should handle suggestRelevantBoards returning empty', async ({ assert }) => {
    class EmptyPinterest {
      public boardAI = {
        suggestRelevantBoards: async () => [],
      }
    }
    const handler = new NewProductHandler(mockProducts, [], mockBoards)
    require('App/Services/ChatGPT/Pinterest').default = EmptyPinterest

    await handler.processNewProducts()
    const recommendations = await PinterestBoardRecommendation.all()
    assert.lengthOf(recommendations, 2)
    assert.deepEqual(recommendations[0].boardIds, [])
    assert.deepEqual(recommendations[1].boardIds, [])
  })

  test('should map only existing board names to IDs', async ({ assert }) => {
    class PartialPinterest {
      public boardAI = {
        suggestRelevantBoards: async () => ['Board 1', 'Nonexistent Board'],
      }
    }
    const handler = new NewProductHandler(mockProducts, [], mockBoards)
    require('App/Services/ChatGPT/Pinterest').default = PartialPinterest

    await handler.processNewProducts()
    const recommendations = await PinterestBoardRecommendation.all()
    assert.sameMembers(recommendations[0].boardIds, ['board1'])
  })

  test('should handle errors from suggestRelevantBoards gracefully', async ({ assert }) => {
    class ErrorPinterest {
      public boardAI = {
        suggestRelevantBoards: async () => {
          throw new Error('AI error')
        },
      }
    }
    const handler = new NewProductHandler(mockProducts, [], mockBoards)
    require('App/Services/ChatGPT/Pinterest').default = ErrorPinterest

    try {
      await handler.processNewProducts()
      assert.fail('Should have thrown')
    } catch (e) {
      assert.match((e as Error).message, /AI error/)
    }
  })
})
