import Authentication from '../Authentication'
import MockupAltGenerator from '../ProductPublisher/MockupAltGenerator'
import { zodToJsonSchema } from 'zod-to-json-schema'
import Env from '@ioc:Adonis/Core/Env'
import type { MockupMetadata } from 'Types/ProductPublisher'

export default class Mockup extends Authentication {
  /**
   * Sanitize filename by removing accents, special characters, and formatting as slug
   * Examples:
   *   "Tableau élégant café" → "tableau-elegant-cafe"
   *   "toile--abstraite__colorée" → "toile-abstraite-coloree"
   */
  private sanitizeFilename(filename: string): string {
    return (
      filename
        // Normalize unicode to decompose accented characters (é → e + ́)
        .normalize('NFD')
        // Remove diacritics/accents (the combining characters)
        .replace(/[\u0300-\u036f]/g, '')
        // Convert to lowercase
        .toLowerCase()
        // Replace spaces, underscores, and other separators with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove any character that's not a-z, 0-9, or hyphen
        .replace(/[^a-z0-9-]/g, '')
        // Replace multiple consecutive hyphens with single hyphen
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
    )
  }

  /**
   * Generate alt text and filename for mockup image using Claude
   * Uses the same MockupAltGenerator as ProductPublisher for consistency
   */
  public async generateMockupAlt(
    metadata: MockupMetadata,
    mockupContext: string
  ): Promise<{ alt: string; filename: string }> {
    return this.retryOperation(async () => {
      const generator = new MockupAltGenerator()
      const { responseFormat, systemPrompt, payload } = generator.prepareRequest(
        metadata,
        mockupContext
      )
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'mockup_alt')

      // Ensure type field is present for Claude API
      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
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
            content: `${systemPrompt}\n\nProduct data:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      })

      const toolUse = response.content.find((c) => c.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return tool use response')
      }

      const parsed = responseFormat.safeParse(toolUse.input)

      if (!parsed.success) {
        // If Zod validation fails (e.g., filename has accents), extract and sanitize
        const rawInput = toolUse.input as { alt: string; filename: string }
        console.log(`⚠️  Zod validation failed, sanitizing filename: ${rawInput.filename}`)
        return {
          alt: rawInput.alt,
          filename: this.sanitizeFilename(rawInput.filename),
        }
      }

      // Sanitize filename even if validation passed (extra safety)
      return {
        alt: parsed.data.alt,
        filename: this.sanitizeFilename(parsed.data.filename),
      }
    })
  }

  /**
   * Generate filename only for mockup image (when alt is copied from main image)
   * Uses a simpler prompt focused only on filename generation
   */
  public async generateMockupFilename(
    metadata: MockupMetadata,
    mockupContext: string
  ): Promise<string> {
    return this.retryOperation(async () => {
      const generator = new MockupAltGenerator()
      const { systemPrompt, payload } = generator.prepareFilenameRequest(metadata, mockupContext)

      const filenameSchema = {
        type: 'object' as const,
        properties: {
          filename: {
            type: 'string',
            pattern: '^[a-z0-9-]+$',
            description:
              'SEO-friendly filename slug without extension (lowercase, hyphens only, max 80 chars)',
          },
        },
        required: ['filename'],
      }

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 256,
        tools: [
          {
            name: 'generate_mockup_filename',
            description: 'Generate SEO-friendly filename for mockup image',
            input_schema: filenameSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_mockup_filename' },
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\nProduct data:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      })

      const toolUse = response.content.find((c) => c.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return tool use response')
      }

      const rawInput = toolUse.input as { filename: string }
      return this.sanitizeFilename(rawInput.filename)
    })
  }

  /**
   * Retry operation with exponential backoff for rate limits and overload errors
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

        // Overload (529)
        if (error.status === 529) {
          const backoff = delayMs * Math.pow(2, attempt - 1)
          console.log(`Claude overloaded (529), retrying in ${backoff}ms...`)
          await new Promise((resolve) => setTimeout(resolve, backoff))
          continue
        }

        // Non-retryable error
        throw error
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }
}
