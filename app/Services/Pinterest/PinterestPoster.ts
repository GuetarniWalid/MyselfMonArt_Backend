import type { Board, PinPayload, PinterestPin } from 'Types/Pinterest'
import PinterestPinPayloadValidator from 'App/Validators/PinterestPinPayloadValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import Authentication from './Authentication'

export default class PinterestPoster extends Authentication {
  public async publishPin(pinPayload: PinPayload) {
    await this.validatePinPayload(pinPayload)
    const response = await this.sendPinToPinterest(pinPayload)
    return response
  }

  public async createBoard(payload: {
    name: string
    description: string
    privacy?: 'PUBLIC' | 'SECRET'
  }): Promise<Board> {
    if (payload.name.length === 0 || payload.name.length > 50) {
      throw new Error(`Pinterest board name must be 1-50 chars, got ${payload.name.length}`)
    }
    if (payload.description.length > 500) {
      throw new Error(
        `Pinterest board description must be ≤500 chars, got ${payload.description.length}`
      )
    }
    const response = (await this.request({
      method: 'POST',
      url: '/boards',
      data: {
        name: payload.name,
        description: payload.description,
        privacy: payload.privacy || 'PUBLIC',
      },
    })) as Board
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
    try {
      const response = (await this.request({
        method: 'POST',
        url: '/pins',
        data: pinPayload,
      })) as PinterestPin
      return response
    } catch (error) {
      const status = error?.response?.status
      const body = error?.response?.data
      throw new Error(
        `Pinterest POST /pins failed (status ${status}): ${JSON.stringify(body)} | payload board=${pinPayload.board_id} link=${pinPayload.link} image_size_b64=${pinPayload.media_source.data.length}`
      )
    }
  }
}
