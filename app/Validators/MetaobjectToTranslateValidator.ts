import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class MetaobjectToTranslateValidator {
  public schema = schema.create({
    id: schema.string(),
    displayName: schema.string(),
    type: schema.string(),
    field: schema.object().members({
      key: schema.string(),
      type: schema.string(),
      jsonValue: schema.string(),
    }),
  })

  public messages: CustomMessages = {}
}
