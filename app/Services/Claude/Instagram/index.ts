import Authentication from '../Authentication'
import PostPayloadGenerator from './PostPayloadGenerator'
import { zodToJsonSchema } from 'zod-to-json-schema'
import Env from '@ioc:Adonis/Core/Env'

export default class Instagram extends Authentication {
  /**
   * Generate Instagram post payload (caption + alt_text)
   */
  public async generatePostPayload(
    productTitle: string,
    productDescription: string,
    productType: string
  ): Promise<{ caption: string; alt_text: string }> {
    return this.retryOperation(async () => {
      const postPayloadGenerator = new PostPayloadGenerator()
      const { responseFormat, systemPrompt, payload } = postPayloadGenerator.prepareRequest(
        productTitle,
        productDescription,
        productType
      )
      const jsonSchema: any = zodToJsonSchema(responseFormat, 'post_payload')

      if (!jsonSchema.type) {
        jsonSchema.type = 'object'
      }

      const response = await this.anthropic.messages.create({
        model: Env.get('CLAUDE_MODEL'),
        max_tokens: 2048,
        tools: [
          {
            name: 'generate_post_payload',
            description: 'Generate Instagram post caption and alt text',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'generate_post_payload' },
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
        throw new Error('Claude did not return post payload')
      }

      return responseFormat.parse(toolUse.input)
    })
  }

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
