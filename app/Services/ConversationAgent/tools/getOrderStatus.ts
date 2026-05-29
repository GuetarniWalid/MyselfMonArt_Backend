import Shopify from 'App/Services/Shopify'
import { DateTime } from 'luxon'
import type { ToolHandler } from './types'

const DEFAULT_DELAY_DAYS = 10
const DEFAULT_BUSINESS = true

// Parse a Shopify delay string ("10 jours ouvrés", "2 à 4 jours ouvrables")
// into a day count + whether it counts business days. For a range, take the
// max so a delivery is only flagged late once the upper bound has passed.
function parseDelay(text: string | null): { days: number; business: boolean } {
  if (!text) return { days: DEFAULT_DELAY_DAYS, business: DEFAULT_BUSINESS }
  const nums = (text.match(/\d+/g) ?? []).map(Number)
  const days = nums.length ? Math.max(...nums) : DEFAULT_DELAY_DAYS
  const business = /ouvr/i.test(text) // "ouvrés" / "ouvrables"
  return { days, business }
}

// Add N days to a date, skipping Saturdays/Sundays when business=true.
// (Public holidays are ignored — acceptable approximation for an estimate.)
function addDays(start: DateTime, n: number, business: boolean): DateTime {
  if (!business) return start.plus({ days: n })
  let d = start
  let added = 0
  while (added < n) {
    d = d.plus({ days: 1 })
    if (d.weekday <= 5) added++ // luxon: 1=Mon..7=Sun
  }
  return d
}

const getOrderStatus: ToolHandler = {
  definition: {
    name: 'getOrderStatus',
    description:
      "Retrouve le statut, le suivi ET la date de livraison estimée d'une commande À PARTIR de l'email du client OU de son numéro de commande. Vérification d'identité STRICTE : n'appelle ce tool QUE lorsque le client a fourni son email ou son numéro — un simple nom ne suffit PAS. Sinon, demande d'abord poliment l'email ou le numéro. Si le champ is_overdue=true, la date estimée est dépassée : présente des excuses, dis qu'on enquête et qu'on revient vers lui au plus vite, et appelle escalateToHuman. Ne révèle jamais l'adresse de livraison.",
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email fourni par le client.' },
        order_number: {
          type: 'string',
          description: 'Numéro de commande fourni (ex: "1801" ou "#1801").',
        },
      },
    },
  },

  async execute(input: { email?: string; order_number?: string }): Promise<string> {
    if (!input.email && !input.order_number) {
      return JSON.stringify({
        ok: false,
        message:
          "Aucun identifiant fourni. Demande l'email ou le numéro de commande avant d'appeler ce tool — ne devine pas.",
      })
    }

    const shopify = new Shopify()
    const order = await shopify.order.findForCustomer({
      email: input.email,
      orderNumber: input.order_number,
    })

    if (!order) {
      return JSON.stringify({
        found: false,
        message:
          "Aucune commande trouvée avec cet email/numéro. Demande gentiment de vérifier l'email utilisé ou le numéro exact, sans révéler d'autres infos.",
      })
    }

    // Estimate the delivery date in code: order date + the zone's delay.
    const zones = await shopify.shipping.getZonesForBot().catch(() => [])
    const zone = order.countryCode
      ? zones.find((z) => z.countryCodes.includes(order.countryCode!)) ??
        zones.find((z) => z.restOfWorld)
      : undefined
    const { days, business } = parseDelay(zone?.delay ?? null)

    const orderedAt = DateTime.fromISO(order.createdAt)
    const estimated = addDays(orderedAt, days, business)
    const isOverdue = DateTime.now() > estimated

    // The follow link we give the customer is Shopify's own order status page:
    // localized to the order's language, branded (shop domain), and it links to
    // the REAL carrier tracking that Shopify resolved (no guessing carrier URLs).
    const followUrl = order.statusPageUrl

    return JSON.stringify({
      found: true,
      order_number: order.name,
      ordered_on: orderedAt.toISODate(),
      fulfillment_status: order.fulfillmentStatus,
      payment_status: order.financialStatus,
      items: order.itemTitles,
      carrier: order.tracking[0]?.company ?? null,
      follow_order_url: followUrl,
      estimated_delivery_date: estimated.toISODate(),
      delay_used: `${days} jours ${business ? 'ouvrés' : 'calendaires'}`,
      is_overdue: isOverdue,
      note: isOverdue
        ? "Date estimée DÉPASSÉE : excuses sincères + rappelle avec délicatesse que nos œuvres sont fabriquées SUR MESURE (pas en stock), ce qui fait leur valeur et peut allonger les délais ; dis que tu enquêtes et que l'équipe revient au plus vite ; appelle escalateToHuman (reason='commande_en_retard'). Ne promets pas de délai précis."
        : "Donne un statut clair et rassurant + la date estimée. Pour le suivi, partage follow_order_url (page de suivi de la commande, déjà dans la bonne langue, avec le lien transporteur). Ne révèle jamais l'adresse.",
    })
  },
}

export default getOrderStatus
