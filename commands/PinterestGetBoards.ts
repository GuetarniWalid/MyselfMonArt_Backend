import { BaseCommand } from '@adonisjs/core/build/standalone'
import Pinterest from 'App/Services/Pinterest'

export default class PinterestGetBoards extends BaseCommand {
  public static commandName = 'pinterest:get_boards'
  public static description = 'Get all public boards from Pinterest'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const pinterest = new Pinterest([])
    await pinterest.initialize()
    const boards = await pinterest.fetcher.getAllPublicBoards()
    console.dir(boards, { depth: null })
  }
}
