import type { PageWithOutdatedTranslations } from 'Types/Page'
import type { LanguageCode } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations() {
    const pageToTranslate = [] as any[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get pages with outdated translations without metaobject translations
      const { query, variables } = this.getPagesWithOutdatedTranslationsQuery(cursor)
      const pagesData = await this.fetchGraphQL(query, variables)
      const pages = pagesData.pages.edges as {
        node: PageWithOutdatedTranslations
        cursor: string
      }[]

      for (const page of pages) {
        const pageWithOnlyKeyToTranslate = this.getPageWithOnlyKeyToTranslate(page.node)
        if (pageWithOnlyKeyToTranslate) {
          pageToTranslate.push(pageWithOnlyKeyToTranslate)
        }
      }

      hasNextPage = pagesData.pages.pageInfo.hasNextPage
      if (hasNextPage) {
        cursor = pages[pages.length - 1].cursor
      }
    }

    return pageToTranslate
  }

  private getPagesWithOutdatedTranslationsQuery(
    cursor: string | null = null,
    locale: LanguageCode = 'en'
  ) {
    return {
      query: `query AllPages($cursor: String) {
                pages(first: 250, after: $cursor) {
                  edges {
                    node {
                      id
                      title
                      body
                      handle
                      translations(locale: "${locale}") {
                        key
                        locale
                        value
                        outdated
                        updatedAt
                      }                      
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }`,
      variables: { cursor },
    }
  }

  public getPageWithOnlyKeyToTranslate(page: PageWithOutdatedTranslations) {
    const { translations, ...pageWithoutTranslations } = page

    const mutablePage = pageWithoutTranslations as {
      [key: string]: any
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        delete mutablePage[key]
      }
    })

    const cleanedPage = this.cleanResourceEmptyFields({ ...mutablePage })
    return cleanedPage
  }

  private getKeyFromTranslationKey(key: string) {
    switch (key) {
      case 'body_html':
        return 'body'
      default:
        return key
    }
  }
}
