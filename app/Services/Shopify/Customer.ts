import Authentication from './Authentication'

/** Les trois seuls états que `customerEmailMarketingConsentUpdate` accepte d'écrire. */
export type WritableMarketingState = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'PENDING'

export interface CustomerConsent {
  customerId: string
  email: string | null
  /** Peut aussi valoir NOT_SUBSCRIBED / REDACTED / INVALID en LECTURE. */
  marketingState: string
  marketingOptInLevel: string | null
  marketingUpdatedAt: string | null
}

/**
 * Accès au CLIENT Shopify — identité, langue et consentement marketing.
 *
 * ⚠️ ACCÈS EN TOLÉRANCE HÉRITÉE. La lecture de l'e-mail d'un client relève des « Custom
 * Level 2 PII apps », que la documentation réserve au plan Grow et supérieur. La boutique est
 * sur Basic et le jeton précède la mise en application : ça fonctionne, c'est vérifié, ce
 * n'est pas contractuel et c'est révocable sans préavis. Deux interdits en découlent :
 * ne JAMAIS désinstaller ni recréer l'app « Product Creator » (la création d'apps depuis
 * l'admin est fermée depuis le 2026-01-01), et jamais d'aller-retour de plan.
 *
 * Le jour où l'accès tombe, `fetchGraphQL` lève une `ShopifyGraphQLError` avec
 * `accessDenied = true` — traité comme une ALARME et jamais comme « client sans e-mail ».
 */
export default class Customer extends Authentication {
  /**
   * Crée OU met à jour un client, identifié par son e-mail.
   *
   * ⛔ Trois précautions, chacune payée par un incident connu :
   *
   *   • `customerSet` et jamais `customerCreate` : l'e-mail est unique chez Shopify, et
   *     `customerCreate` échoue sur doublon — or la moitié des inscrits sont déjà clients.
   *   • JAMAIS `tags` ni `addresses` : sur les champs listes, « all existing entries not
   *     included will be deleted ». Les transmettre effacerait l'adresse de livraison et la
   *     segmentation d'un client existant.
   *   • Le consentement n'est PAS passé ici : `CustomerSetInput` n'a pas de champ
   *     `emailMarketingConsent` (vérifié par introspection sur l'API 2025-07, contrairement à
   *     ce que laissait entendre le brief). Il se pose en seconde mutation, ci-dessous.
   */
  public async upsertByEmail(input: {
    email: string
    locale?: string
  }): Promise<{ customerId: string | null; userErrors: string[] }> {
    const mutation = `mutation NewsletterCustomerSet($identifier: CustomerSetIdentifiers, $input: CustomerSetInput!) {
      customerSet(identifier: $identifier, input: $input) {
        customer { id }
        userErrors { field code message }
      }
    }`

    const data = await this.fetchGraphQL(mutation, {
      identifier: { email: input.email },
      input: {
        email: input.email,
        ...(input.locale ? { locale: input.locale } : {}),
      },
    })

    return {
      customerId: data.customerSet?.customer?.id ?? null,
      userErrors: (data.customerSet?.userErrors ?? []).map(
        (e: { code?: string; message: string }) => `${e.code ?? ''} ${e.message}`.trim()
      ),
    }
  }

  /**
   * Ajoute des étiquettes à une fiche client — SANS écraser celles qui existent.
   *
   * ⛔ C'EST LA SEULE FAÇON CORRECTE DE POSER UNE ÉTIQUETTE ICI, et la raison tient en une
   * phrase : `customerSet` REMPLACE la liste `tags` au lieu de l'enrichir (« all existing
   * entries not included will be deleted »). Sur un client déjà connu — et la moitié des
   * inscrits le sont — passer `tags: ["promo-popup"]` à `customerSet` effacerait toute sa
   * segmentation existante. `tagsAdd` ajoute, et il est idempotent : réappliquer une étiquette
   * déjà posée ne fait rien.
   *
   * Ne lève pas : perdre une étiquette de segmentation ne doit pas coûter une inscription.
   */
  public async addTags(
    customerId: string,
    tags: string[]
  ): Promise<{ ok: boolean; userErrors: string[] }> {
    const mutation = `mutation NewsletterCustomerTagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }`

    const data = await this.fetchGraphQL(mutation, { id: customerId, tags })
    const userErrors = (data.tagsAdd?.userErrors ?? []).map(
      (e: { field?: string[]; message: string }) => e.message
    )

    return { ok: !!data.tagsAdd?.node?.id && userErrors.length === 0, userErrors }
  }

  /**
   * Écrit l'état de consentement marketing.
   *
   * ⛔ `consentUpdatedAt` n'est JAMAIS transmis. Le champ existe dans l'input, et le fournir
   * DÉCLENCHE les automatisations natives de Shopify. Shopify Flow est installée sur cette
   * boutique : un inscrit recevrait alors deux e-mails de bienvenue et deux offres. Au seuil
   * contractuel de 0,08 % de plaintes, c'est une suspension de compte d'envoi créée par une
   * ligne d'apparence anodine.
   *
   * `NOT_SUBSCRIBED`, `REDACTED` et `INVALID` ne sont pas écrivables par cette mutation — et
   * c'est tant mieux : un rebond ne doit surtout pas s'écrire ici (cf. `NewsletterConsent`).
   */
  public async setEmailMarketingConsent(input: {
    customerId: string
    marketingState: WritableMarketingState
    /** Omis sur un désabonnement : on ne redéclare pas un niveau d'opt-in en partant. */
    marketingOptInLevel?: 'SINGLE_OPT_IN' | 'CONFIRMED_OPT_IN'
  }): Promise<{ ok: boolean; userErrors: string[] }> {
    const mutation = `mutation NewsletterConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) {
        customer { id }
        userErrors { field code message }
      }
    }`

    const data = await this.fetchGraphQL(mutation, {
      input: {
        customerId: input.customerId,
        emailMarketingConsent: {
          marketingState: input.marketingState,
          ...(input.marketingOptInLevel ? { marketingOptInLevel: input.marketingOptInLevel } : {}),
          // ⛔ consentUpdatedAt VOLONTAIREMENT absent — voir l'en-tête de la méthode.
        },
      },
    })

    const userErrors = (data.customerEmailMarketingConsentUpdate?.userErrors ?? []).map(
      (e: { code?: string; message: string }) => `${e.code ?? ''} ${e.message}`.trim()
    )

    return {
      ok: !!data.customerEmailMarketingConsentUpdate?.customer?.id && userErrors.length === 0,
      userErrors,
    }
  }

  /**
   * Lit le consentement PAR IDENTIFIANT — jamais par recherche sur l'e-mail.
   *
   * ⛔ C'est le filtre d'avant-envoi, et il n'est JAMAIS mis en cache. Shopify n'est pas seul
   * écrivain de cet état (page de désabonnement native, admin, compte client, thème) et les
   * webhooks sont livrés « au moins une fois », sans garantie d'ordre : tout cache serait faux
   * tôt ou tard. Le coût est de 1 à 2 points de quota par lecture, pour un budget de 100
   * points/seconde — négligeable devant le risque d'écrire à quelqu'un qui s'est retiré.
   *
   * `null` = le client n'existe plus (supprimé, fusionné). Un e-mail à `null` accompagné d'un
   * hash `errors`, lui, ne passe jamais par ici : `fetchGraphQL` lève d'abord.
   */
  public async getConsentById(customerId: string): Promise<CustomerConsent | null> {
    const query = `query NewsletterConsentRead($id: ID!) {
      customer(id: $id) {
        id
        defaultEmailAddress {
          emailAddress
          marketingState
          marketingOptInLevel
          marketingUpdatedAt
        }
      }
    }`

    const data = await this.fetchGraphQL(query, { id: customerId })
    const node = data.customer
    if (!node) return null

    const address = node.defaultEmailAddress
    return {
      customerId: node.id,
      email: address?.emailAddress ?? null,
      // Pas d'adresse par défaut = pas d'abonnement possible. On répond par un état non
      // envoyable plutôt que par `null`, pour que l'appelant n'ait qu'une seule règle à tenir :
      // « envoyer si et seulement si SUBSCRIBED ».
      marketingState: address?.marketingState ?? 'NOT_SUBSCRIBED',
      marketingOptInLevel: address?.marketingOptInLevel ?? null,
      marketingUpdatedAt: address?.marketingUpdatedAt ?? null,
    }
  }

  /**
   * Recherche NON MUTANTE par e-mail : « cette adresse est-elle déjà connue, et dans quel
   * état de consentement ? »
   *
   * ⛔ C'EST LA LECTURE AVANT ÉCRITURE, et c'est le garde-fou le plus important de
   * l'inscription. Sans elle, `customerSet` suivi d'un `SUBSCRIBED` inconditionnel
   * RESSUSCITE quiconque s'était désabonné : il suffit qu'un tiers saisisse son adresse dans
   * l'encart. Cette personne reçoit alors une offre commerciale après avoir demandé à ne plus
   * en recevoir — c'est-à-dire le scénario qui produit une plainte, et une plainte à ce
   * volume représente dix fois le seuil contractuel de SES.
   *
   * Elle passe AVANT `customerSet` et non après : `customerSet` créerait déjà une fiche
   * client (et écraserait `locale`) pour une adresse qu'on s'apprête peut-être à refuser.
   *
   * ⚠️ La recherche de Shopify est TOKENISÉE, pas une égalité : `email:jean@x.fr` peut
   * remonter une adresse voisine. On recompare donc caractère par caractère avant de
   * conclure — sinon on lirait le consentement de quelqu'un d'autre.
   */
  public async findConsentByEmail(email: string): Promise<CustomerConsent | null> {
    // L'e-mail vient d'une saisie publique et part dans la syntaxe de recherche de Shopify :
    // un guillemet non filtré y changerait le sens de la requête.
    const normalized = email.trim().toLowerCase()
    const safe = normalized.replace(/["\\]/g, '')
    if (!safe) return null

    const query = `query NewsletterFindCustomer($q: String!) {
      customers(first: 5, query: $q) {
        edges {
          node {
            id
            defaultEmailAddress {
              emailAddress
              marketingState
              marketingOptInLevel
              marketingUpdatedAt
            }
          }
        }
      }
    }`

    const data = await this.fetchGraphQL(query, { q: `email:"${safe}"` })
    const edges = data.customers?.edges ?? []

    for (const edge of edges) {
      const node = edge?.node
      const address = node?.defaultEmailAddress
      const found = (address?.emailAddress ?? '').trim().toLowerCase()
      if (!node || found !== normalized) continue

      return {
        customerId: node.id,
        email: address.emailAddress,
        marketingState: address.marketingState ?? 'NOT_SUBSCRIBED',
        marketingOptInLevel: address.marketingOptInLevel ?? null,
        marketingUpdatedAt: address.marketingUpdatedAt ?? null,
      }
    }

    return null
  }

  /**
   * Retrouve un client par son e-mail — UNIQUEMENT pour rattraper un `shopifyCustomerId`
   * perdu (inscription faite pendant une panne d'API). Le chemin normal est `getConsentById`.
   */
  public async findIdByEmail(email: string): Promise<string | null> {
    const found = await this.findConsentByEmail(email)
    return found?.customerId ?? null
  }
}
