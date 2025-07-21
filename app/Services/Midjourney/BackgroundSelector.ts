import type { Background } from 'Types/Midjourney'
import type { Collection } from 'Types/Collection'
import { backgrounds } from './backgroundsData'
import OpenAI from 'App/Services/ChatGPT/Midjourney'

export default class BackgroundSelector {
  private backgrounds = backgrounds

  public async getBackgrounds(
    mainImageUrl: string,
    parentCollection: Collection
  ): Promise<Background[]> {
    const openAI = new OpenAI()
    const selectedBackgroundPaths = await openAI.suggestRelevantBackgrounds(
      this.backgrounds,
      mainImageUrl,
      parentCollection
    )

    const backgrounds = this.backgrounds.filter((background) =>
      selectedBackgroundPaths.includes(background.path)
    )

    if (!backgrounds.length) {
      throw new Error(`No backgrounds found for the given image and description`)
    }

    return backgrounds
  }
}
