import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Variant from 'App/Models/Variants'

export default class PaintingsController {
  public async index({ request }: HttpContextContract) {
    const aspectRatio = request.param('aspectRatio')
    const variants = await Variant.query().where('name', aspectRatio).first()
    return variants
  }

  public async store({ request }) {
    const variants = request.input('variants')
    const aspectRatio = request.input('aspectRatio')

    await Variant.updateOrCreate({ name: aspectRatio }, { json: variants })

    return {
      message: 'success',
    }
  }
}
