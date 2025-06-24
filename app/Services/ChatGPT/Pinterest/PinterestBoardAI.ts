import type { Product } from 'Types/Product'
import Authentication from '../Authentication'
import { zodResponseFormat } from 'openai/helpers/zod'
import Env from '@ioc:Adonis/Core/Env'
import SuggestRelevantBoardsService from './SuggestRelevantBoards'
import IsBoardRelevantForProductService from './IsBoardRelevantForProductService'

export default class PinterestBoardAI extends Authentication {
  public async suggestRelevantBoards(product: Product, existingBoards: string[]) {
    const suggestRelevantBoardsService = new SuggestRelevantBoardsService()

    try {
      const { responseFormat, payload, systemPrompt } = suggestRelevantBoardsService.prepareRequest(
        product,
        existingBoards
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
        response_format: zodResponseFormat(responseFormat, 'board_recommendation'),
      })
      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT did not return a complete board recommendation')
      } else if (response.message.refusal) {
        throw new Error(
          `ChatGPT refused to recommend a board for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid board recommendation')
      }

      return response.message.parsed.boards
    } catch (error) {
      console.error('Error during board recommendation: ', error)
      throw new Error('Failed to get board recommendation')
    }
  }

  public async isBoardRelevantForProduct(product: Product, boardName: string) {
    const isBoardRelevantForProductService = new IsBoardRelevantForProductService()

    try {
      const { responseFormat, payload, systemPrompt } =
        isBoardRelevantForProductService.prepareRequest(product, boardName)

      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: zodResponseFormat(responseFormat, 'board_recommendation'),
      })
      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT did not return a complete board recommendation')
      } else if (response.message.refusal) {
        throw new Error(
          `ChatGPT refused to recommend a board for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid board recommendation')
      }

      return response.message.parsed.isBoardRelevant
    } catch (error) {
      console.error('Error during board recommendation: ', error)
      throw new Error('Failed to get board recommendation')
    }
  }
}
