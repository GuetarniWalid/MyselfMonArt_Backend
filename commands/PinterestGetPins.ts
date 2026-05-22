import { BaseCommand } from '@adonisjs/core/build/standalone'
import Pinterest from 'App/Services/Pinterest'

export default class PinterestGetPins extends BaseCommand {
  public static commandName = 'pinterest:get_pins'
  public static description = 'Get all pins from Pinterest'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const pinterest = new Pinterest([])
    await pinterest.initialize()
    const pins = await pinterest.fetcher.getAllPins()
    console.log(`Found ${pins.length} pins`)
    const latestPins = [...pins]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
    console.log('Latest 10 pins (most recent first):')
    console.dir(latestPins, { depth: null })
  }
}
