import Env from '@ioc:Adonis/Core/Env'

/**
 * Handle Shopify de la fiche produit qui héberge le studio de personnalisation.
 * Le lien de reprise (?ca_job=) doit pointer dessus. Ce handle peut bouger (renommage
 * produit / SEO) — l'override env CUSTOM_ART_PRODUCT_HANDLE permet de le corriger sans
 * redéploiement si la fiche est renommée.
 *
 * NB : l'ancien placeholder `poster-personnalise-foot` n'existait pas sur la boutique
 * (404) — d'où le bouton « Reprendre ma création » cassé dans les emails.
 */
const DEFAULT_PRODUCT_HANDLE = 'poster-personnalise-foot-votre-enfant-en-joueur-de-legende'

/**
 * Lien de reprise du studio : fiche produit sur la boutique + paramètre ca_job
 * (le contrat front qui ré-ouvre la création). Partagé par SaveMailer / ReminderMailer
 * / MockupsReadyMailer pour garder un seul endroit où corriger le handle.
 */
export function buildCustomArtResumeUrl(jobUuid: string): string {
  const base = Env.get('STOREFRONT_URL') || Env.get('SHOPIFY_SHOP_URL')
  const handle = Env.get('CUSTOM_ART_PRODUCT_HANDLE') || DEFAULT_PRODUCT_HANDLE
  return `${base}/products/${handle}?ca_job=${jobUuid}`
}
