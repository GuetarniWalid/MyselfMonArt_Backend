import Authentication from '../Authentication'
import PinPayloadGenerator from './PinPayloadGenerator'
import { zodToJsonSchema } from 'zod-to-json-schema'
import Env from '@ioc:Adonis/Core/Env'

export default class Pinterest extends Authentication {
  /**
   * Generate Pinterest pin payload (title, description, alt_text)
   */
  public async generatePinPayload(
    productTitle: string,
    productDescription: string,
    productType: string
  ): Promise<{ title: string; description: string; alt_text: string }> {
    return this.retryOperation(async () => {
      const pinPayloadGenerator = new PinPayloadGenerator()
      const { responseFormat, systemPrompt, payload } = pinPayloadGenerator.prepareRequest(
        productTitle,
        productDescription,
        productType
      )
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'pin_payload')

      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 1024,
        tools: [
          {
            name: 'generate_pin_payload',
            description: 'Generate Pinterest pin title, description and alt text',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_pin_payload' },
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
        throw new Error('Claude did not return pin payload')
      }

      return responseFormat.parse(toolUse.input)
    })
  }

  /**
   * Retry logic with Claude-specific error handling
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

        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || delayMs.toString())
          console.log(`Claude rate limited, retrying in ${retryAfter}ms...`)
          await new Promise((resolve) => setTimeout(resolve, retryAfter))
          continue
        }

        if (error.status === 529) {
          const backoff = delayMs * attempt
          console.log(`Claude overloaded, retrying in ${backoff}ms...`)
          await new Promise((resolve) => setTimeout(resolve, backoff))
          continue
        }

        throw error
      }
    }

    throw lastError!
  }
}
