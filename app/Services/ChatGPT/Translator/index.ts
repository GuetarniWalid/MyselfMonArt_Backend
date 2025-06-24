import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import type { ArticleToTranslate } from 'Types/Article'
import type { BlogToTranslate } from 'Types/Blog'
import type { CollectionToTranslate } from 'Types/Collection'
import type { PageToTranslate } from 'Types/Page'
import type { ModelToTranslate } from 'Types/Model'
import type { ProductToTranslate } from 'Types/Product'
import { zodResponseFormat } from 'openai/helpers/zod'
import Authentication from '../Authentication'
import ArticleTranslator from './Article'
import BlogTranslator from './Blog'
import CollectionTranslator from './Collection'
import MetaobjectTranslator from './Metaobject'
import ModelTranslator from './Model'
import PageTranslator from './Page'
import ProductTranslator from './Product'
import StaticSectionTranslator from './StaticSection'
import { StaticSectionToTranslate } from 'Types/StaticSection'
import { MetaobjectToTranslate } from 'Types/Metaobject'
import Env from '@ioc:Adonis/Core/Env'

export default class Translator extends Authentication {
  private translationHandler:
    | ArticleTranslator
    | BlogTranslator
    | CollectionTranslator
    | MetaobjectTranslator
    | ModelTranslator
    | PageTranslator
    | ProductTranslator
    | StaticSectionTranslator

  constructor(
    payload:
      | Partial<ArticleToTranslate>
      | Partial<BlogToTranslate>
      | Partial<CollectionToTranslate>
      | MetaobjectToTranslate
      | ModelToTranslate
      | Partial<PageToTranslate>
      | Partial<ProductToTranslate>,
    resources: Resource,
    targetLanguage: LanguageCode
  ) {
    super()
    switch (resources) {
      case 'article':
        this.translationHandler = new ArticleTranslator(payload, targetLanguage)
        break
      case 'blog':
        this.translationHandler = new BlogTranslator(payload, targetLanguage)
        break
      case 'collection':
        this.translationHandler = new CollectionTranslator(payload, targetLanguage)
        break
      case 'model':
        this.translationHandler = new ModelTranslator(payload as ModelToTranslate, targetLanguage)
        break
      case 'metaobject':
        this.translationHandler = new MetaobjectTranslator(
          payload as MetaobjectToTranslate,
          targetLanguage
        )
        break
      case 'page':
        this.translationHandler = new PageTranslator(payload, targetLanguage)
        break
      case 'product':
        this.translationHandler = new ProductTranslator(payload, targetLanguage)
        break
      case 'static_section':
        this.translationHandler = new StaticSectionTranslator(
          payload as StaticSectionToTranslate,
          targetLanguage
        )
        break
    }
  }

  public async translate<T extends TranslatableContent>(payload: T) {
    try {
      await this.translationHandler.verifyPayloadValidity(payload)

      const { responseFormat, payloadFormatted, systemPrompt } =
        this.translationHandler.prepareTranslationRequest()

      if (Object.keys(payloadFormatted).length === 0) {
        return this.translationHandler.formatTranslationResponse({
          response: {},
          payload: payload as any,
        })
      }

      if (!responseFormat) {
        return this.translationHandler.formatTranslationResponse({
          response: {},
          payload: payload as any,
        })
      }

      const completion = await this.openai.beta.chat.completions.parse({
        model: Env.get('OPENAI_MODEL'),
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: JSON.stringify(payloadFormatted) },
        ],
        response_format: zodResponseFormat(responseFormat, 'translation'),
      })
      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT did not return a complete translation')
      } else if (response.message.refusal) {
        throw new Error(
          `ChatGPT refused to translate for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid translation')
      }

      return this.translationHandler.formatTranslationResponse({
        response: response.message.parsed,
        payload: payload as any,
      })
    } catch (error) {
      console.error('Error during translation: ', error)
      throw new Error('Failed to translate text')
    }
  }
}
