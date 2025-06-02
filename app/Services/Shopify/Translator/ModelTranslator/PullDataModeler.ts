import type { LanguageCode } from 'Types/Translation'
import type { ModelToTranslate } from 'Types/Model'
import type {
  FileDataQueryResponse,
  ThemeWithFiles,
  TranslatableContent,
  Translation,
  MediaAltResponse,
} from 'Types/Theme'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en') {
    const { fileNames, themeId, id } = await this.getModelsFileNames()

    const translatableContent = [] as ModelToTranslate[]

    for (const fileName of fileNames) {
      const fileData = await this.getTranslatableFileData(id, fileName, locale)
      if (!fileData) continue

      for (const content of fileData.translatableContent) {
        const { isTranslationExists, translation } = this.isTranslationExists(
          content,
          fileData.translations
        )
        const isTranslationOutdated = this.isTranslationOutdated(isTranslationExists, translation)

        const isTranslationSvg = this.isTranslationSvg(content)
        if (isTranslationSvg) continue

        const isTranslationMedia = this.isTranslationMedia(content)

        if (!isTranslationExists || isTranslationOutdated) {
          translatableContent.push({
            id: themeId,
            key: content.key,
            value: isTranslationMedia ? undefined : content.value,
            file: isTranslationMedia
              ? {
                  alt: await this.getMediaAlt(content),
                  fileName: this.getMediaName(content),
                  oldUrl: content.value,
                  url: await this.getMediaPath(content),
                }
              : undefined,
          })
        }
      }
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

  private isTranslationSvg(content: TranslatableContent) {
    return content.value.startsWith('<svg') || content.value.endsWith('</svg>')
  }

  private async getMediaPath(content: TranslatableContent) {
    const mediaPathSplitted = content.value.split('/')
    const mediaPathLength = mediaPathSplitted.length
    const mediaPathEnd = mediaPathSplitted[mediaPathLength - 1]
    return `https://www.myselfmonart.com/cdn/shop/files/${mediaPathEnd}`
  }

  private async getMediaAlt(content: TranslatableContent) {
    const filename = content.value.split('/').at(-1)
    if (!filename) return undefined

    const { query, variables } = this.getMediaAltQuery(filename)
    const response = (await this.fetchGraphQL(query, variables)) as MediaAltResponse

    const matchingFile = response.files.edges.find((edge) => {
      const url = edge.node.preview?.image?.url
      if (!url) return false

      const type = url.split('/').at(-2)
      if (type !== 'files') return false

      const urlFilename = url.split('/').at(-1)?.split('?')[0]
      return urlFilename === filename
    })

    return matchingFile?.node.alt
  }

  private getMediaAltQuery(filename: string) {
    return {
      query: `query {
        files(first: 250, query: "filename:${filename}") {
          edges {
            node {
              ... on MediaImage {
                alt
                preview {
                  image {
                    id
                    altText
                    url
                  }
                }
              }
              ... on Video {
                id
                alt
              }
            }
          }
        }
      }`,
      variables: {},
    }
  }

  private getMediaName(content: TranslatableContent) {
    return content.value.split('/').at(-1) as string
  }
}
