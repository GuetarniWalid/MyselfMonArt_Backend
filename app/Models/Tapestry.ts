import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Tapestry extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column({
    prepare: (value: number | string) => {
      const num = typeof value === 'string' ? Number(value) : value
      return isNaN(num) ? 0 : Number(num.toFixed(1))
    },
  })
  public price: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
