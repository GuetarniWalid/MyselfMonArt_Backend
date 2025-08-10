import type { Background } from 'Types/Midjourney'
import AltGenerator from './AltGenerator'
import Authentication from '../Authentication'
import BackgroundSelector from './BackgroundSelector'
import DescriptionGenerator from './DescriptionGenerator'
import ImageAnalyzer from './ImageAnalyser'
import Env from '@ioc:Adonis/Core/Env'
import ParentCollectionPicker from './ParentCollectionPicker'
import ProductTypePicker from './ProductTypePicker'
import TitleAndSeoGenerator from './TitleAndSeoGenerator'
import TagPicker from './TagPicker'
import { zodResponseFormat } from 'openai/helpers/zod'

export default class Midjourney extends Authentication {
  private imageAnalysis: {
    haveToBeDetailed: boolean
  } | null = null

  public async generateAlt(imageUrl: string) {
    return this.retryOperation(async () => {
      const altGenerator = new AltGenerator()
      try {
        const { responseFormat, payload, systemPrompt } = altGenerator.prepareRequest(imageUrl)

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'alt'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete alt')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to generate an alt for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid alt')
        }

        return response.message.parsed
      } catch (error) {
        console.error('Error during alt generation: ', error)
        throw new Error('Failed to generate alt')
      }
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
      } catch (error) {
        lastError = error as Error

        // Check if it's a ChatGPT refusal error that we want to retry
        if (
          error instanceof Error &&
          (error.message.includes('ChatGPT refused to generate') ||
            error.message.includes("I'm sorry, I can't") ||
            error.message.includes("I'm sorry, I can't help") ||
            error.message.includes("I'm sorry, I can't assist"))
        ) {
          if (attempt < maxRetries) {
            console.log(
              `Attempt ${attempt} failed due to ChatGPT refusal, retrying in ${delayMs}ms...`
            )
            await new Promise((resolve) => setTimeout(resolve, delayMs))
            continue
          }
        }

        // For other errors or if we've exhausted retries, throw immediately
        throw error
      }
    }

    throw lastError!
  }

  public async generateHtmlDescription(imageUrl: string) {
    await this.ensureImageAnalysis(imageUrl)

    return this.retryOperation(async () => {
      const descriptionGenerator = new DescriptionGenerator(this.imageAnalysis!.haveToBeDetailed)

      try {
        const { responseFormat, payload, systemPrompt } =
          descriptionGenerator.prepareRequest(imageUrl)

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'description'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete description')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to generate a description for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid description')
        }

        return response.message.parsed.description
      } catch (error) {
        console.error('Error during description generation: ', error)
        throw new Error('Failed to generate description')
      }
    })
  }

  private async analyseImage(imageUrl: string) {
    return this.retryOperation(async () => {
      const imageAnalyzer = new ImageAnalyzer()

      try {
        const { responseFormat, payload, systemPrompt } = imageAnalyzer.prepareRequest(imageUrl)

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'image_analysis'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete image analysis')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to analyse the image for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid image analysis')
        }

        return response.message.parsed
      } catch (error) {
        console.error('Error during image analysis: ', error)
        throw new Error('Failed to analyse image')
      }
    })
  }

  public async generateTitleAndSeo(descriptionHtml: string) {
    return this.retryOperation(async () => {
      const titleAndSeoGenerator = new TitleAndSeoGenerator()

      try {
        const { responseFormat, systemPrompt } =
          titleAndSeoGenerator.prepareRequest(descriptionHtml)

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(descriptionHtml),
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'title'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete title')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to generate a title for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid title')
        }

        return response.message.parsed
      } catch (error) {
        console.error('Error during title generation: ', error)
        throw new Error('Failed to generate title')
      }
    })
  }

  private async ensureImageAnalysis(imageUrl: string) {
    if (!this.imageAnalysis) {
      this.imageAnalysis = await this.analyseImage(imageUrl)
    }
  }

  public async suggestRelevantBackgrounds(
    backgrounds: Background[],
    mainImageUrl: string,
    descriptionHtml: string
  ) {
    return this.retryOperation(async () => {
      const backgroundSelector = new BackgroundSelector()

      try {
        const { responseFormat, payload, systemPrompt } = backgroundSelector.prepareRequest(
          backgrounds,
          mainImageUrl,
          descriptionHtml
        )

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Backgrounds disponibles : ${JSON.stringify(payload.backgrounds)}`,
                },
                {
                  type: 'text',
                  text: `Description du tableau en HTML : ${payload.descriptionHtml}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.mainImageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'background'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete list of relevant backgrounds')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to suggest relevant backgrounds for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid list of relevant backgrounds')
        }

        return response.message.parsed.paths
      } catch (error) {
        console.error('Error during relevant backgrounds suggestion: ', error)
        throw new Error('Failed to suggest relevant backgrounds')
      }
    })
  }

  public async suggestRelevantParentCollection(collections: string[], imageUrl: string) {
    return this.retryOperation(async () => {
      const parentCollectionPicker = new ParentCollectionPicker()
      try {
        const { responseFormat, payload, systemPrompt } = parentCollectionPicker.prepareRequest(
          collections,
          imageUrl
        )

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Collections: ${payload.collections}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'parent_collection'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete parent collection')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to generate a parent collection for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid parent collection')
        }

        return response.message.parsed.parentCollection
      } catch (error) {
        console.error('Error during parent collection generation: ', error)
        throw new Error('Failed to generate parent collection')
      }
    })
  }

  public async suggestTags(tags: string[], imageUrl: string) {
    return this.retryOperation(async () => {
      const tagPicker = new TagPicker()

      try {
        const { responseFormat, payload, systemPrompt } = tagPicker.prepareRequest(tags, imageUrl)

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Tags: ${payload.tags}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'tags'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete list of tags')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to generate a list of tags for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid list of tags')
        }

        const suggestedTags = response.message.parsed.tags
        // add generic tags
        suggestedTags.push('poster et affiche', 'plexiglass', 'aluminium')
        return suggestedTags
      } catch (error) {
        console.error('Error during tag generation: ', error)
        throw new Error('Failed to generate tags')
      }
    })
  }

  public async suggestProductType(productTypes: string[], imageUrl: string) {
    return this.retryOperation(async () => {
      const productTypePicker = new ProductTypePicker()

      try {
        const { responseFormat, payload, systemPrompt } = productTypePicker.prepareRequest(
          productTypes,
          imageUrl
        )

        const completion = await this.openai.beta.chat.completions.parse({
          model: Env.get('OPENAI_MODEL'),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Types de produits existants: ${payload.productTypes}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: payload.imageUrl,
                  },
                },
              ],
            },
          ],
          response_format: zodResponseFormat(responseFormat, 'product_type'),
        })
        const response = completion.choices[0]

        if (response.finish_reason === 'length') {
          throw new Error('ChatGPT did not return a complete product type')
        } else if (response.message.refusal) {
          throw new Error(
            `ChatGPT refused to generate a product type for the following reason: ${response.message.refusal}`
          )
        } else if (!response.message.parsed) {
          throw new Error('ChatGPT did not return a valid product type')
        }

        return response.message.parsed.productType
      } catch (error) {
        console.error('Error during product type generation: ', error)
        throw new Error('Failed to generate product type')
      }
    })
  }
}
