import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Variants extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public json: string
}
