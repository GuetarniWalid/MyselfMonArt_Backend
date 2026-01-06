import type { ProductById } from 'Types/Product'
import type { Metaobject } from 'Types/Metaobject'
import Authentication from '../Authentication'
import ThemeFormatter from './ThemeFormatter'
import ThemeMatcher from './ThemeMatcher'
import Shopify from 'App/Services/Shopify'
import Env from '@ioc:Adonis/Core/Env'
import { zodResponseFormat } from 'openai/helpers/zod'

export default class ThemeDetector extends Authentication {
  private formatter: ThemeFormatter
  private matcher: ThemeMatcher
  // Static cache shared across all instances
  private static themeMetaobjectsCache: Metaobject[] | null = null
  private static cacheTimestamp: number = 0
  private static readonly CACHE_TTL = 3600000 // 1 hour in ms

  constructor() {
    super()
    this.formatter = new ThemeFormatter()
    this.matcher = new ThemeMatcher()
  }

  /**
   * Main entry point: Detect themes from product image and set metafield
   * Only runs on product creation (NOT updates)
   */
  public async detectAndSetThemes(product: ProductById): Promise<void> {
    try {
      console.info(`🏷️  Starting theme detection for product ${product.id}`)

      // 1. Check if themes already set (skip if user already configured them)
      if (this.hasExistingThemes(product)) {
        console.info(`⏭️  Skipping theme detection: Themes already set for product ${product.id}`)
        return
      }

      // 2. Validate image availability
      const imageUrl = this.getSecondImageUrl(product)
      if (!imageUrl) {
        console.warn(`No second image found for product ${product.id}, skipping theme detection`)
        return
      }

      // 3. Fetch available themes (with caching)
      const themeMetaobjects = await this.getAvailableThemes()
      console.info(`Available themes in cache: ${themeMetaobjects.length}`)

      // DEBUG: Log the fields of the first theme metaobject to see actual structure
      if (themeMetaobjects.length > 0) {
        console.info(`🔍 DEBUG: First theme metaobject structure:`)
        console.info(`   ID: ${themeMetaobjects[0].id}`)
        console.info(`   Handle: ${themeMetaobjects[0].handle}`)
        console.info(`   Fields:`)
        themeMetaobjects[0].fields.forEach((field) => {
          console.info(`      - key: "${field.key}", value: ${field.value}`)
        })
      }

      // 4. Call OpenAI Vision API
      const detectedThemes = await this.detectThemesFromImage(imageUrl)
      if (!detectedThemes || detectedThemes.length === 0) {
        console.info(`No themes detected by AI for product ${product.id}`)
        return
      }

      console.info(`AI detected themes: ${detectedThemes.join(', ')}`)

      // 5. Match AI output to metaobject GIDs OR create new metaobjects
      const themeGids = await this.matcher.matchOrCreateThemes(detectedThemes, themeMetaobjects)

      if (themeGids.length === 0) {
        console.warn(`No detected themes matched or created for product ${product.id}`)
        return
      }

      console.info(`Matched/created ${themeGids.length} themes`)

      // 6. Set metafield
      await this.setThemeMetafield(product.id, themeGids)

      // 7. Invalidate cache after setting themes (in case new themes were created)
      ThemeDetector.invalidateCache()

      console.info(`✅ Successfully set ${themeGids.length} themes for product ${product.id}`)
    } catch (error: any) {
      console.error(`Error detecting themes for product ${product.id}:`, error.message)
      // Don't throw - theme detection is optional, shouldn't break product creation
    }
  }

  /**
   * Invalidate the static cache
   * Called after creating new theme metaobjects
   */
  public static invalidateCache(): void {
    ThemeDetector.themeMetaobjectsCache = null
    ThemeDetector.cacheTimestamp = 0
    console.info('Theme cache invalidated')
  }

  /**
   * Check if product already has theme metafield set
   * If themes are already set, we skip detection (user has manually configured them)
   */
  private hasExistingThemes(product: ProductById): boolean {
    const metafields = product.metafields?.edges || []

    const themeMetafield = metafields.find(
      (edge) => edge.node.namespace === 'shopify' && edge.node.key === 'theme'
    )

    // Check if metafield exists and has a non-empty value
    if (!themeMetafield) {
      return false
    }

    // Consider it "set" if the metafield node exists
    // Conservative approach - if user touched it, we respect it
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

    // Type guard - check if it has image property
    if (secondMedia.mediaContentType?.toUpperCase() !== 'IMAGE' || !secondMedia.image) {
      return null
    }

    return secondMedia.image?.url || null
  }

  /**
   * Fetch theme metaobjects with 1-hour caching
   * Cache prevents repeated API calls during batch product creation
   * Static cache shared across all instances
   */
  private async getAvailableThemes(): Promise<Metaobject[]> {
    const now = Date.now()

    if (
      ThemeDetector.themeMetaobjectsCache &&
      now - ThemeDetector.cacheTimestamp < ThemeDetector.CACHE_TTL
    ) {
      console.info('Using cached theme metaobjects')
      return ThemeDetector.themeMetaobjectsCache
    }

    console.info('Fetching theme metaobjects from Shopify')
    const shopify = new Shopify()
    const metaobjects = await shopify.metaobject.getAll('shopify--theme')

    ThemeDetector.themeMetaobjectsCache = metaobjects
    ThemeDetector.cacheTimestamp = now

    return metaobjects
  }

  /**
   * Call OpenAI Vision API to detect themes from image
   * Returns array of theme names (max 4)
   */
  private async detectThemesFromImage(imageUrl: string): Promise<string[]> {
    const { responseFormat, systemPrompt, userPrompt } = this.formatter.prepareRequest()

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
        response_format: zodResponseFormat(responseFormat, 'theme_detection'),
      })

      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT response was truncated')
      }

      if (response.message.refusal) {
        throw new Error(`ChatGPT refused: ${response.message.refusal}`)
      }

      if (!response.message.parsed) {
        throw new Error('ChatGPT did not return valid theme data')
      }

      return response.message.parsed.themes
    } catch (error: any) {
      console.error('OpenAI Vision API error:', error.message)
      throw new Error(`Failed to detect themes: ${error.message}`)
    }
  }

  /**
   * Set theme metafield with list of metaobject GIDs
   */
  private async setThemeMetafield(productId: string, gids: string[]): Promise<void> {
    const shopify = new Shopify()
    await shopify.metafield.update(productId, 'shopify', 'theme', JSON.stringify(gids))
  }
}
