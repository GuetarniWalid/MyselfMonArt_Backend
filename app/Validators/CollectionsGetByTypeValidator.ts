import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class CollectionsGetByTypeValidator {
  public schema = schema.create({
    type: schema.enum(['painting', 'poster', 'tapestry'] as const),
  })

  public messages: CustomMessages = {
    'type.required': 'Collection type is required',
    'type.enum': "Collection type must be 'painting', 'poster', or 'tapestry'",
  }
}
