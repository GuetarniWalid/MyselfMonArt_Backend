import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ResizeArtworkRequestValidator from 'App/Validators/ResizeArtworkRequestValidator'
import ArtworkResizer from 'App/Services/ArtworkResizer'

export default class ResizeArtworkController {
  public async resize({ request, response }: HttpContextContract) {
    try {
      const { image, target, quality } = await request.validate(ResizeArtworkRequestValidator)
      const resizer = new ArtworkResizer()
      const resized = await resizer.resize(image, target, quality || 'low')
      return { success: true, data: { image: resized } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      console.error('Resize artwork error:', error.message, error.status || '')
      return response.status(500).json({
        success: false,
        message: 'Échec du redimensionnement',
        error: error.message || 'An unexpected error occurred',
      })
    }
  }
}
