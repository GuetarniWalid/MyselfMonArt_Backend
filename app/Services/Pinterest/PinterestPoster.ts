import type {
  Board,
  MediaUpload,
  MediaUploadRegistration,
  PinPayload,
  PinterestPin,
} from 'Types/Pinterest'
import PinterestPinPayloadValidator from 'App/Validators/PinterestPinPayloadValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import axios from 'axios'
import FormData from 'form-data'
import Authentication from './Authentication'

export default class PinterestPoster extends Authentication {
  public async publishPin(pinPayload: PinPayload) {
    await this.validatePinPayload(pinPayload)
    const response = await this.sendPinToPinterest(pinPayload)
    return response
  }

  /**
   * Upload a video to Pinterest and return its `media_id`, ready to attach to a
   * pin via `media_source.source_type = 'video_id'`.
   *
   * Pinterest video upload is a 3-step dance (unlike Instagram, which accepts a
   * plain video URL):
   *   1. Register the upload   → POST /media { media_type: 'video' }
   *   2. Upload the bytes      → multipart POST to the returned S3 `upload_url`
   *   3. Poll until processed  → GET /media/{id} until status === 'succeeded'
   */
  public async uploadVideo(videoBuffer: Buffer): Promise<string> {
    const registration = await this.registerVideoMedia()
    await this.uploadVideoBytes(registration, videoBuffer)
    await this.waitForMediaReady(registration.media_id)
    return registration.media_id
  }

  private async registerVideoMedia(): Promise<MediaUploadRegistration> {
    try {
      return await this.request<MediaUploadRegistration>({
        method: 'POST',
        url: '/media',
        data: { media_type: 'video' },
      })
    } catch (error) {
      const status = error?.response?.status
      const body = error?.response?.data
      throw new Error(
        `Pinterest POST /media (register video) failed (status ${status}): ${JSON.stringify(body)}`
      )
    }
  }

  /**
   * POST the video bytes to the S3 `upload_url` as multipart/form-data. Every
   * key/value in `upload_parameters` must be sent as a form field, and the file
   * field (`file`) must come LAST — S3 presigned POST policies reject the file
   * if it precedes the policy fields. This hits S3 directly, so it uses a bare
   * axios call with no Pinterest auth header.
   */
  private async uploadVideoBytes(
    registration: MediaUploadRegistration,
    videoBuffer: Buffer
  ): Promise<void> {
    const form = new FormData()
    for (const [key, value] of Object.entries(registration.upload_parameters ?? {})) {
      form.append(key, value)
    }
    form.append('file', videoBuffer, { filename: 'video.mp4', contentType: 'video/mp4' })

    try {
      await axios.post(registration.upload_url, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
    } catch (error) {
      const status = error?.response?.status
      const body = error?.response?.data
      throw new Error(
        `Pinterest video bytes upload to S3 failed (status ${status}): ${JSON.stringify(body)} | media_id=${registration.media_id}`
      )
    }
  }

  /**
   * Poll GET /media/{id} until the upload is processed. Video ingestion is slow,
   * so we poll generously (default ~3 min) before giving up.
   */
  private async waitForMediaReady(
    mediaId: string,
    maxRetries: number = 60,
    delayMs: number = 3000
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const media = await this.request<MediaUpload>({
        method: 'GET',
        url: `/media/${mediaId}`,
      })

      if (media.status === 'succeeded') return
      if (media.status === 'failed') {
        throw new Error(`Pinterest media ${mediaId} processing ended in 'failed' state`)
      }
      // Otherwise status is registered/processing — keep polling.
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    throw new Error(
      `Pinterest media ${mediaId} not ready after ${maxRetries} attempts (${(maxRetries * delayMs) / 1000}s)`
    )
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
        `Pinterest POST /pins failed (status ${status}): ${JSON.stringify(body)} | payload board=${pinPayload.board_id} link=${pinPayload.link} source_type=${pinPayload.media_source.source_type}`
      )
    }
  }
}
