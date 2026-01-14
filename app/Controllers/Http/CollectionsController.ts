import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import CollectionsGetByTypeValidator from 'App/Validators/CollectionsGetByTypeValidator'
import Shopify from 'App/Services/Shopify'

export default class CollectionsController {
  public async getByType({ request, response }: HttpContextContract) {
    try {
      const { type } = await request.validate(CollectionsGetByTypeValidator)

      const shopify = new Shopify()
      const allCollections = await shopify.collection.getAll()

      // Filter collections by custom.type_of_collection metafield
      const filteredCollections = allCollections.filter((collection) => {
        if (!collection.metafields?.edges) return false
        return collection.metafields.edges.some((edge) => {
          const node = edge.node as any
          return (
            node.namespace === 'custom' && node.key === 'type_of_collection' && node.value === type
          )
        })
      })

      // Map to response format: { id, title }
      const collectionsData = filteredCollections.map((collection) => ({
        id: collection.id,
        title: collection.title,
      }))

      return response.status(200).json({
        success: true,
        data: collectionsData,
      })
    } catch (error) {
      console.error('Collections fetch error:', error)

      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    }
  }
}
