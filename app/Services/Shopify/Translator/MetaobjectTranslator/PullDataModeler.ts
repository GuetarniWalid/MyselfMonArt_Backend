import type { MetaobjectToTranslate } from 'Types/Metaobject'
import type { LanguageCode, MetaobjectTranslation, RegionCode } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'
import Utils from '../Utils'

type MetaobjectQueryDef = {
  type: string
  fieldKey: string
}

const METAOBJECT_TYPES: MetaobjectQueryDef[] = [
  { type: 'painting_option', fieldKey: 'name' },
  { type: 'radio_container', fieldKey: 'title' },
  { type: 'popup', fieldKey: 'title' },
  { type: 'popup', fieldKey: 'description' },
  { type: 'custom_media', fieldKey: 'alt' },
  { type: 'shopify--color-pattern', fieldKey: 'label' },
  { type: 'shopify--theme', fieldKey: 'label' },
  { type: 'shopify--art-movement', fieldKey: 'label' },
  { type: 'format', fieldKey: 'etiquette' },
]

export default class PullDataModeler extends DefaultPullDataModeler {
  private utils: Utils

  constructor() {
    super()
    this.utils = new Utils()
  }

  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en', region?: RegionCode) {
    const allMetaobjects: MetaobjectToTranslate[] = []

    for (const def of METAOBJECT_TYPES) {
      const { query, variables } = this.getMetaobjectsByTypeQuery(def.type, def.fieldKey)
      const data = await this.fetchGraphQL(query, variables)
      const metaobjects = (data.metaobjects.edges as { node: MetaobjectToTranslate }[]).map(
        (e) => e.node
      )
      allMetaobjects.push(...metaobjects)
    }

    // Filter out metaobjects that already have an up-to-date translation for this locale/region.
    // We do per-metaobject lookups in parallel chunks to avoid hammering Shopify.
    const outdated: MetaobjectToTranslate[] = []
    const chunkSize = 10
    for (let i = 0; i < allMetaobjects.length; i += chunkSize) {
      const chunk = allMetaobjects.slice(i, i + chunkSize)
      const results = await Promise.all(
        chunk.map(async (metaobject) => {
          const isOutdated = await this.isFieldOutdatedForLocale(
            metaobject.id,
            metaobject.field.key,
            locale,
            region
          )
          return isOutdated ? metaobject : null
        })
      )
      for (const m of results) {
        if (m) outdated.push(m)
      }
    }

    return outdated
  }

  /**
   * Returns true when no translation exists yet for the given (resourceId, fieldKey, locale, region)
   * or when the existing translation is marked outdated by Shopify (meaning the source content moved).
   * Returns false when an up-to-date translation already exists — we should skip it.
   */
  private async isFieldOutdatedForLocale(
    resourceId: string,
    fieldKey: string,
    locale: LanguageCode,
    region?: RegionCode
  ): Promise<boolean> {
    const marketId = region ? this.utils.getMarketId(region) : undefined
    const { query, variables } = this.getResourceTranslationsQuery(resourceId, locale, marketId)
    const data = (await this.fetchGraphQL(query, variables)) as MetaobjectTranslation
    const translation = data.translatableResource.translations.find((t) => t.key === fieldKey)
    if (!translation) return true
    return !!translation.outdated
  }

  private getMetaobjectsByTypeQuery(type: string, fieldKey: string) {
    return {
      query: `query AllMetaobjects {
                metaobjects(first: 250, type: "${type}") {
                  edges {
                    node {
                      id
                      displayName
                      type
                      field(key: "${fieldKey}") {
                        key
                        type
                        jsonValue
                      }
                    }
                  }
                }
              }`,
      variables: {},
    }
  }

  private getResourceTranslationsQuery(
    resourceId: string,
    locale: LanguageCode,
    marketId?: string
  ) {
    return {
      query: `query GetMetaobjectTranslations($id: ID!) {
        translatableResource(resourceId: $id) {
          translations(locale: "${locale}"${marketId ? `, marketId: "${marketId}"` : ''}) {
            key
            locale
            value
            outdated
            updatedAt
          }
        }
      }`,
      variables: { id: resourceId },
    }
  }
}
