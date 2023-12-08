import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Thickness from 'App/Models/Thickness'
import Border from 'App/Models/Border'
import Fixation from 'App/Models/Fixation'
import Frame from 'App/Models/Frame'

export default class Size extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public name: String

  @column()
  public sizeId: Number

  @hasMany(() => Thickness)
  public thicknesses: HasMany<typeof Thickness>

  @hasMany(() => Border)
  public borders: HasMany<typeof Border>

  @hasMany(() => Fixation)
  public fixations: HasMany<typeof Fixation>

  @hasMany(() => Frame)
  public frames: HasMany<typeof Frame>
}
