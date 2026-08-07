import Authentication from './Authentication'

/**
 * ⛔ VERSION D'API ÉPINGLÉE — 2026-07 MINIMUM, ET CE N'EST PAS NÉGOCIABLE.
 *
 * `context.markets` (l'éligibilité par marché d'un code de remise) n'existe QU'À PARTIR de
 * 2026-07. Vérifié par introspection sur cette boutique le 2026-08-06 :
 *
 *     2025-10 → DiscountContextInput { all, customers, customerSegments }
 *     2026-07 → DiscountContextInput { all, customers, customerSegments, markets }   ✅
 *
 * En dessous, non seulement la mutation ignorerait le ciblage, mais les codes portant une
 * éligibilité marché deviennent INVISIBLES en lecture : on ne pourrait plus ni les vérifier ni
 * les supprimer.
 *
 * ⚠️ On épingle ICI plutôt que de faire glisser `SHOPIFY_API_VERSION` : cette variable sert à
 * tout le back-end (publication produit, traductions, webhooks, métachamps), et la déplacer
 * pour ce seul besoin exposerait l'ensemble à des changements de rupture qu'aucun test ne
 * couvre. La variable d'environnement, elle, vaut encore `admin/api/2025-07` — une version que
 * Shopify ne sert même plus (elle est silencieusement servie en 2025-10).
 */
const DISCOUNT_API_VERSION = 'admin/api/2026-07'

export interface CodeDiscountSummary {
  /** GID du DiscountCodeNode. */
  id: string
  title: string
  /** ACTIVE | SCHEDULED | EXPIRED (statut Shopify). */
  status: string
  startsAt: string | null
  endsAt: string | null
  /**
   * Nombre d'utilisations comptabilisées. « async » parce que Shopify l'incrémente en différé :
   * il peut donc RETARDER sur la réalité, jamais l'inventer. On ne s'en sert que dans le sens
   * sûr — « > 0 donc la personne a acheté, on arrête la séquence ». Le lire à 0 ne prouve rien
   * et ne déclenche donc aucune décision.
   */
  asyncUsageCount: number
  /** Quota total du code. `null` = illimité (cas du code public hebdomadaire). */
  usageLimit: number | null
  /**
   * Type d'éligibilité effectivement enregistré par Shopify : `DiscountMarkets` quand le code
   * est restreint à des marchés, `DiscountBuyerSelectionAll` quand il est ouvert à tous.
   *
   * C'est le TÉMOIN du ciblage : si un code censé être restreint se relit en
   * `DiscountBuyerSelectionAll`, le ciblage n'a pas pris et le bon est mal calibré.
   */
  contextType: string | null
  /** Identifiants des marchés éligibles, vide quand le code est ouvert à tous. */
  marketIds: string[]
}

/** Un marché de la boutique : ce qu'il faut pour cibler un bon ET pour composer ses liens. */
export interface MarketSummary {
  id: string
  name: string
  handle: string
  /** ACTIVE | DRAFT — seuls les marchés actifs sont ciblables utilement. */
  status: string
  /** Devise de base du marché : c'est elle qui regroupe. */
  currencyCode: string | null
  /** Codes pays ISO explicitement rattachés. Vide = marché sans région déclarée. */
  countries: string[]
  /** Langue de la vitrine de ce marché quand la langue demandée n'y existe pas. */
  defaultLocale: string | null
  /**
   * Langue → PRÉFIXE DE CHEMIN de la vitrine (`''` pour la racine, `/en-us`, `/fr-ca`…).
   *
   * ⛔ Lu chez Shopify, jamais deviné. `/{langue}-{pays}` n'est PAS une règle : au 2026-08-07
   * `/de-us`, `/es-eu` et `/nl-ca` n'existent pas, alors que le motif les rendrait plausibles.
   * Un préfixe inventé mène à un 404, et personne ne le voit avant le client.
   */
  prefixes: Record<string, string>
}

/** Les marchés, plus l'indication de celui qui recueille les pays non listés. */
export interface MarketsSnapshot {
  /** Handle du marché primaire — celui où Shopify range tout pays sans marché explicite. */
  primaryHandle: string | null
  markets: MarketSummary[]
}

/**
 * `rootUrls` → table langue → préfixe de chemin.
 *
 * Shopify rend des URL absolues avec barre finale (`https://www.myselfmonart.com/en-us/`) ;
 * ce qui sert à composer un lien est le CHEMIN, sans la barre — `''` pour la racine, qui est le
 * marché primaire dans sa langue source.
 */
function rootUrlPrefixes(rootUrls: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of Array.isArray(rootUrls) ? rootUrls : []) {
    const locale = String(entry?.locale ?? '').trim()
    if (!locale) continue
    try {
      out[locale] = new URL(String(entry?.url)).pathname.replace(/\/+$/, '')
    } catch {
      // URL illisible : ce marché n'aura pas de préfixe pour cette langue, et la résolution
      // retombera sur sa langue par défaut puis sur le marché primaire. Jamais un lien inventé.
    }
  }
  return out
}

/** Une promotion automatique en pourcentage, telle que Shopify la déclare. */
export interface AutomaticPercentageSummary {
  title: string
  /** ACTIVE | SCHEDULED | EXPIRED. */
  status: string
  /** Échéance ISO 8601, ou `null` quand la promotion n'en a pas. */
  endsAt: string | null
  /** Part de remise en FRACTION : 0,1 pour −10 %. */
  percentage: number
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
  /**
   * Quota TOTAL du code, toutes personnes confondues. À laisser absent pour le code public
   * hebdomadaire (un quota épuisé y creuserait un trou invisible : l'encart continuerait
   * d'afficher un code que le checkout refuse).
   *
   * À poser à 1 pour un code NOMINATIF, où c'est au contraire la garantie recherchée :
   * « une seule fois » devient infalsifiable, là où `appliesOncePerCustomer` seul se contourne
   * avec une deuxième adresse.
   */
  usageLimit?: number
  /**
   * Marchés auxquels le code est RESTREINT. Absent ou vide = ouvert à tous (`{ all: ALL }`),
   * ce que veut le code public hebdomadaire.
   *
   * ⛔ Indispensable dès qu'un code porte un montant fixe calibré pour une devise : sans
   * restriction, un Américain pourrait utiliser le code calibré pour l'euro.
   *
   * ⛔ ET N'UTILISE JAMAIS `context.customers` EN MÊME TEMPS. Les types d'éligibilité
   * s'excluent mutuellement chez Shopify : rattacher le code à une fiche client rendrait le
   * ciblage par marché impossible. Le caractère « nominatif » d'un bon vient de sa chaîne
   * aléatoire et de `usageLimit: 1`, jamais d'un rattachement client.
   */
  marketIds?: string[]
}

export default class Discount extends Authentication {
  constructor() {
    super(DISCOUNT_API_VERSION)
  }

  public async getDiscounts() {
    const { query } = this.getDiscountsQuery()
    const discountsData = await this.fetchGraphQL(query)
    const discountsDetails = discountsData.automaticDiscountNodes.nodes
    return discountsDetails
  }

  /**
   * Les promotions AUTOMATIQUES en pourcentage actuellement actives.
   *
   * Sert au « point d'honnêteté » du 3ᵉ e-mail, qui annonce à partir de quel panier la
   * promotion en cours devient plus avantageuse que le bon. Ce seuil se calcule
   * (montant du bon ÷ taux) et ne peut donc pas être écrit en dur : la promotion du moment a
   * une date de fin, et un seuil figé continuerait d'annoncer une offre disparue.
   *
   * Seul le POURCENTAGE est remonté : une remise automatique à montant fixe n'a pas de point de
   * croisement — elle bat le bon partout ou nulle part.
   */
  public async getActiveAutomaticPercentages(): Promise<AutomaticPercentageSummary[]> {
    const query = `query NewsletterActiveAutomatic {
      automaticDiscountNodes(first: 25, query: "status:active") {
        nodes {
          automaticDiscount {
            __typename
            ... on DiscountAutomaticBasic {
              title
              status
              endsAt
              customerGets { value { ... on DiscountPercentage { percentage } } }
            }
          }
        }
      }
    }`

    const data = await this.fetchGraphQL(query)
    const nodes = data?.automaticDiscountNodes?.nodes ?? []

    return nodes
      .map((node: any) => node?.automaticDiscount)
      .filter((promo: any) => promo && typeof promo.customerGets?.value?.percentage === 'number')
      .map((promo: any) => ({
        title: String(promo.title ?? ''),
        status: String(promo.status ?? ''),
        endsAt: promo.endsAt ?? null,
        percentage: Number(promo.customerGets.value.percentage),
      }))
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
          ... on DiscountCodeBasic {
            title status startsAt endsAt asyncUsageCount usageLimit
            context {
              __typename
              ... on DiscountMarkets { markets(first: 20) { nodes { id } } }
            }
          }
        }
      }
    }`

    const data = await this.fetchGraphQL(query, { code })
    const node = data.codeDiscountNodeByCode
    if (!node?.codeDiscount) return null

    const context = node.codeDiscount.context
    return {
      id: node.id,
      title: node.codeDiscount.title ?? '',
      status: node.codeDiscount.status ?? '',
      startsAt: node.codeDiscount.startsAt ?? null,
      endsAt: node.codeDiscount.endsAt ?? null,
      asyncUsageCount: node.codeDiscount.asyncUsageCount ?? 0,
      usageLimit: node.codeDiscount.usageLimit ?? null,
      contextType: context?.__typename ?? null,
      marketIds: (context?.markets?.nodes ?? [])
        .map((m: { id?: string }) => m?.id)
        .filter((id: unknown): id is string => typeof id === 'string'),
    }
  }

  /**
   * Marchés de la boutique — c'est la source du ciblage par devise.
   *
   * ⛔ À interroger, jamais à coder en dur : une liste figée ferait sortir du dispositif, EN
   * SILENCE, tout marché créé plus tard. Le marché ouvert le lendemain recevrait des bons
   * inutilisables sans qu'aucun journal ne signale quoi que ce soit.
   */
  public async getMarketsSnapshot(): Promise<MarketsSnapshot> {
    const query = `query NewsletterMarkets {
      primaryMarket { handle }
      markets(first: 100) {
        nodes {
          id
          name
          handle
          status
          currencySettings { baseCurrency { currencyCode } }
          conditions {
            regionsCondition {
              regions(first: 250) { nodes { ... on MarketRegionCountry { code } } }
            }
          }
          webPresence {
            defaultLocale { locale }
            rootUrls { url locale }
          }
        }
      }
    }`

    const data = await this.fetchGraphQL(query)

    return {
      primaryHandle: data.primaryMarket?.handle ?? null,
      markets: (data.markets?.nodes ?? []).map((node: any) => ({
        id: node?.id ?? '',
        name: node?.name ?? '',
        handle: node?.handle ?? '',
        status: node?.status ?? '',
        currencyCode: node?.currencySettings?.baseCurrency?.currencyCode ?? null,
        countries: (node?.conditions?.regionsCondition?.regions?.nodes ?? [])
          .map((region: any) => String(region?.code ?? '').toUpperCase())
          .filter((code: string) => /^[A-Z]{2}$/.test(code)),
        defaultLocale: node?.webPresence?.defaultLocale?.locale ?? null,
        prefixes: rootUrlPrefixes(node?.webPresence?.rootUrls),
      })),
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
   *   • `usageLimit` est un CHOIX D'APPELANT, pas un réglage par défaut. Le code public
   *     hebdomadaire n'en a aucun (un quota épuisé y creuserait un trou invisible : l'encart
   *     continuerait d'afficher un code que le checkout refuse) ; un code nominatif en a
   *     toujours un, à 1.
   *
   * Note API : `customerSelection` a été REMPLACÉ par `context` dans `DiscountCodeBasicInput`
   * (Admin API 2025-07). Le champ n'est pas optionnel malgré ce que laisse croire le schéma :
   * l'omettre fait échouer la mutation sur « BLANK Context can't be blank ». `{ all: ALL }`
   * est la traduction exacte de l'ancien `customerSelection: { all: true }`.
   *
   * `context` accepte AU PLUS UNE forme d'éligibilité : `{ markets: { add: [...] } }` quand le
   * code est restreint, `{ all: ALL }` sinon. Les deux ensemble sont refusés.
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
        ...(input.usageLimit === undefined ? {} : { usageLimit: input.usageLimit }),
        // Éligibilité — obligatoire, et exactement UNE forme à la fois : restreinte aux
        // marchés de la devise du bon, ou ouverte à tous (ex-`customerSelection: { all: true }`).
        context: input.marketIds?.length ? { markets: { add: input.marketIds } } : { all: 'ALL' },
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
