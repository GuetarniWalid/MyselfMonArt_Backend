import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Frame extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: String
}
