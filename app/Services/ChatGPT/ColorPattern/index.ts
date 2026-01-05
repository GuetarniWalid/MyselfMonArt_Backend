import type { ProductById } from 'Types/Product'
import type { Metaobject } from 'Types/Metaobject'
import Authentication from '../Authentication'
import ColorPatternFormatter from './ColorPatternFormatter'
import ColorMatcher from './ColorMatcher'
import Shopify from 'App/Services/Shopify'
import Env from '@ioc:Adonis/Core/Env'
import { zodResponseFormat } from 'openai/helpers/zod'

export default class ColorPatternDetector extends Authentication {
  private formatter: ColorPatternFormatter
  private matcher: ColorMatcher
  // Static cache shared across all instances (fixes cache bug)
  private static colorMetaobjectsCache: Metaobject[] | null = null
  private static cacheTimestamp: number = 0
  private static readonly CACHE_TTL = 3600000 // 1 hour in ms

  constructor() {
    super()
    this.formatter = new ColorPatternFormatter()
    this.matcher = new ColorMatcher()
  }

  /**
   * Main entry point: Detect colors from product image and set metafield
   * Only runs on product creation (NOT updates)
   */
  public async detectAndSetColors(product: ProductById): Promise<void> {
    try {
      console.info(`🎨 Starting color detection for product ${product.id}`)

      // 1. Check if colors already set (skip if user already configured them)
      if (this.hasExistingColors(product)) {
        console.info(`⏭️  Skipping color detection: Colors already set for product ${product.id}`)
        return
      }

      // 2. Validate image availability
      const imageUrl = this.getSecondImageUrl(product)
      if (!imageUrl) {
        console.warn(`No second image found for product ${product.id}, skipping color detection`)
        return
      }

      // 2. Fetch available colors (with caching)
      const colorMetaobjects = await this.getAvailableColors()
      if (colorMetaobjects.length === 0) {
        console.error('No color metaobjects found, skipping color detection')
        return
      }

      // 3. Extract color names for AI constraint
      const availableColorNames = this.extractColorNames(colorMetaobjects)
      console.info(`Available colors: ${availableColorNames.join(', ')}`)

      // 4. Call OpenAI Vision API
      const detectedColors = await this.detectColorsFromImage(imageUrl, availableColorNames)
      if (!detectedColors || detectedColors.length === 0) {
        console.info(`No colors detected by AI for product ${product.id}`)
        return
      }

      console.info(`AI detected colors: ${detectedColors.join(', ')}`)

      // 5. Match AI output to metaobject GIDs
      const matchedGids = this.matcher.matchColorsToMetaobjects(detectedColors, colorMetaobjects)

      if (matchedGids.length === 0) {
        console.warn(`No detected colors matched any metaobjects for product ${product.id}`)
        return
      }

      console.info(`Matched ${matchedGids.length} colors to metaobjects`)

      // 6. Set metafield
      await this.setColorMetafield(product.id, matchedGids)

      console.info(`✅ Successfully set ${matchedGids.length} colors for product ${product.id}`)
    } catch (error: any) {
      console.error(`Error detecting colors for product ${product.id}:`, error.message)
      // Don't throw - color detection is optional, shouldn't break product creation
    }
  }

  /**
   * Check if product already has color-pattern metafield set
   * If colors are already set, we skip detection (user has manually configured them)
   */
  private hasExistingColors(product: ProductById): boolean {
    const metafields = product.metafields?.edges || []

    const colorMetafield = metafields.find(
      (edge) => edge.node.namespace === 'shopify' && edge.node.key === 'color-pattern'
    )

    // Check if metafield exists and has a non-empty value
    if (!colorMetafield) {
      return false
    }

    // For list metafields, the reference field would be populated
    // We consider it "set" if the metafield node exists (even if reference is undefined/empty)
    // This is conservative - if the metafield exists at all, we assume user touched it
    return true
  }

  /**
   * Get second image URL from product media (product.media.nodes[1])
   */
  private getSecondImageUrl(product: ProductById): string | null {
    const mediaNodes = product.media?.nodes || []

    if (mediaNodes.length < 2) {
      return null
    }

    const secondMedia = mediaNodes[1]

    // Type guard - check if it has image property (case-insensitive for safety)
    if (secondMedia.mediaContentType?.toUpperCase() !== 'IMAGE' || !secondMedia.image) {
      return null
    }

    return secondMedia.image?.url || null
  }

  /**
   * Fetch color metaobjects with 1-hour caching
   * Cache prevents repeated API calls during batch product creation
   * Static cache shared across all instances
   */
  private async getAvailableColors(): Promise<Metaobject[]> {
    const now = Date.now()

    if (
      ColorPatternDetector.colorMetaobjectsCache &&
      now - ColorPatternDetector.cacheTimestamp < ColorPatternDetector.CACHE_TTL
    ) {
      console.info('Using cached color metaobjects')
      return ColorPatternDetector.colorMetaobjectsCache
    }

    console.info('Fetching color metaobjects from Shopify')
    const shopify = new Shopify()
    const metaobjects = await shopify.metaobject.getAll('shopify--color-pattern')

    ColorPatternDetector.colorMetaobjectsCache = metaobjects
    ColorPatternDetector.cacheTimestamp = now

    return metaobjects
  }

  /**
   * Extract color names from metaobject fields
   * Priority: 'label' field (French name like "Rouge"), fallback to 'name'
   */
  private extractColorNames(metaobjects: Metaobject[]): string[] {
    return metaobjects.map((mo) => {
      const labelField = mo.fields.find((f) => f.key === 'label')
      const nameField = mo.fields.find((f) => f.key === 'name')
      return labelField?.value || nameField?.value || mo.handle
    })
  }

  /**
   * Call OpenAI Vision API to detect colors from image
   * Returns array of color names (max 3)
   */
  private async detectColorsFromImage(
    imageUrl: string,
    availableColors: string[]
  ): Promise<string[]> {
    const { responseFormat, systemPrompt, userPrompt } =
      this.formatter.prepareRequest(availableColors)

    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: zodResponseFormat(responseFormat, 'color_detection'),
      })

      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT response was truncated')
      }

      if (response.message.refusal) {
        throw new Error(`ChatGPT refused: ${response.message.refusal}`)
      }

      if (!response.message.parsed) {
        throw new Error('ChatGPT did not return valid color data')
      }

      return response.message.parsed.colors
    } catch (error: any) {
      console.error('OpenAI Vision API error:', error.message)
      throw new Error(`Failed to detect colors: ${error.message}`)
    }
  }

  /**
   * Set color-pattern metafield with list of metaobject GIDs
   */
  private async setColorMetafield(productId: string, gids: string[]): Promise<void> {
    const shopify = new Shopify()
    await shopify.metafield.update(productId, 'shopify', 'color-pattern', JSON.stringify(gids))
  }
}
