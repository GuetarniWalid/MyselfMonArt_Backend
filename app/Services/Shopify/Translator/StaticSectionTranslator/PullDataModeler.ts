import type { LanguageCode } from 'Types/Translation'
import type { StaticSectionResponse, StaticSectionToTranslate } from 'Types/StaticSection'
import type { TranslatableContent, Translation } from 'Types/Theme'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
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

      if ((!isTranslationExists || isTranslationOutdated) && !isTranslationMedia) {
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
    const isShopifyMedia = content.value.startsWith('shopify://')
    const isSVG = content.value.startsWith('<svg') || content.value.endsWith('</svg>')
    return isShopifyMedia || isSVG
  }
}
