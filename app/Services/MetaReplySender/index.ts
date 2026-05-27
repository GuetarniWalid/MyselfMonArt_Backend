import IgAuthentication from '../Instagram/Authentication'

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
}
