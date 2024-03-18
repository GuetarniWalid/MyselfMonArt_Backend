import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Variants extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: 'square' | 'portrait' | 'landscape'

  @column()
  public json: string

  public static async findVariantsByRatio(name: 'square' | 'portrait' | 'landscape'): Promise<any> {
    const variant = await this.query().where('name', name).firstOrFail()
    return variant.json
  }
}
