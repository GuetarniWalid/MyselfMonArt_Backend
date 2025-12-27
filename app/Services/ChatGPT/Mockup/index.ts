import Authentication from '../Authentication'
import MockupAltGenerator from './MockupAltGenerator'
import { zodResponseFormat } from 'openai/helpers/zod'
import Env from '@ioc:Adonis/Core/Env'

type ProductContext = {
  title: string
  description: string
  templateSuffix: string | null
  tags: string[]
  mockupTemplatePath?: string
}

export default class Mockup extends Authentication {
  /**
   * Generate SEO-optimized alt text for mockup images
   * @param product Product context (title, description, tags, type)
   * @param imageUrl Public URL of the mockup image
   * @returns Alt text with mockup metadata
   */
  public async generateMockupAlt(product: ProductContext, imageUrl: string) {
    return this.retryOperation(async () => {
      const altGenerator = new MockupAltGenerator()
      const { responseFormat, payload, systemPrompt } = altGenerator.prepareRequest(product)

      try {
        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: JSON.stringify(payload) },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'mockup_alt'),
        })

        const response = completion.choices[0]

        // Standard validation
        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete alt')
        } else if (response.message.refusal) {
          throw new Error(`ChatGPT refused: ${response.message.refusal}`)
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid alt')
        }

        return response.message.parsed
      } catch (error) {
        console.error('Error during mockup alt generation:', error)
        throw new Error('Failed to generate mockup alt')
      }
    })
  }

  /**
   * Retry operation with exponential backoff
   * @param operation Async operation to retry
   * @param maxRetries Maximum number of retry attempts
   * @param delayMs Delay between retries in milliseconds
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
      } catch (error) {
        lastError = error as Error

        if (attempt < maxRetries) {
          console.log(
            `[MockupAltGenerator] Retry attempt ${attempt}/${maxRetries} after error:`,
            error.message
          )
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    throw lastError
  }
}
