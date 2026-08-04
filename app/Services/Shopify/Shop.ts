import Authentication from './Authentication'

export interface ShopContext {
  /** GID de la boutique — owner des métachamps de boutique. */
  id: string
  /** Fuseau IANA configuré dans l'admin, ex. "Europe/Paris". */
  ianaTimezone: string
}

/**
 * Accès aux données de la BOUTIQUE elle-même (owner `SHOP`) : identité, fuseau, et
 * métachamps de boutique — le canal par lequel le back-end pilote le thème sans jamais
 * écrire un fichier de thème.
 */
export default class Shop extends Authentication {
  /**
   * Identité + fuseau, lus depuis la boutique plutôt que codés en dur : le fuseau décide
   * de l'instant réel d'expiration des remises, et il n'a pas à être dupliqué ici.
   */
  public async getContext(): Promise<ShopContext> {
    const data = await this.fetchGraphQL(`{ shop { id ianaTimezone } }`)
    return { id: data.shop.id, ianaTimezone: data.shop.ianaTimezone }
  }

  /**
   * Crée une définition de métachamp de boutique. Idempotent : l'erreur « déjà pris »
   * (TAKEN) est un succès.
   *
   * La définition n'est pas indispensable pour lire la valeur en Liquid (les métachamps y
   * sont toujours accessibles), mais elle rend la valeur visible et corrigeable à la main
   * dans l'admin — coût nul, confort réel.
   *
   * Volontairement sans `access: { storefront: PUBLIC_READ }` : inutile en Liquid (ce
   * réglage ne concerne que la Storefront API), et c'est un réglage de moins à maintenir.
   */
  public async ensureMetafieldDefinition(input: {
    namespace: string
    key: string
    name: string
    type: string
    description?: string
  }): Promise<{ id: string | null; alreadyExisted: boolean; errors: string[] }> {
    const mutation = `mutation CreateShopDef($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { field message code }
      }
    }`

    const response = await this.fetchGraphQL(mutation, {
      definition: {
        namespace: input.namespace,
        key: input.key,
        name: input.name,
        type: input.type,
        ownerType: 'SHOP',
        ...(input.description ? { description: input.description } : {}),
      },
    })

    const userErrors: Array<{ message: string; code?: string }> =
      response.metafieldDefinitionCreate.userErrors ?? []
    const alreadyExisted = userErrors.some((e) => e.code === 'TAKEN')

    return {
      id: response.metafieldDefinitionCreate.createdDefinition?.id ?? null,
      alreadyExisted,
      errors: alreadyExisted ? [] : userErrors.map((e) => `${e.code ?? ''} ${e.message}`.trim()),
    }
  }

  /**
   * Lit plusieurs métachamps de boutique d'un coup.
   *
   * ⚠️ Les clés sont interpolées dans la requête (les alias GraphQL n'acceptent pas de
   * variables) : réservé à des clés littérales du code, jamais à une entrée utilisateur.
   */
  public async getMetafields(
    namespace: string,
    keys: string[]
  ): Promise<Record<string, string | null>> {
    const fields = keys
      .map((key, i) => `k${i}: metafield(namespace: "${namespace}", key: "${key}") { key value }`)
      .join('\n        ')

    const data = await this.fetchGraphQL(`{ shop { ${fields} } }`)

    const out: Record<string, string | null> = {}
    keys.forEach((key, i) => {
      out[key] = data.shop[`k${i}`]?.value ?? null
    })
    return out
  }
}
