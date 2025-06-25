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
    const pinsWithBouddha = pins.filter(
      (pin) =>
        pin.title.toLowerCase().includes('bouddha') ||
        pin.description.toLowerCase().includes('bouddha')
    )
    console.log(`Found ${pinsWithBouddha.length} pins with bouddha in the title`)
    console.dir(pinsWithBouddha, { depth: null })
  }
}
