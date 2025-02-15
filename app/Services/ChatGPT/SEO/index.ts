import type { Product } from 'Types/Product'
import Authentication from '../Authentication'
import { zodResponseFormat } from 'openai/helpers/zod'
import PreventSeoCannibalisation from './PreventSeoCannibalisation'

export default class SEO extends Authentication {
  private preventSeoCannibalisation: PreventSeoCannibalisation

  constructor() {
    super()
    this.preventSeoCannibalisation = new PreventSeoCannibalisation()
  }

  public async preventTitleCannibalization(product: Product) {
    try {
      await this.preventSeoCannibalisation.checkData(product)

      const { responseFormat, productFormatted, systemPrompt } =
        this.preventSeoCannibalisation.prepareRequest(product)

      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: JSON.stringify(productFormatted) },
        ],
        response_format: zodResponseFormat(responseFormat, 'seo'),
      })
      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT did not return a complete response')
      } else if (response.message.refusal) {
        throw new Error(
          `ChatGPT refused to improve the SEO for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid response')
      }

      return response.message.parsed
    } catch (error) {
      console.error('Error during SEO improvement: ', error)
      throw new Error('Failed to improve the SEO')
    }
  }
}
