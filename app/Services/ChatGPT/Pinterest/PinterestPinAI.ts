import type { Product as ShopifyProduct } from 'Types/Product'
import type { Board } from 'Types/Pinterest'
import Authentication from '../Authentication'
import { zodResponseFormat } from 'openai/helpers/zod'
import Env from '@ioc:Adonis/Core/Env'
import PinFormatter from './PinFormatter'

export default class PinterestPinAI extends Authentication {
  public async buildPinPayload(shopifyProduct: ShopifyProduct, imageAlt: string, board: Board) {
    const pinFormatter = new PinFormatter()

    try {
      const { responseFormat, payload, systemPrompt } = pinFormatter.prepareRequest(
        shopifyProduct,
        imageAlt,
        board
      )

      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: zodResponseFormat(responseFormat, 'pin_payload'),
      })
      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT did not return a complete pin payload')
      } else if (response.message.refusal) {
        throw new Error(
          `ChatGPT refused to build a pin payload for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid pin payload')
      }

      return response.message.parsed
    } catch (error) {
      console.error('Error during pin payload building: ', error)
      throw new Error('Failed to build pin payload')
    }
  }
}
