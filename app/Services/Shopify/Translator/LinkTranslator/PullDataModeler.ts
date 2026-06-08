import type { LanguageCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import DefaultPullDataModeler from '../PullDataModeler'

type LinkNode = {
  resourceId: string
  translatableContent: {
    key: string
    value: string | null
    digest: string | null
    locale: string
  }[]
  translations: { key: string; value: string | null; outdated: boolean }[]
}

/**
 * Menu link titles. In Shopify, every menu item (in any linklist — footer, mega-menu, …)
 * is a translatable resource of type LINK whose only translatable field is `title`. Before
 * this translator there was NO menu coverage at all, so custom menu link titles stayed in
 * French on every other language (the 2026-06-08 audit: footer "Conditions générales de
 * vente", "Mentions légales", … on /es). Link URLs are localized natively by Shopify (they
 * resolve to the translated page handle); only the visible title needs us.
 */
export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations(
    locale: LanguageCode = 'en'
  ): Promise<StaticSectionToTranslate[]> {
    const toTranslate: StaticSectionToTranslate[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getLinksQuery(cursor, locale)
      const data = (await this.fetchGraphQL(query, variables)) as {
        translatableResources: {
          edges: { cursor: string; node: LinkNode }[]
          pageInfo: { hasNextPage: boolean }
        }
      }

      const edges = data.translatableResources.edges
      for (const { node } of edges) {
        const source = node.translatableContent.find((content) => content.key === 'title')?.value
        if (!source || source.trim() === '') continue

        const existing = node.translations.find((translation) => translation.key === 'title')
        const needsTranslation = !existing || existing.outdated === true
        if (needsTranslation) {
          toTranslate.push({ id: node.resourceId, key: 'title', value: source })
        }
      }

      hasNextPage = data.translatableResources.pageInfo.hasNextPage
      cursor = edges.length ? edges[edges.length - 1].cursor : null
      if (!cursor) break
    }

    return toTranslate
  }

  private getLinksQuery(cursor: string | null, locale: LanguageCode) {
    return {
      query: `query Links($cursor: String) {
        translatableResources(first: 250, after: $cursor, resourceType: LINK) {
          edges {
            cursor
            node {
              resourceId
              translatableContent { key value digest locale }
              translations(locale: "${locale}") { key value outdated }
            }
          }
          pageInfo { hasNextPage }
        }
      }`,
      variables: { cursor },
    }
  }
}
