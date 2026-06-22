import { DateTime } from 'luxon'
import Shopify from 'App/Services/Shopify'
import { SavAgentConfig } from '../config'
import type { ToolHandler, ToolContext } from './types'

async function escalate(context: ToolContext, reason: string, summary: string): Promise<void> {
  const { conversation } = context
  conversation.status = 'escalated'
  conversation.escalatedAt = DateTime.now()
  conversation.escalationReason = reason.slice(0, 190)
  const metadata = conversation.metadata ?? {}
  metadata.escalation_summary = summary
  conversation.metadata = metadata
  await conversation.save()
}

const updateOrderAddress: ToolHandler = {
  definition: {
    name: 'updateOrderAddress',
    description:
      "Corrige l'adresse de livraison d'une commande. Vérification d'identité STRICTE : exige l'email OU le numéro de commande du client. Exige aussi la nouvelle adresse complète (rue, ville, code postal, code pays ISO). N'appelle ce tool QUE quand le client a fourni un identifiant ET l'adresse complète — sinon demande-lui d'abord poliment ce qui manque. La correction n'est possible que tant que la commande n'est pas expédiée ; le tool gère ce contrôle et l'escalade vers l'équipe quand c'est nécessaire. Ne dis jamais au client que c'est 'déjà fait' avant que le résultat du tool ne le confirme (champ updated:true).",
    input_schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: "Email fourni par le client (vérification d'identité).",
        },
        order_number: {
          type: 'string',
          description: 'Numéro de commande (ex: "1801" ou "#1801").',
        },
        address1: { type: 'string', description: 'Numéro + rue de la nouvelle adresse.' },
        address2: { type: 'string', description: "Complément d'adresse (optionnel)." },
        city: { type: 'string', description: 'Ville.' },
        zip: { type: 'string', description: 'Code postal.' },
        country_code: {
          type: 'string',
          description: 'Code pays ISO 3166-1 alpha-2 (FR, BE, CH, CA, US...).',
        },
        province_code: {
          type: 'string',
          description: 'Code région/état pour les pays qui en ont besoin (US, CA). Optionnel.',
        },
      },
      required: ['address1', 'city', 'zip', 'country_code'],
    },
  },

  async execute(
    input: {
      email?: string
      order_number?: string
      address1: string
      address2?: string
      city: string
      zip: string
      country_code: string
      province_code?: string
    },
    context
  ): Promise<string> {
    if (!input.email && !input.order_number) {
      return JSON.stringify({
        ok: false,
        message:
          "Identité non vérifiée. Demande d'abord l'email OU le numéro de commande avant toute modification d'adresse — ne devine pas.",
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
          "Aucune commande trouvée avec cet email/numéro. Demande gentiment de vérifier l'email utilisé à l'achat ou le numéro exact.",
      })
    }

    // Block once shipped (FULFILLED or PARTIALLY_FULFILLED) — too late to change.
    const ff = (order.fulfillmentStatus || '').toUpperCase()
    if (ff.includes('FULFILLED')) {
      await escalate(
        context,
        'changement_adresse_apres_expedition',
        `Le client veut corriger l'adresse de la commande ${order.name}, mais elle est déjà (partiellement) expédiée.`
      )
      return JSON.stringify({
        ok: false,
        shipped: true,
        order_number: order.name,
        message:
          "La commande semble déjà expédiée : tu ne peux pas modifier l'adresse. Présente des excuses sincères, explique qu'on va voir avec le transporteur ce qui est possible, et dis qu'un membre de l'équipe revient vers lui rapidement. (équipe déjà prévenue)",
      })
    }

    const address = {
      address1: input.address1,
      address2: input.address2,
      city: input.city,
      zip: input.zip,
      countryCode: String(input.country_code).toUpperCase(),
      provinceCode: input.province_code ? String(input.province_code).toUpperCase() : undefined,
    }

    // Draft-first phase: never mutate the order automatically — escalate so a
    // human applies the correction after reviewing the reply draft.
    if (!SavAgentConfig.orderAddressMutationEnabled) {
      await escalate(
        context,
        'changement_adresse',
        `Le client demande de corriger l'adresse de livraison de la commande ${order.name} en : ` +
          `${address.address1}${address.address2 ? ', ' + address.address2 : ''}, ${address.city} ${address.zip} ${address.countryCode}.`
      )
      return JSON.stringify({
        ok: true,
        escalated: true,
        updated: false,
        order_number: order.name,
        message:
          "Demande transmise à l'équipe pour appliquer la correction avant l'expédition (validation humaine). Confirme au client avec naturel qu'on s'en occupe et qu'on revient vite vers lui ; NE dis PAS que c'est déjà fait.",
      })
    }

    // Execution mode (Phase 4+): actually update the Shopify order.
    try {
      await shopify.order.updateShippingAddress(order.id, address)
    } catch (err: any) {
      await escalate(
        context,
        'changement_adresse_echec',
        `Échec de la modification automatique de l'adresse pour ${order.name} : ${err?.message ?? err}`
      )
      return JSON.stringify({
        ok: false,
        updated: false,
        order_number: order.name,
        message:
          "La modification automatique a échoué ; l'équipe va s'en charger. Rassure le client et dis qu'on revient vers lui rapidement. (équipe déjà prévenue)",
      })
    }

    return JSON.stringify({
      ok: true,
      updated: true,
      order_number: order.name,
      message:
        'Adresse de livraison mise à jour avec succès. Confirme au client que la nouvelle adresse a bien été enregistrée pour la commande ' +
        order.name +
        '.',
    })
  },
}

export default updateOrderAddress
