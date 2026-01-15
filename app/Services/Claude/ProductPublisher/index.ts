import Authentication from '../Authentication'
import AltGenerator from './AltGenerator'
import DescriptionGenerator from './DescriptionGenerator'
import ImageAnalyser from './ImageAnalyser'
import TitleAndSeoGenerator from './TitleAndSeoGenerator'
import TagPicker from './TagPicker'
import MockupAltGenerator from './MockupAltGenerator'
import { zodToJsonSchema } from 'zod-to-json-schema'
import Env from '@ioc:Adonis/Core/Env'
import type { IProductPublisher, MockupMetadata } from 'Types/ProductPublisher'

export default class ProductPublisher extends Authentication implements IProductPublisher {
  private imageAnalysis: { haveToBeDetailed: boolean } | null = null

  /**
   * Generate alt text and filename for main artwork
   */
  public async generateAlt(
    imageUrl: string,
    collectionTitle: string,
    productType: string
  ): Promise<{ alt: string; filename: string }> {
    return this.retryOperation(async () => {
      const altGenerator = new AltGenerator(productType as 'poster' | 'painting' | 'tapestry')
      const { responseFormat, systemPrompt } = altGenerator.prepareRequest(imageUrl)
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'alt')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const imageContent = await this.prepareImageContent(imageUrl)

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 512,
        tools: [
          {
            name: 'generate_alt',
            description: 'Generate alt text and filename for artwork',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_alt' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Product type: "${productType}". Collection: "${collectionTitle}". This artwork belongs to this collection, adapt your alt text to match the collection's theme and style and the product type.`,
              },
              {
                type: 'image',
                source: imageContent,
              },
            ],
          },
        ],
        system: systemPrompt,
      })

      const toolUse = response.content.find((block) => block.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return alt text')
      }

      return responseFormat.parse(toolUse.input)
    })
  }

  /**
   * Generate HTML description for main artwork
   * Calls analyseImage first to determine detail level
   */
  public async generateHtmlDescription(
    imageUrl: string,
    collectionTitle: string,
    productType: string
  ): Promise<string> {
    await this.ensureImageAnalysis(imageUrl)

    return this.retryOperation(async () => {
      const descriptionGenerator = new DescriptionGenerator(
        this.imageAnalysis!.haveToBeDetailed,
        productType as 'poster' | 'painting' | 'tapestry'
      )
      const { responseFormat, systemPrompt } = descriptionGenerator.prepareRequest(imageUrl)
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'description')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const imageContent = await this.prepareImageContent(imageUrl)

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 2048,
        tools: [
          {
            name: 'generate_description',
            description: 'Generate HTML product description',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_description' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Product type: "${productType}". Collection: "${collectionTitle}". This artwork belongs to this collection, adapt your description to match the collection's theme and style and the product type.`,
              },
              {
                type: 'image',
                source: imageContent,
              },
            ],
          },
        ],
        system: systemPrompt,
      })

      const toolUse = response.content.find((block) => block.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return description')
      }

      const validated = responseFormat.parse(toolUse.input)
      return validated.description
    })
  }

  /**
   * Generate title and SEO metadata from description HTML
   */
  public async generateTitleAndSeo(
    descriptionHtml: string,
    collectionTitle: string,
    productType: string
  ): Promise<{
    shortTitle: string
    title: string
    metaTitle: string
    metaDescription: string
  }> {
    return this.retryOperation(async () => {
      const titleAndSeoGenerator = new TitleAndSeoGenerator(
        productType as 'poster' | 'painting' | 'tapestry'
      )
      const { responseFormat, systemPrompt } = titleAndSeoGenerator.prepareRequest(descriptionHtml)
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'title_and_seo')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 512,
        tools: [
          {
            name: 'generate_title_and_seo',
            description: 'Generate title and SEO metadata',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_title_and_seo' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Collection: "${collectionTitle}". This product belongs to this collection, adapt your title and SEO to match the collection's theme and style.`,
              },
              {
                type: 'text',
                text: `Description HTML: ${JSON.stringify(descriptionHtml)}`,
              },
            ],
          },
        ],
        system: systemPrompt,
      })

      const toolUse = response.content.find((block) => block.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return title and SEO')
      }

      return responseFormat.parse(toolUse.input)
    })
  }

  /**
   * Suggest tags from provided list based on image analysis
   */
  public async suggestTags(
    tags: string[],
    imageUrl: string,
    collectionTitle: string,
    productType: string
  ): Promise<string[]> {
    return this.retryOperation(async () => {
      const tagPicker = new TagPicker(productType as 'poster' | 'painting' | 'tapestry')
      const { responseFormat, systemPrompt } = tagPicker.prepareRequest(tags, imageUrl)
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'tags')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const imageContent = await this.prepareImageContent(imageUrl)

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 512,
        tools: [
          {
            name: 'suggest_tags',
            description: 'Select relevant tags from provided list',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'suggest_tags' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Product type: "${productType}". Collection: "${collectionTitle}". This artwork belongs to this collection, adapt your tags to match the collection's theme and style and the product type.`,
              },
              {
                type: 'text',
                text: `Tags: ${tags.join(', ')}`,
              },
              {
                type: 'image',
                source: imageContent,
              },
            ],
          },
        ],
        system: systemPrompt,
      })

      const toolUse = response.content.find((block) => block.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return tags')
      }

      const validated = responseFormat.parse(toolUse.input)

      return validated.tags
    })
  }

  /**
   * AI-powered mockup alt generation
   * Generates one mockup alt per call using product metadata
   */
  public async generateMockupAlt(
    mockupContext: string,
    metadata: MockupMetadata
  ): Promise<{ alt: string; filename: string }> {
    return this.retryOperation(async () => {
      const generator = new MockupAltGenerator()
      const { systemPrompt, responseFormat } = generator.prepareRequest(metadata, mockupContext)
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'mockup_alt')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const payload = {
        ...metadata,
        mockupContext,
      }

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 512,
        tools: [
          {
            name: 'generate_mockup_alt',
            description: 'Generate alt text and filename for mockup image',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_mockup_alt' },
        messages: [
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
        system: systemPrompt,
      })

      const toolUse = response.content.find((block) => block.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return mockup alt')
      }

      return responseFormat.parse(toolUse.input)
    })
  }

  /**
   * Image analysis (determines if artwork requires detailed description)
   */
  private async analyseImage(imageUrl: string): Promise<{ haveToBeDetailed: boolean }> {
    return this.retryOperation(async () => {
      const imageAnalyzer = new ImageAnalyser()
      const { responseFormat, systemPrompt } = imageAnalyzer.prepareRequest(imageUrl)
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'image_analysis')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const imageContent = await this.prepareImageContent(imageUrl)

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 256,
        tools: [
          {
            name: 'analyze_image',
            description: 'Analyze if image requires detailed description',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'analyze_image' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: imageContent,
              },
            ],
          },
        ],
        system: systemPrompt,
      })

      const toolUse = response.content.find((block) => block.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return image analysis')
      }

      return responseFormat.parse(toolUse.input)
    })
  }

  /**
   * Ensure image analysis is done before generation
   * Caches the result to avoid duplicate calls
   */
  private async ensureImageAnalysis(imageUrl: string): Promise<void> {
    if (!this.imageAnalysis) {
      this.imageAnalysis = await this.analyseImage(imageUrl)
    }
  }

  /**
   * Prepare image content for Claude (base64 encoding)
   * Handles both base64 data URIs and regular URLs
   */
  private async prepareImageContent(imageUrl: string): Promise<{
    type: 'base64'
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    data: string
  }> {
    // If URL is already base64 data URI, use directly
    if (imageUrl.startsWith('data:image') || imageUrl.startsWith('data:application/octet-stream')) {
      const [header, data] = imageUrl.split(',')

      // Extract media type - for octet-stream, default to jpeg (we'll let Sharp detect actual format)
      let mediaType = 'image/jpeg'
      const imageMatch = header.match(/data:(image\/[^;]+)/)
      if (imageMatch) {
        mediaType = imageMatch[1]
      }

      // Validate base64 data
      if (!data || data.length === 0) {
        throw new Error('Invalid base64 image: empty data')
      }

      return {
        type: 'base64' as const,
        media_type: this.normalizeMediaType(mediaType),
        data: data.trim(),
      }
    }

    // Otherwise, fetch and convert to base64
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from ${imageUrl}: ${response.status} ${response.statusText}`
      )
    }

    const buffer = await response.arrayBuffer()

    // Validate image size (Claude has a ~5MB limit for base64)
    const sizeInMB = buffer.byteLength / (1024 * 1024)
    if (sizeInMB > 5) {
      throw new Error(`Image too large for Claude API: ${sizeInMB.toFixed(2)}MB (max 5MB)`)
    }

    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = response.headers.get('content-type') || 'image/jpeg'

    // Validate base64
    if (!base64 || base64.length === 0) {
      throw new Error('Failed to convert image to base64')
    }

    return {
      type: 'base64' as const,
      media_type: this.normalizeMediaType(mediaType),
      data: base64,
    }
  }

  /**
   * Normalize media type to Claude-accepted values
   * Claude only accepts: image/jpeg, image/png, image/gif, image/webp
   */
  private normalizeMediaType(
    mediaType: string
  ): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    // Remove any parameters (e.g., "image/jpeg; charset=utf-8" -> "image/jpeg")
    const cleanType = mediaType.split(';')[0].trim().toLowerCase()

    // Map common variations to accepted types
    const typeMap: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
      'image/jpg': 'image/jpeg',
      'image/jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
    }

    // Return mapped type or default to jpeg
    return typeMap[cleanType] || 'image/jpeg'
  }

  /**
   * Retry logic with Claude-specific error handling
   * Handles rate limits (429) and overload (529) with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        // Rate limit (429)
        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || delayMs.toString())
          console.log(`Claude rate limited, retrying in ${retryAfter}ms...`)
          await new Promise((resolve) => setTimeout(resolve, retryAfter))
          continue
        }

        // Overloaded (529)
        if (error.status === 529) {
          const backoff = delayMs * attempt
          console.log(`Claude overloaded, retrying in ${backoff}ms...`)
          await new Promise((resolve) => setTimeout(resolve, backoff))
          continue
        }

        // Other errors - throw immediately
        throw error
      }
    }

    throw lastError!
  }
}
