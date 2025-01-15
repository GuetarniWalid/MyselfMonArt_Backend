import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { Ratio } from 'Types/Product'

export default class Variants extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: Ratio

  @column()
  public json: PaintingJson

  public static async findVariantsByRatio(name: Ratio): Promise<any> {
    const variant = await this.query().where('name', name).firstOrFail()
    return variant.json
  }
}
