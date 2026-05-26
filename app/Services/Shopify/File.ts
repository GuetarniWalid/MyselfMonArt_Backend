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

  /**
   * Upload a file directly from an in-memory buffer.
   * Runs the full Shopify staged-upload flow:
   *   1. stagedUploadsCreate → temporary upload URL + form parameters
   *   2. multipart POST of the buffer to that URL
   *   3. fileCreate using the resourceUrl returned by step 1
   *   4. Polling until the MediaImage is processed and a public CDN URL is available
   *
   * Used by the Instagram poster (Meta requires a public URL, not base64).
   */
  public async uploadFromBuffer(params: {
    buffer: Buffer
    mimeType: string
    filename: string
    alt?: string
    maxRetries?: number
    delayMs?: number
  }): Promise<{ fileId: string; url: string }> {
    const staged = await this.createStagedUpload(
      params.filename,
      params.mimeType,
      params.buffer.length
    )
    await this.uploadBufferToStagedTarget(staged, params.buffer, params.mimeType, params.filename)
    const fileId = await this.create(staged.resourceUrl, params.alt ?? 'Image')
    const url = await this.pollForUrl(fileId, params.maxRetries ?? 15, params.delayMs ?? 2000)
    return { fileId, url }
  }

  /**
   * Permanently delete one or more files from Shopify (no soft-delete).
   * Used by the Instagram poster to clean up temporary post images after
   * Meta has accepted the publish request.
   */
  public async delete(fileIds: string[]): Promise<void> {
    const query = `mutation fileDelete($fileIds: [ID!]!) {
      fileDelete(fileIds: $fileIds) {
        deletedFileIds
        userErrors {
          field
          message
        }
      }
    }`
    const response = await this.fetchGraphQL(query, { fileIds })
    if (response.fileDelete.userErrors?.length) {
      throw new Error(`fileDelete error: ${JSON.stringify(response.fileDelete.userErrors)}`)
    }
  }

  private async createStagedUpload(
    filename: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<{
    url: string
    resourceUrl: string
    parameters: Array<{ name: string; value: string }>
  }> {
    const query = `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`
    const variables = {
      input: [
        {
          filename,
          mimeType,
          resource: 'IMAGE',
          httpMethod: 'POST',
          fileSize: String(sizeBytes),
        },
      ],
    }
    const response = await this.fetchGraphQL(query, variables)
    if (response.stagedUploadsCreate.userErrors?.length) {
      throw new Error(
        `stagedUploadsCreate error: ${JSON.stringify(response.stagedUploadsCreate.userErrors)}`
      )
    }
    const target = response.stagedUploadsCreate.stagedTargets[0]
    if (!target) throw new Error('stagedUploadsCreate returned no target')
    return target
  }

  private async uploadBufferToStagedTarget(
    staged: { url: string; parameters: Array<{ name: string; value: string }> },
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<void> {
    const formData = new FormData()
    for (const param of staged.parameters) {
      formData.append(param.name, param.value)
    }
    // The file part must be appended last — Shopify's staged upload endpoint
    // (Google Cloud Storage-backed) expects all form parameters before the
    // binary blob.
    const blob = new Blob([buffer], { type: mimeType })
    formData.append('file', blob, filename)

    const response = await fetch(staged.url, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Staged upload POST failed (status ${response.status}): ${text}`)
    }
  }

  /**
   * Poll until the MediaImage has an `image.url` (Shopify CDN URL).
   * Inlined rather than reusing waitForProcessing() because the latter
   * deliberately short-circuits in NODE_ENV=development — that guard is for
   * the create-from-public-URL flow (localhost URLs Shopify can't fetch)
   * and is irrelevant here since the source has already been uploaded to
   * Shopify's own staging storage.
   */
  private async pollForUrl(fileId: string, maxRetries: number, delayMs: number): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const url = await this.getFileUrl(fileId)
      if (url) return url
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    throw new Error(
      `File ${fileId} not processed after ${maxRetries} attempts (${(maxRetries * delayMs) / 1000}s)`
    )
  }

  private async getFileUrl(fileId: string): Promise<string | null> {
    const { query, variables } = this.getFileStatusQuery(fileId)
    const response = await this.fetchGraphQL(query, variables)
    return response?.node?.image?.url ?? null
  }
}
