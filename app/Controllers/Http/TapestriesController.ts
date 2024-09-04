import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Tapestry from 'App/Models/Tapestry'

export default class TapestriesController {
  public async index() {
    const tapestry = await Tapestry.first()
    return tapestry
  }

  public async update({ request }: HttpContextContract) {
    const { price } = request.body()
    const tapestry = await Tapestry.first()
    tapestry!.price = price
    await tapestry!.save()
  }
}
