import type { PinPayload, PinterestPin } from 'Types/Pinterest'
import PinterestPinPayloadValidator from 'App/Validators/PinterestPinPayloadValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import Authentication from './Authentication'

export default class PinterestPoster extends Authentication {
  public async publishPin(pinPayload: PinPayload) {
    await this.validatePinPayload(pinPayload)
    const response = await this.sendPinToPinterest(pinPayload)
    return response
  }

  private async validatePinPayload(pinPayload: PinPayload) {
    try {
      await validator.validate({
        schema: new PinterestPinPayloadValidator().schema,
        data: pinPayload,
      })
    } catch (error) {
      console.error(error)
      throw new Error('Invalid pin payload')
    }
  }

  private async sendPinToPinterest(pinPayload: PinPayload) {
    const response = (await this.request({
      method: 'POST',
      url: '/pins',
      data: pinPayload,
    })) as PinterestPin
    return response
  }
}
