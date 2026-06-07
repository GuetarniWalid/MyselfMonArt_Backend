import type { LanguageCode, RegionCode } from 'Types/Translation'
import type { StaticSectionResponse, StaticSectionToTranslate } from 'Types/StaticSection'
import type { TranslatableContent, Translation } from 'Types/Theme'
import DefaultPullDataModeler from '../PullDataModeler'
import Utils from '../Utils'

export default class PullDataModeler extends DefaultPullDataModeler {
  private utils: Utils

  constructor() {
    super()
    this.utils = new Utils()
  }

  /**
   * Theme LOCALE CONTENT = the theme's `t:` translation strings (locales/*.json),
   * a single translatable resource (`OnlineStoreThemeLocaleContent`). We translate only
   * the theme's OWN custom keys (sections.*, snippet.*, general.*, etc.) and deliberately
   * SKIP the `shopify.*` and `customer_accounts.*` system namespaces — Shopify ships
   * official translations for those, so re-translating them with ChatGPT would be worse.
   * Returns items needing a translation (missing or outdated) for the given locale/region.
   */
  public async getLocaleContentOutdatedTranslations(
    locale: LanguageCode = 'en',
    region?: RegionCode
  ): Promise<StaticSectionToTranslate[]> {
    const themeId = await this.getMainThemeId()
    const id = this.getIdFromThemeId(themeId)
    const resourceId = `gid://shopify/OnlineStoreThemeLocaleContent/${id}`
    const marketId = region ? this.utils.getMarketId(region) : undefined

    const { query, variables } = this.getLocaleContentQuery(resourceId, locale, marketId)
    const data = (await this.fetchGraphQL(query, variables)) as StaticSectionResponse
    const node = data.translatableResourcesByIds.edges.map((edge) => edge.node)[0]
    if (!node) return []

    const toTranslate: StaticSectionToTranslate[] = []
    for (const content of node.translatableContent) {
      if (this.isShopifyManagedKey(content.key)) continue
      if (this.isTranslationMedia(content)) continue
      const hasNonEmptySource = typeof content.value === 'string' && content.value.trim() !== ''
      if (!hasNonEmptySource) continue

      const { isTranslationExists, translation } = this.isTranslationExists(
        content,
        node.translations,
        locale
      )
      const isOutdated = this.isTranslationOutdated(isTranslationExists, translation)
      if (!isTranslationExists || isOutdated) {
        toTranslate.push({ id: resourceId, key: content.key, value: content.value })
      }
    }

    return toTranslate
  }

  /** `shopify.*` and `customer_accounts.*` are Shopify-managed; never translate them here. */
  private isShopifyManagedKey(key: string): boolean {
    const top = key.split(':')[0]
    return top.startsWith('shopify.') || top.startsWith('customer_accounts.')
  }

  private getLocaleContentQuery(resourceId: string, locale: LanguageCode, marketId?: string) {
    return {
      query: `query GetThemeLocaleContent($ids: [ID!]!) {
        translatableResourcesByIds(first: 1, resourceIds: $ids) {
          edges {
            node {
              resourceId
              translatableContent { key value locale }
              translations(locale: "${locale}"${marketId ? `, marketId: "${marketId}"` : ''}) {
                key
                value
                locale
                outdated
              }
            }
          }
        }
      }`,
      variables: { ids: [resourceId] },
    }
  }

  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en') {
    const translatableContent = [] as StaticSectionToTranslate[]
    const themeId = await this.getMainThemeId()
    const id = this.getIdFromThemeId(themeId)
    const staticSectionContent = await this.getStaticSectionsContent(id, locale)

    for (const content of staticSectionContent.translatableContent) {
      const { isTranslationExists, translation } = this.isTranslationExists(
        content,
        staticSectionContent.translations
      )
      const isTranslationOutdated = this.isTranslationOutdated(isTranslationExists, translation)
      const isTranslationMedia = this.isTranslationMedia(content)
      const hasNonEmptySource = typeof content.value === 'string' && content.value.trim() !== ''

      if (
        (!isTranslationExists || isTranslationOutdated) &&
        !isTranslationMedia &&
        hasNonEmptySource
      ) {
        translatableContent.push({
          id: themeId,
          key: content.key,
          value: content.value,
        })
      }
    }

    return translatableContent
  }

  private async getMainThemeId() {
    const { query, variables } = this.getMainThemeQuery()
    const response = (await this.fetchGraphQL(query, variables)) as {
      themes: {
        nodes: { id: string }[]
      }
    }
    return response.themes.nodes[0].id
  }

  private getMainThemeQuery() {
    return {
      query: `query {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
          }
        }
      }`,
      variables: {},
    }
  }

  private getIdFromThemeId(themeId: string) {
    return themeId.split('/').at(-1) as string
  }

  private async getStaticSectionsContent(id: string, locale: LanguageCode) {
    const { query, variables } = this.getStaticSectionsDataQuery(id, locale)
    const response = (await this.fetchGraphQL(query, variables)) as StaticSectionResponse
    return response.translatableResourcesByIds.edges.map((edge) => edge.node)[0]
  }

  private getStaticSectionsDataQuery(id: string, locale) {
    return {
      query: `query GetTranslatableResourcesByIds($resourceIds: [ID!]!) {
        translatableResourcesByIds(first: 250, resourceIds: $resourceIds) {
          edges {
            cursor
            node {
              resourceId
              translatableContent {
                key
                value
                locale
              }
              translations(locale: "${locale}") {
                key
                value
                locale
                outdated
              }
            }
          }
        }
      }`,
      variables: {
        resourceIds: [`gid://shopify/OnlineStoreThemeSettingsDataSections/${id}`],
      },
    }
  }

  private isTranslationExists(
    content: TranslatableContent,
    translations: Translation[],
    locale: LanguageCode = 'en'
  ) {
    const translation = translations.find((translation) => {
      return translation.key === content.key && translation.locale === locale
    })
    return { isTranslationExists: !!translation, translation }
  }

  private isTranslationOutdated(
    isTranslationExists: boolean,
    translation: Translation | undefined
  ) {
    return isTranslationExists && !!translation?.outdated
  }

  private isTranslationMedia(content: TranslatableContent) {
    return PullDataModeler.isMediaValue(content.value)
  }

  /**
   * A section-setting value is "media" when it points at a Shopify file or carries
   * raw SVG markup. Such values are graphics, not translatable copy, and must never
   * receive a per-locale override (they would drift away from the source artwork).
   * Detection is intentionally lenient: SVGs may be prefixed with an XML declaration,
   * an XML comment, or leading whitespace.
   */
  public static isMediaValue(value: string): boolean {
    if (typeof value !== 'string') return false
    const v = value.trim().toLowerCase()
    if (v.startsWith('shopify://')) return true
    return (
      v.startsWith('<svg') || v.startsWith('<?xml') || v.startsWith('<!--') || v.includes('<svg')
    )
  }

  /**
   * Only raw inline SVG icons are eligible for override removal. We deliberately
   * EXCLUDE shopify:// file references (a localised image, e.g. a banner with baked-in
   * text, can be an intentional per-locale choice) and any SVG that embeds <text>
   * (which may legitimately need translating). Pure path/shape icons — our badges —
   * are graphics that must be identical in every locale.
   */
  public static isRemovableIconSvg(value: string): boolean {
    if (typeof value !== 'string') return false
    const v = value.trim().toLowerCase()
    if (v.startsWith('shopify://')) return false
    const looksSvg =
      v.startsWith('<svg') || v.startsWith('<?xml') || v.startsWith('<!--') || v.includes('<svg')
    if (!looksSvg || !v.includes('<svg')) return false
    if (/<text[\s>]/i.test(value)) return false
    return true
  }

  /**
   * Scans every theme translatable resource that can hold section-setting media
   * (JSON templates + settings_data sections) and returns the inline-SVG icon settings
   * that still carry a per-locale override for `locale`. Those overrides are stale
   * copies of the source artwork and should be removed so the storefront inherits the
   * source icon. shopify:// images and text-bearing SVGs are intentionally left alone.
   */
  public async getStaleMediaOverrides(
    locale: LanguageCode
  ): Promise<{ resourceId: string; key: string }[]> {
    const resourceTypes = [
      'ONLINE_STORE_THEME_JSON_TEMPLATE',
      'ONLINE_STORE_THEME_SETTINGS_DATA_SECTIONS',
    ]
    const toRemove: { resourceId: string; key: string }[] = []

    for (const resourceType of resourceTypes) {
      let cursor: string | null = null
      let hasNextPage = true

      while (hasNextPage) {
        const { query, variables } = this.getMediaOverridesQuery(resourceType, locale, cursor)
        const data = (await this.fetchGraphQL(query, variables)) as {
          translatableResources: {
            edges: {
              cursor: string
              node: {
                resourceId: string
                translatableContent: { key: string; value: string }[]
                translations: { key: string; value: string; outdated: boolean }[]
              }
            }[]
            pageInfo: { hasNextPage: boolean }
          }
        }

        const edges = data.translatableResources.edges
        for (const { node } of edges) {
          const overriddenKeys = new Set(node.translations.map((t) => t.key))
          for (const content of node.translatableContent) {
            if (!overriddenKeys.has(content.key)) continue
            if (!PullDataModeler.isRemovableIconSvg(content.value)) continue
            toRemove.push({ resourceId: node.resourceId, key: content.key })
          }
        }

        hasNextPage = data.translatableResources.pageInfo.hasNextPage
        cursor = edges.length ? edges[edges.length - 1].cursor : null
        if (!cursor) hasNextPage = false
      }
    }

    return toRemove
  }

  private getMediaOverridesQuery(
    resourceType: string,
    locale: LanguageCode,
    cursor: string | null
  ) {
    return {
      query: `query StaleMediaOverrides($resourceType: TranslatableResourceType!, $cursor: String) {
        translatableResources(first: 50, resourceType: $resourceType, after: $cursor) {
          edges {
            cursor
            node {
              resourceId
              translatableContent { key value }
              translations(locale: "${locale}") { key value outdated }
            }
          }
          pageInfo { hasNextPage }
        }
      }`,
      variables: { resourceType, cursor },
    }
  }
}
