import Shopify from 'App/Services/Shopify'
import type { ToolHandler } from './types'

const getShippingInfo: ToolHandler = {
  definition: {
    name: 'getShippingInfo',
    description:
      "Donne le délai et le coût de livraison pour le PAYS du client, depuis les zones d'expédition Shopify (source de vérité). À utiliser pour toute question de délai/coût de livraison vers un pays précis. Passe le code pays ISO 3166-1 alpha-2 (ex: France→FR, Belgique→BE, Suisse→CH, Canada→CA, États-Unis→US). Si le client ne précise pas son pays et que ce n'est pas évident, demande-le-lui d'abord. Retourne la zone, le délai et le prix ; ou la liste des zones desservies si le pays n'est pas couvert.",
    input_schema: {
      type: 'object',
      properties: {
        country_code: {
          type: 'string',
          description:
            'Code pays ISO 3166-1 alpha-2 en majuscules (ex: "FR", "BE", "CH", "CA", "US").',
        },
      },
      required: ['country_code'],
    },
  },

  async execute(input: { country_code: string }): Promise<string> {
    const code = (input.country_code ?? '').trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(code)) {
      return JSON.stringify({
        error: 'country_code doit être un code ISO alpha-2 (2 lettres), ex: "FR".',
      })
    }

    const zones = await new Shopify().shipping.getZonesForBot()
    if (zones.length === 0) {
      return JSON.stringify({
        found: false,
        message:
          "Aucune zone d'expédition configurée. Préviens le client et propose de revenir vers lui.",
      })
    }

    const exact = zones.find((z) => z.countryCodes.includes(code))
    const zone = exact ?? zones.find((z) => z.restOfWorld)

    if (!zone) {
      return JSON.stringify({
        found: false,
        served_zones: zones.map((z) => ({ zone: z.zoneName, countries: z.countryCodes })),
        message: `Le pays ${code} n'est pas dans une zone desservie et il n'y a pas de zone "reste du monde". Indique honnêtement les zones où on livre, sans inventer de délai.`,
      })
    }

    return JSON.stringify({
      found: true,
      matched: exact ? 'country' : 'rest_of_world',
      zone: zone.zoneName,
      country_code: code,
      delay: zone.delay,
      shipping_price: zone.price,
      currency: zone.currency,
      note: zone.delay
        ? 'Le délai vient des réglages d’expédition Shopify (description de la méthode).'
        : "Pas de délai renseigné pour cette zone — ne l'invente pas ; dis que tu reviens vers le client si besoin.",
    })
  },
}

export default getShippingInfo
