import type { Background } from 'Types/ShopifyProductPublisher'
import { backgrounds } from './backgroundsData'
import ProductPublisher from 'App/Services/ChatGPT/ProductPublisher'

export default class BackgroundSelector {
  private backgrounds = backgrounds

  public async getBackgrounds(
    mainImageUrl: string,
    descriptionHtml: string
  ): Promise<Background[]> {
    const productPublisher = new ProductPublisher()
    const selectedBackgroundPaths = await productPublisher.suggestRelevantBackgrounds(
      this.backgrounds,
      mainImageUrl,
      descriptionHtml
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
