import IgAuthentication from '../Instagram/Authentication'
import type { ProductCard } from '../ConversationAgent/tools'

export type ReplyChannel = 'instagram' | 'messenger'

export interface SendResult {
  messageId: string | null
  raw: any
}

/**
 * Sends outbound DMs back to the user via the Meta Graph API.
 *
 * Instagram uses graph.instagram.com (per the new Instagram Login flow).
 * Messenger / Facebook Page uses graph.facebook.com with a Page Access Token —
 * not yet wired since the Page token storage / refresh pipeline is its own
 * mini-project. We surface a clear error so the inbox processor can mark the
 * message as 'failed' and surface it on the dashboard.
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
      throw new Error(
        'Messenger reply sending is not wired yet — Page Access Token storage to be implemented.'
      )
    }
    throw new Error(`Unsupported channel: ${channel}`)
  }

  /**
   * IG DM send: POST /me/messages on graph.instagram.com with the IG token
   * that has instagram_business_manage_messages scope. Returns the API
   * response which includes a message_id we can later log.
   */
  private async sendInstagram(recipientId: string, text: string): Promise<SendResult> {
    const data = await this.request<any>({
      method: 'POST',
      url: '/me/messages',
      data: {
        recipient: { id: recipientId },
        message: { text },
      },
    })

    return {
      messageId: data?.message_id ?? null,
      raw: data,
    }
  }

  /**
   * Send product cards as a tappable carousel (Meta "generic template").
   * Each card: image, title, subtitle, and a "Voir" web_url button that also
   * fires on card tap (default_action). Instagram supports up to 10 elements.
   * Cards missing an image are skipped — the template requires either an
   * image or a non-empty subtitle, and a card with neither renders poorly.
   */
  public async sendProductCards(
    channel: ReplyChannel,
    recipientExternalId: string,
    cards: ProductCard[]
  ): Promise<SendResult> {
    if (channel !== 'instagram') {
      throw new Error(`Product cards not wired for channel: ${channel}`)
    }

    const elements = cards
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

    if (elements.length === 0) {
      return { messageId: null, raw: { skipped: 'no renderable cards' } }
    }

    const data = await this.request<any>({
      method: 'POST',
      url: '/me/messages',
      data: {
        recipient: { id: recipientExternalId },
        message: {
          attachment: {
            type: 'template',
            payload: { template_type: 'generic', elements },
          },
        },
      },
    })

    return { messageId: data?.message_id ?? null, raw: data }
  }
}
