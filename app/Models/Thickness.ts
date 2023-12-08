import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Thickness extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: String
}
