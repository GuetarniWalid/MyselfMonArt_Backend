import Authentication from './Authentication'

export interface CodeDiscountSummary {
  /** GID du DiscountCodeNode. */
  id: string
  title: string
  /** ACTIVE | SCHEDULED | EXPIRED (statut Shopify). */
  status: string
  startsAt: string | null
  endsAt: string | null
}

export interface BasicCodeDiscountInput {
  title: string
  code: string
  /** Instants ABSOLUS ISO 8601 avec décalage — pas des dates nues. */
  startsAt: string
  endsAt: string
  /** Montant fixe déduit de la commande, ex. "15.0". */
  amount: string
  /** Sous-total minimum exigé, ex. "80.0". */
  minimumSubtotal: string
  appliesOncePerCustomer: boolean
}

export default class Discount extends Authentication {
  public async getDiscounts() {
    const { query } = this.getDiscountsQuery()
    const discountsData = await this.fetchGraphQL(query)
    const discountsDetails = discountsData.automaticDiscountNodes.nodes
    return discountsDetails
  }

  /**
   * Retrouve une remise à code par son code. `null` si elle n'existe pas.
   *
   * C'est l'outil de la RELECTURE obligatoire après création : `discountCodeBasicCreate`
   * peut renvoyer une erreur ET avoir tout de même créé la remise (bug Shopify confirmé par
   * son propre staff). On ne relance donc jamais en aveugle après une erreur — on relit, et
   * on décide d'après ce qu'on lit.
   */
  public async getCodeDiscountByCode(code: string): Promise<CodeDiscountSummary | null> {
    const query = `query CodeDiscountByCode($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        id
        codeDiscount {
          __typename
          ... on DiscountCodeBasic { title status startsAt endsAt }
        }
      }
    }`

    const data = await this.fetchGraphQL(query, { code })
    const node = data.codeDiscountNodeByCode
    if (!node?.codeDiscount) return null

    return {
      id: node.id,
      title: node.codeDiscount.title ?? '',
      status: node.codeDiscount.status ?? '',
      startsAt: node.codeDiscount.startsAt ?? null,
      endsAt: node.codeDiscount.endsAt ?? null,
    }
  }

  /**
   * Crée une remise à code « montant fixe sur la commande », avec sous-total minimum.
   *
   * Ne lève PAS sur `userErrors` : l'appelant doit toujours relire (cf.
   * `getCodeDiscountByCode`) avant d'en tirer une conclusion.
   *
   * Deux points non négociables :
   *
   *   • `combinesWith` : les trois à `false`. C'est ce réglage qui fait appliquer par
   *     Shopify LA MEILLEURE des deux remises face à une promotion automatique déjà en
   *     place. Une seule case à `true` et les remises s'ADDITIONNENT.
   *   • Aucun `usageLimit` global. Un quota épuisé creuserait un trou invisible : l'encart
   *     continuerait d'afficher un code que le checkout refuse. Le garde-fou est
   *     `appliesOncePerCustomer` combiné au sous-total minimum.
   *
   * Note API : `customerSelection` n'existe plus dans `DiscountCodeBasicInput` depuis les
   * versions récentes de l'Admin API (vérifié par introspection en 2025-07) — une remise à
   * code s'adresse par défaut à tous les clients.
   */
  public async createBasicCodeDiscount(
    input: BasicCodeDiscountInput
  ): Promise<{ id: string | null; userErrors: string[] }> {
    const mutation = `mutation CreateBasicCodeDiscount($discount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $discount) {
        codeDiscountNode { id }
        userErrors { field code message }
      }
    }`

    const data = await this.fetchGraphQL(mutation, {
      discount: {
        title: input.title,
        code: input.code,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        appliesOncePerCustomer: input.appliesOncePerCustomer,
        customerGets: {
          items: { all: true },
          value: { discountAmount: { amount: input.amount, appliesOnEachItem: false } },
        },
        minimumRequirement: {
          subtotal: { greaterThanOrEqualToSubtotal: input.minimumSubtotal },
        },
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
      },
    })

    return {
      id: data.discountCodeBasicCreate.codeDiscountNode?.id ?? null,
      userErrors: (data.discountCodeBasicCreate.userErrors ?? []).map(
        (e: { code?: string; message: string }) => `${e.code ?? ''} ${e.message}`.trim()
      ),
    }
  }

  /**
   * Désactive une remise à code (ménage de l'admin). Réservé aux remises expirées depuis
   * longtemps : aucun effet sur les commandes déjà passées.
   */
  public async deactivateCodeDiscount(id: string): Promise<string[]> {
    const mutation = `mutation DeactivateCodeDiscount($id: ID!) {
      discountCodeDeactivate(id: $id) {
        userErrors { field code message }
      }
    }`

    const data = await this.fetchGraphQL(mutation, { id })
    return (data.discountCodeDeactivate.userErrors ?? []).map(
      (e: { code?: string; message: string }) => `${e.code ?? ''} ${e.message}`.trim()
    )
  }

  private getDiscountsQuery() {
    return {
      query: ` {
                automaticDiscountNodes(first: 10, query: "status:ACTIVE") {
                  nodes {
                    automaticDiscount {
                      ... on DiscountAutomaticBasic {
                        startsAt
                        endsAt
                        shortSummary
                        title
                        customerGets {
                          value {
                            ... on DiscountAmount {
                              amount {
                                amount
                                currencyCode
                              }
                            }
                              ... on DiscountPercentage {
                                percentage
                              }
                          }
                        }
                      }
                    }                  
                  }
                }
              }`,
    }
  }
}
