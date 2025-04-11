import type { LanguageCode } from 'Types/Translation'
import type {
  FileDataQueryResponse,
  ThemeWithFiles,
  ThemeToTranslate,
  TranslatableContent,
  Translation,
} from 'Types/Theme'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en') {
    const { fileNames, themeId, id } = await this.getModelsFileNames()

    const translatableContent = [] as ThemeToTranslate[]

    for (const fileName of fileNames) {
      const fileData = await this.getTranslatableFileData(id, fileName, locale)
      if (!fileData) continue
      fileData.translatableContent.forEach((content) => {
        const { isTranslationExists, translation } = this.isTranslationExists(
          content,
          fileData.translations
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
      })
    }

    return translatableContent
  }

  private async getModelsFileNames() {
    let allFiles: string[] = []
    let hasNextPage = true
    let cursor: any
    let themeId: string = ''
    let id: string = ''

    while (hasNextPage) {
      const { query, variables } = this.getModelsFileNamesQuery()
      variables.cursor = cursor

      const themesData = (await this.fetchGraphQL(query, variables)) as {
        themes: {
          nodes: ThemeWithFiles[]
        }
      }
      const theme = themesData.themes.nodes[0]
      themeId = theme.id
      id = this.getIdFromThemeId(theme.id)
      const filesConnection = theme.files

      // Add the current page of files to our collection
      allFiles.push(...filesConnection.edges.map((edge: any) => edge.node.filename))

      // Update pagination variables
      hasNextPage = filesConnection.pageInfo.hasNextPage
      cursor = filesConnection.pageInfo.endCursor
    }

    const fileNames = allFiles.map((fileName) => {
      const nameWithoutPath = fileName.split('/').at(-1)
      return nameWithoutPath?.replace('.json', '') as string
    })

    return { fileNames, themeId, id }
  }

  private getModelsFileNamesQuery() {
    return {
      query: `query GetThemeFiles($cursor: String) {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            files(
              first: 250
              after: $cursor
              filenames: ["templates/*.json"]
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                cursor
                node {
                  filename
                }
              }
            }
          }
        }
      }`,
      variables: {
        cursor: null,
      },
    }
  }

  private getIdFromThemeId(themeId: string) {
    return themeId.split('/').at(-1) as string
  }

  private async getTranslatableFileData(
    themeId: string,
    fileName: string,
    locale: LanguageCode = 'en'
  ) {
    const { query, variables } = this.getFileDataQuery(themeId, fileName, locale)
    const response = (await this.fetchGraphQL(query, variables)) as FileDataQueryResponse
    const fileDataWithEmptyTranslatableContent = response.translatableResourcesByIds.edges.map(
      (edge) => edge.node
    )
    const fileDataWithTranslatableContent = fileDataWithEmptyTranslatableContent.filter(
      (fileData) => fileData.translatableContent.length > 0
    )
    return fileDataWithTranslatableContent[0]
  }

  private getFileDataQuery(themeId: string, fileName: string, locale: LanguageCode = 'en') {
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
        resourceIds: [`gid://shopify/OnlineStoreThemeJsonTemplate/${fileName}?theme_id=${themeId}`],
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
    return content.value.startsWith('shopify://')
  }
}
