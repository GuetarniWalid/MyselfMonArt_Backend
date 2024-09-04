import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Tapestry from 'App/Models/Tapestry'

export default class extends BaseSeeder {
  public async run() {
    try {
      await Tapestry.firstOrFail()
      return
    } catch (error) {
      await Tapestry.create({ price: 20 })
    }
  }
}
