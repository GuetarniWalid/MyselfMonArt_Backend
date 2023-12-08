import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Size from 'App/Models/Size'

export default class Material extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: String

  @column()
  public sizeId: Number

  @hasMany(() => Size)
  public sizes: HasMany<typeof Size>
}
