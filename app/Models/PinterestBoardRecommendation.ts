import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class PinterestBoardRecommendation extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public productId: string

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
  })
  public boardIds: string[]

  @column.dateTime({ autoCreate: false, autoUpdate: true })
  public updatedAt: DateTime
}
