import type { Product } from 'Types/Product'
import Authentication from '../Authentication'
import { zodResponseFormat } from 'openai/helpers/zod'
import PreventSeoCannibalisation from './PreventSeoCannibalisation'
import UpdateToWallArtTerminology from './UpdateToWallArtTerminology'
import UpdateDescriptionsToWallArt from './UpdateDescriptionsToWallArt'
import Env from '@ioc:Adonis/Core/Env'

export default class SEO extends Authentication {
  private preventSeoCannibalisation: PreventSeoCannibalisation
  private wallArtTerminologyUpdater: UpdateToWallArtTerminology
  private wallArtDescriptionUpdater: UpdateDescriptionsToWallArt

  constructor() {
    super()
    this.preventSeoCannibalisation = new PreventSeoCannibalisation()
    this.wallArtTerminologyUpdater = new UpdateToWallArtTerminology()
    this.wallArtDescriptionUpdater = new UpdateDescriptionsToWallArt()
  }

  public async preventTitleCannibalization(product: Product) {
    try {
      await this.preventSeoCannibalisation.checkData(product)

      const { responseFormat, productFormatted, systemPrompt } =
        this.preventSeoCannibalisation.prepareRequest(product)

      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
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

  public async updateToWallArtTerminology(product: Product) {
    try {
      await this.wallArtTerminologyUpdater.checkData(product)

      const { responseFormat, productFormatted, systemPrompt } =
        this.wallArtTerminologyUpdater.prepareRequest(product)

      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
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
          `ChatGPT refused to update the terminology for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid response')
      }

      return response.message.parsed
    } catch (error) {
      console.error('Error during terminology update: ', error)
      throw new Error('Failed to update the terminology')
    }
  }

  public async updateDescriptionsToWallArt(product: Product) {
    try {
      await this.wallArtDescriptionUpdater.checkData(product)

      const { responseFormat, productFormatted, systemPrompt } =
        this.wallArtDescriptionUpdater.prepareRequest(product)

      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
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
          `ChatGPT refused to update the descriptions for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid response')
      }

      return response.message.parsed
    } catch (error) {
      console.error('Error during description update: ', error)
      throw new Error('Failed to update the descriptions')
    }
  }
}
