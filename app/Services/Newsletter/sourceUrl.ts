/**
 * Lecture de `source_url` — module PUR, pour que les tests dorés puissent le charger sans
 * monter l'application.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE SÉPARÉMENT. `source_url` est une donnée SOUMISE PAR LE
 * NAVIGATEUR sur un point d'entrée public et non authentifié, et ce qu'on en tire finit en
 * IMAGE et en TITRE dans un e-mail signé MyselfMonArt. Sans filtre de domaine, n'importe qui
 * posterait une URL étrangère et ferait afficher le visuel de son choix dans un message
 * portant la marque. C'est le genre de règle qui doit être testée hors ligne, pas au milieu
 * d'un service qui parle à Shopify.
 */

/**
 * Extrait le handle produit d'une `source_url`. `null` dès que ce n'est pas une fiche produit
 * de la boutique.
 *
 * Tolérant sur la forme, strict sur l'origine : l'URL porte selon les cas un préfixe de langue
 * (`/de/products/…`), un chemin de collection, une variante (`?variant=…`), des paramètres de
 * campagne. Mais elle doit venir de `myselfmonart.com`, et le handle doit avoir la forme d'un
 * handle Shopify.
 *
 * `null` est un cas NORMAL, pas une erreur : une inscription depuis la page d'accueil ou une
 * collection n'a pas de produit, et le gabarit supprime alors le bloc entier.
 */
export function extractHandle(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null

  let url: URL
  try {
    url = new URL(String(sourceUrl))
  } catch {
    return null
  }

  // ⛔ LA PORTE PRINCIPALE. `endsWith('myselfmonart.com')` ne suffirait pas :
  // `myselfmonart.com.evil.example` le satisferait. On exige le domaine exact ou un
  // sous-domaine, d'où le `(^|\.)` ancré en fin de chaîne.
  if (!/(^|\.)myselfmonart\.com$/i.test(url.hostname)) return null

  const match = /\/products\/([^/?#]+)/.exec(url.pathname)
  if (!match) return null

  let handle: string
  try {
    handle = decodeURIComponent(match[1]).trim().toLowerCase()
  } catch {
    // Séquence d'échappement invalide : ce n'est pas un handle.
    return null
  }

  // Un handle Shopify n'est fait que de minuscules, de chiffres et de tirets. Tout le reste est
  // suspect, et un handle de 300 caractères ne correspond à rien de réel.
  return /^[a-z0-9-]{1,255}$/.test(handle) ? handle : null
}

/**
 * Met en forme un prix rendu par Shopify.
 *
 * ⛔ Le symbole vient du `currencyCode` de Shopify : on n'invente aucune devise et on ne
 * convertit rien. Le prix affiché est celui du marché de l'acheteur, tel que la boutique le
 * facture.
 */
export function formatProductPrice(amount: string, currencyCode: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value) || !currencyCode) return ''
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).format(value)
  } catch {
    return `${amount} ${currencyCode}`
  }
}
