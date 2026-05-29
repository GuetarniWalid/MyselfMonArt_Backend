import Env from '@ioc:Adonis/Core/Env'
import axios from 'axios'
import IgAuthentication from '../Instagram/Authentication'
import type { ProductCard, CtaButton } from '../ConversationAgent/tools'

export type ReplyChannel = 'instagram' | 'messenger'

export interface SendResult {
  messageId: string | null
  raw: any
}

const GRAPH_VERSION = 'v23.0'
const FB_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

/**
 * Sends outbound DMs back to the user via the Meta Graph API.
 *
 * Instagram uses graph.instagram.com with the IG access token (Instagram Login
 * flow) — handled by the inherited IgAuthentication request().
 * Messenger / Facebook Page uses graph.facebook.com with the Page Access Token
 * (FACEBOOK_PAGE_ACCESS_TOKEN).
 */
export default class MetaReplySender extends IgAuthentication {
  public async send(
    channel: ReplyChannel,
    recipientExternalId: string,
    text: string
  ): Promise<SendResult> {
    if (channel === 'instagram') {
      return await this.sendInstagram(recipientExternalId, text)
    }
    if (channel === 'messenger') {
      return await this.sendMessenger(recipientExternalId, { text })
    }
    throw new Error(`Unsupported channel: ${channel}`)
  }

  /**
   * Send product cards as a tappable carousel (Meta "generic template"):
   * image, title, subtitle, and a "Voir" web_url button (also the card tap
   * action). Up to 10 elements. Works on both IG and Messenger — only the
   * transport differs.
   */
  public async sendProductCards(
    channel: ReplyChannel,
    recipientExternalId: string,
    cards: ProductCard[]
  ): Promise<SendResult> {
    const elements = this.buildCardElements(cards)
    if (elements.length === 0) {
      return { messageId: null, raw: { skipped: 'no renderable cards' } }
    }

    const message = {
      attachment: {
        type: 'template',
        payload: { template_type: 'generic', elements },
      },
    }

    if (channel === 'instagram') {
      const data = await this.request<any>({
        method: 'POST',
        url: '/me/messages',
        data: { recipient: { id: recipientExternalId }, message },
      })
      return { messageId: data?.message_id ?? null, raw: data }
    }
    if (channel === 'messenger') {
      return await this.sendMessenger(recipientExternalId, message)
    }
    throw new Error(`Unsupported channel: ${channel}`)
  }

  /**
   * Send a single call-to-action card (one generic-template element with a
   * web_url button). Hides a long URL behind a branded, tappable button —
   * e.g. "Suivre ma commande". Same transport split as sendProductCards.
   */
  public async sendCtaButton(
    channel: ReplyChannel,
    recipientExternalId: string,
    cta: CtaButton
  ): Promise<SendResult> {
    if (!cta.url) return { messageId: null, raw: { skipped: 'no url' } }

    const element: any = {
      title: cta.title.slice(0, 80),
      default_action: { type: 'web_url', url: cta.url },
      buttons: [{ type: 'web_url', url: cta.url, title: cta.buttonLabel.slice(0, 20) }],
    }
    if (cta.subtitle) element.subtitle = cta.subtitle.slice(0, 80)

    const message = {
      attachment: { type: 'template', payload: { template_type: 'generic', elements: [element] } },
    }

    if (channel === 'instagram') {
      const data = await this.request<any>({
        method: 'POST',
        url: '/me/messages',
        data: { recipient: { id: recipientExternalId }, message },
      })
      return { messageId: data?.message_id ?? null, raw: data }
    }
    if (channel === 'messenger') {
      return await this.sendMessenger(recipientExternalId, message)
    }
    throw new Error(`Unsupported channel: ${channel}`)
  }

  /**
   * IG DM send: POST /me/messages on graph.instagram.com with the IG token
   * that has instagram_business_manage_messages scope.
   */
  private async sendInstagram(recipientId: string, text: string): Promise<SendResult> {
    const data = await this.request<any>({
      method: 'POST',
      url: '/me/messages',
      data: { recipient: { id: recipientId }, message: { text } },
    })
    return { messageId: data?.message_id ?? null, raw: data }
  }

  /**
   * Messenger send: POST /me/messages on graph.facebook.com with the Page
   * Access Token. `message` is either { text } or an attachment payload.
   */
  private async sendMessenger(recipientId: string, message: any): Promise<SendResult> {
    const token = Env.get('FACEBOOK_PAGE_ACCESS_TOKEN')
    if (!token) {
      throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN is not set — cannot send Messenger reply')
    }
    const { data } = await axios.post(
      `${FB_GRAPH}/me/messages`,
      { recipient: { id: recipientId }, messaging_type: 'RESPONSE', message },
      { params: { access_token: token }, timeout: 15000 }
    )
    return { messageId: data?.message_id ?? null, raw: data }
  }

  private buildCardElements(cards: ProductCard[]): any[] {
    return cards
      .slice(0, 10)
      .filter((c) => c.url)
      .map((c) => {
        const el: any = {
          title: (c.title || 'Découvrir').slice(0, 80),
          default_action: { type: 'web_url', url: c.url },
          buttons: [{ type: 'web_url', url: c.url, title: 'Voir' }],
        }
        if (c.imageUrl) el.image_url = c.imageUrl
        if (c.subtitle) el.subtitle = c.subtitle.slice(0, 80)
        return el
      })
  }
}
