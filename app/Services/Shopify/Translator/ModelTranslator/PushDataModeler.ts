import type {
  FileCreateResponse,
  FileResponse,
  ModelToTranslate,
  ModelToTranslateMedia,
} from 'Types/Model'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public async formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: ModelToTranslate
    resourceTranslated: ModelToTranslate
    isoCode: LanguageCode
  }): Promise<TranslationsRegister[]> {
    const translationInputs = [] as TranslationInput[]
    let newFileId: string | undefined

    if (resourceTranslated.file) {
      newFileId = await this.createFile(resourceTranslated.file)
      console.log('🚀 ~ newFileId:', newFileId)
    }

    this.utils.createTranslationEntry(
      {
        key: resourceToTranslate.key,
        isoCode,
        newValue: newFileId ? newFileId : (resourceTranslated.value as string),
        oldValue: newFileId
          ? (resourceToTranslate.file?.oldUrl as string)
          : (resourceToTranslate.value as string),
      },
      translationInputs
    )

    return [
      {
        resourceId: resourceToTranslate.id!,
        translations: translationInputs,
      },
    ]
  }

  private getContentType(file: ModelToTranslateMedia) {
    if (file.url.endsWith('.mp4') || file.url.endsWith('.mov') || file.url.endsWith('.webm')) {
      return 'VIDEO'
    }
    if (
      file.url.endsWith('.jpg') ||
      file.url.endsWith('.jpeg') ||
      file.url.endsWith('.png') ||
      file.url.endsWith('.gif') ||
      file.url.endsWith('.webp')
    ) {
      return 'IMAGE'
    }
    return 'IMAGE'
  }

  private async createFile(file: ModelToTranslateMedia) {
    const { query: createFileQuery, variables: createFileVariables } = this.getFileCreateQuery(
      file,
      this.getContentType(file)
    )
    const createFileResponse = (await this.fetchGraphQL(
      createFileQuery,
      createFileVariables
    )) as FileCreateResponse
    const fileId = createFileResponse.fileCreate.files[0].id

    // Wait for 20 seconds to ensure file is processed
    await new Promise((resolve) => setTimeout(resolve, 20000))

    const { query: getFileQuery, variables: getFileVariables } = this.getFileQuery(fileId)
    const getFileResponse = (await this.fetchGraphQL(
      getFileQuery,
      getFileVariables
    )) as FileResponse
    const fileUrl = getFileResponse.node.image.url
    return this.formatUrlForTranslation(fileUrl)
  }

  private getFileCreateQuery(file: ModelToTranslateMedia, contentType: 'VIDEO' | 'IMAGE') {
    return {
      query: `mutation fileCreate($files: [FileCreateInput!]!) {
                fileCreate(files: $files) {
                  files {
                    ... on MediaImage {
                      id
                    }
                  }
                }
              }`,
      variables: {
        files: {
          alt: file.alt,
          contentType,
          originalSource: file.url,
        },
      },
    }
  }

  private getFileQuery(fileId: string) {
    return {
      query: `query GetFile($fileId: ID!) {
                node(id: $fileId) {
                  id
                  ... on MediaImage {
                    image {
                      id
                      url
                    }
                  }
                }
              }`,
      variables: {
        fileId,
      },
    }
  }

  private formatUrlForTranslation(url: string) {
    const urlParts = url.split('/')
    const fileNameWithQuery = urlParts[urlParts.length - 1]
    const fileName = fileNameWithQuery.split('?')[0]
    return `shopify://shop_images/${fileName}`
  }
}
