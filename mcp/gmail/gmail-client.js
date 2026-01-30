import { google } from 'googleapis'

export class GmailClient {
  constructor(oauth2Client, senderEmail = 'team@myselfmonart.com') {
    this.oauth2Client = oauth2Client
    this.senderEmail = senderEmail
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  }

  /**
   * Send an email via Gmail API
   * @param {Object} params - Email parameters
   * @param {string} params.to - Recipient email address
   * @param {string} params.subject - Email subject
   * @param {string} params.htmlBody - HTML content of the email
   * @param {string} [params.replyToMessageId] - Message ID if replying
   * @param {string} [params.threadId] - Thread ID if replying to existing thread
   * @returns {Promise<Object>} - Result with messageId
   */
  async sendEmail({ to, subject, htmlBody, replyToMessageId, threadId }) {
    try {
      const mimeMessage = this._buildMimeMessage(to, subject, htmlBody, replyToMessageId)
      const encodedMessage = this._encodeBase64Url(mimeMessage)

      const requestBody = {
        raw: encodedMessage,
      }

      if (threadId) {
        requestBody.threadId = threadId
      }

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody,
      })

      return {
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
      }
    } catch (error) {
      // Log full error for debugging
      console.error(
        '[GmailClient] Full error:',
        JSON.stringify(
          {
            code: error.code,
            status: error.status,
            message: error.message,
            errors: error.errors,
            response: error.response?.data,
          },
          null,
          2
        )
      )

      // Handle specific Gmail API errors
      if (error.code === 401) {
        throw new Error("Échec d'authentification Gmail. Vérifiez les credentials OAuth2.")
      }
      if (error.code === 403) {
        const details = error.errors?.[0]?.message || error.message || 'Unknown'
        throw new Error(`Accès refusé (403): ${details}`)
      }
      if (error.code === 429) {
        throw new Error('Quota Gmail dépassé. Réessayez plus tard.')
      }
      if (error.message && error.message.includes('invalid_grant')) {
        throw new Error(
          'Le refresh token est invalide ou expiré. Relancez la configuration OAuth2.'
        )
      }

      throw new Error(`Échec de l'envoi de l'email: ${error.message}`)
    }
  }

  /**
   * Build a MIME message string
   * @private
   */
  _buildMimeMessage(to, subject, htmlBody, replyToMessageId) {
    const headers = [
      `From: ${this.senderEmail}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: text/html; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
    ]

    // Add threading headers if replying
    if (replyToMessageId) {
      headers.push(`In-Reply-To: ${replyToMessageId}`)
      headers.push(`References: ${replyToMessageId}`)
    }

    const emailContent = [headers.join('\r\n'), '', Buffer.from(htmlBody).toString('base64')].join(
      '\r\n'
    )

    return emailContent
  }

  /**
   * Encode string to base64url format (Gmail API requirement)
   * @private
   */
  _encodeBase64Url(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
}
