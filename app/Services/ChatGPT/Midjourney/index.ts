import type { Background } from 'Types/Midjourney'
import type { Collection } from 'Types/Collection'
import AltGenerator from './AltGenerator'
import Authentication from '../Authentication'
import BackgroundSelector from './BackgroundSelector'
import DescriptionGenerator from './DescriptionGenerator'
import Env from '@ioc:Adonis/Core/Env'
import ParentCollectionPicker from './ParentCollectionPicker'
import ProductTypePicker from './ProductTypePicker'
import TitleAndSeoGenerator from './TitleAndSeoGenerator'
import TagPicker from './TagPicker'
import { zodResponseFormat } from 'openai/helpers/zod'

export default class Midjourney extends Authentication {
  public async generateAlt(imageUrl: string) {
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
  }

  public async generateHtmlDescription(imageUrl: string, prompt: string) {
    const descriptionGenerator = new DescriptionGenerator()

    try {
      const { responseFormat, payload, systemPrompt } = descriptionGenerator.prepareRequest(
        imageUrl,
        prompt
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
                text: `Prompt Midjourney : ${payload.prompt}`,
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
  }

  public async generateTitleAndSeo(imageUrl: string, descriptionHtml: string) {
    const titleAndSeoGenerator = new TitleAndSeoGenerator()

    try {
      const { responseFormat, payload, systemPrompt } = titleAndSeoGenerator.prepareRequest(
        imageUrl,
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
                text: payload.descriptionHtml,
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
  }

  public async suggestRelevantBackgrounds(
    backgrounds: Background[],
    mainImageUrl: string,
    parentCollection: Collection
  ) {
    const backgroundSelector = new BackgroundSelector()

    try {
      const { responseFormat, payload, systemPrompt } = backgroundSelector.prepareRequest(
        backgrounds,
        mainImageUrl,
        parentCollection.title
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
                text: `Collection parente : ${payload.parentCollection}`,
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
  }

  public async suggestRelevantParentCollection(collections: string[], imageUrl: string) {
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
  }

  public async suggestTags(tags: string[], imageUrl: string) {
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
  }

  public async suggestProductType(productTypes: string[], imageUrl: string) {
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
  }
}
