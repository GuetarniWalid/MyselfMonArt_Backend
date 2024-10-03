import { DateTime } from 'luxon'
import { column, BaseModel, hasOne, HasOne } from '@ioc:Adonis/Lucid/Orm'
import Token from 'App/Models/Token'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public email: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasOne(() => Token)
  public token: HasOne<typeof Token>
}
