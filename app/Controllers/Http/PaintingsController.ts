// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Variant from 'App/Models/Variants'

export default class PaintingsController {
  public async index() {
    const variants = await Variant.first()
    console.log('🚀 ~ variants:', variants)
    return variants
  }

  public async store({ request }) {
    const variants = request.input('variants')
    console.log('🚀 ~ variants:', variants)

    await Variant.truncate()

    const variant = new Variant()
    variant.json = variants
    await variant.save()

    return {
      message: 'success',
    }
  }
}
