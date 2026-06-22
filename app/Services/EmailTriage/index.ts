import Authentication from 'App/Services/Claude/Authentication'

export type EmailCategory =
  | 'client_sav'
  | 'backlink'
  | 'pro_autre'
  | 'newsletter_promo'
  | 'notification'
  | 'spam'

export type TriageAction = 'engage' | 'skip' | 'escalate'

export interface TriageResult {
  category: EmailCategory
  action: TriageAction
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const SKIP: EmailCategory[] = ['newsletter_promo', 'notification', 'spam']
const ESCALATE: EmailCategory[] = ['backlink', 'pro_autre']
const KNOWN: EmailCategory[] = [
  'client_sav',
  'backlink',
  'pro_autre',
  'newsletter_promo',
  'notification',
  'spam',
]

/**
 * Cheap first-pass classifier (Haiku) for the email firehose: decides whether a
 * message is a real customer to answer, a pro solicitation to escalate, or
 * noise to skip — before spending the full Sonnet SAV agent on a Stripe receipt.
 */
export default class EmailTriage extends Authentication {
  public async classify(subject: string, body: string, fromEmail: string): Promise<TriageResult> {
    const prompt = `Tu tries les emails entrants de la boutique MyselfMonArt (art mural / déco). Classe CET email dans UNE seule catégorie :
- client_sav : (potentiel) client — question produit, commande, livraison, retour, remboursement, réclamation, conseil déco.
- backlink : démarchage SEO, échange/achat de lien, "guest post", proposition d'article sponsorisé sur le blog.
- pro_autre : autre sollicitation pro qui n'est PAS un client (fournisseur, presse, influenceur, agence, collaboration).
- newsletter_promo : newsletter, publicité, marketing entrant.
- notification : email automatique (reçu Stripe/Shopify/PayPal, notification de plateforme, no-reply).
- spam : spam évident, arnaque, phishing, totalement hors-sujet.

En cas de doute entre client_sav et une autre catégorie, choisis client_sav.
Réponds UNIQUEMENT avec un JSON sur une ligne : {"category":"<catégorie>"}.

De : ${fromEmail}
Objet : ${subject}
Corps :
${(body || '').slice(0, 2000)}`

    try {
      const res = await this.anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 40,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = res.content
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
      const match = text.match(/\{[\s\S]*\}/)
      const parsed = (match ? JSON.parse(match[0]).category : 'client_sav') as EmailCategory
      const category = KNOWN.includes(parsed) ? parsed : 'client_sav'
      return { category, action: this.actionFor(category) }
    } catch (err: any) {
      // On failure, prefer answering a real client over silently skipping.
      console.error('⚠️  EmailTriage failed, defaulting to engage:', err?.message ?? err)
      return { category: 'client_sav', action: 'engage' }
    }
  }

  private actionFor(category: EmailCategory): TriageAction {
    if (SKIP.includes(category)) return 'skip'
    if (ESCALATE.includes(category)) return 'escalate'
    return 'engage'
  }
}
