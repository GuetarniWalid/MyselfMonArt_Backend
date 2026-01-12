import Authentication from './Authentication'

export default class File extends Authentication {
  /**
   * Upload a file to Shopify and wait for processing
   */
  public async create(publicUrl: string, alt: string = 'Product image'): Promise<string> {
    // Step 1: Upload file to Shopify
    const { query, variables } = this.getCreateQuery(publicUrl, alt)
    const response = await this.fetchGraphQL(query, variables)

    if (response.fileCreate.userErrors?.length) {
      throw new Error(response.fileCreate.userErrors[0].message)
    }

    const fileId = response.fileCreate.files[0].id

    // Step 2: Wait for Shopify to process the file
    await this.waitForProcessing(fileId)

    return fileId
  }

  private getCreateQuery(publicUrl: string, alt: string) {
    return {
      query: `mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on MediaImage {
              id
              alt
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        files: [
          {
            alt,
            contentType: 'IMAGE',
            originalSource: publicUrl,
          },
        ],
      },
    }
  }

  /**
   * Poll Shopify to check if file is processed and ready
   */
  public async waitForProcessing(
    fileId: string,
    maxRetries: number = 15,
    delayMs: number = 2000
  ): Promise<void> {
    // Skip file processing in dev mode (Shopify can't access localhost URLs)
    const Env = (await import('@ioc:Adonis/Core/Env')).default
    if (Env.get('NODE_ENV') === 'development') {
      console.log('⚠️  Skipping file processing check (development mode)')
      throw new Error(
        'File processing skipped: Development mode (Shopify cannot access localhost URLs)'
      )
    }

    console.log(
      `⏳ Polling file processing status (max ${maxRetries} attempts, ${delayMs}ms interval)`
    )

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { query, variables } = this.getFileStatusQuery(fileId)
        const response = await this.fetchGraphQL(query, variables)

        // Check if file has URL (means it's processed)
        const fileUrl = response?.node?.image?.url

        if (fileUrl) {
          console.log(
            `✅ File processed successfully on attempt ${attempt} (${(attempt * delayMs) / 1000}s)`
          )
          return
        }

        console.log(`⏳ File not ready yet, attempt ${attempt}/${maxRetries}`)
      } catch (error) {
        console.warn(`⚠️  Error checking file status on attempt ${attempt}:`, error.message)
      }

      // Wait before next retry (unless this was the last attempt)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    throw new Error(
      `File processing timeout: File not ready after ${maxRetries} attempts (${(maxRetries * delayMs) / 1000}s)`
    )
  }

  private getFileStatusQuery(fileId: string) {
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

  /**
   * Update file properties (filename, alt text)
   * Note: filename extension must match the original
   */
  public async update(
    fileId: string,
    updates: {
      filename?: string
      alt?: string
    }
  ): Promise<{ id: string; fileStatus: string }> {
    const { query, variables } = this.getUpdateQuery(fileId, updates)
    const response = await this.fetchGraphQL(query, variables)

    if (response.fileUpdate.userErrors?.length) {
      throw new Error(response.fileUpdate.userErrors[0].message)
    }

    const updatedFile = response.fileUpdate.files[0]
    return {
      id: updatedFile.id,
      fileStatus: updatedFile.fileStatus,
    }
  }

  private getUpdateQuery(
    fileId: string,
    updates: {
      filename?: string
      alt?: string
    }
  ) {
    const fileInput: any = {
      id: fileId,
    }

    if (updates.filename !== undefined) {
      fileInput.filename = updates.filename
    }

    if (updates.alt !== undefined) {
      fileInput.alt = updates.alt
    }

    return {
      query: `mutation fileUpdate($files: [FileUpdateInput!]!) {
        fileUpdate(files: $files) {
          files {
            ... on GenericFile {
              id
              fileStatus
            }
            ... on MediaImage {
              id
              fileStatus
            }
            ... on Video {
              id
              fileStatus
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      variables: {
        files: [fileInput],
      },
    }
  }
}
