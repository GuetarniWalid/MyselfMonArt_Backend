/**
 * Lecture de `source_url` — module PUR, pour que les tests dorés puissent le charger sans
 * monter l'application.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE SÉPARÉMENT. `source_url` est une donnée SOUMISE PAR LE
 * NAVIGATEUR sur un point d'entrée public et non authentifié, et ce qu'on en tire finit en
 * IMAGE, en TITRE et en DESTINATION DE BOUTON dans un e-mail signé MyselfMonArt. Sans filtre
 * de domaine, n'importe qui posterait une URL étrangère et ferait afficher le visuel de son
 * choix — ou emmènerait le lecteur ailleurs — dans un message portant la marque. C'est le
 * genre de règle qui doit être testée hors ligne, pas au milieu d'un service qui parle à
 * Shopify.
 */

/**
 * Le SEUL hôte dont on accepte quoi que ce soit.
 *
 * Plus strict que le filtre d'`extractHandle`, qui tolère les sous-domaines : un handle sert à
 * REDEMANDER la fiche à Shopify (qui tranche), alors qu'un chemin de redirection est recopié
 * tel quel dans un lien cliquable. Ce qu'on recopie mérite la porte la plus étroite.
 */
const STORE_HOST = 'www.myselfmonart.com'

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
 * Le CHEMIN de la page d'où vient l'inscription, à mettre dans `?redirect=` du lien de remise.
 * `null` dès que la valeur n'est pas un chemin sûr de la boutique — l'appelant retombe alors
 * sur sa destination par défaut.
 *
 * ⛔ UN CHEMIN, JAMAIS UNE URL ABSOLUE. Shopify ignore SILENCIEUSEMENT un `redirect` absolu :
 * la remise s'applique, mais le client atterrit sur l'accueil au lieu de la fiche qu'il
 * regardait. Rien n'échoue, rien ne se journalise — c'est le client qui le découvre. D'où
 * `url.pathname`, et jamais la chaîne reçue.
 *
 * ⛔ LE PRÉFIXE DE MARCHÉ RESTE DANS LE CHEMIN. `/en-us/`, `/fr-ca/`, `/de-ch/` portent à la
 * fois la langue et le MARCHÉ, donc la devise et la grille tarifaire. Le retirer enverrait un
 * Américain sur le catalogue français. `pathname` le contient déjà : on ne le nettoie pas.
 *
 * Le résultat n'est PAS encodé — l'appelant le passe à `encodeURIComponent` au moment de
 * composer le lien. `pathname` étant déjà sous forme pourcent, le décodage que fera Shopify
 * rend exactement le chemin d'origine.
 */
export function redirectPathFrom(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null

  let url: URL
  try {
    url = new URL(String(sourceUrl))
  } catch {
    return null
  }

  // `URL` normalise déjà l'hôte en minuscules. Égalité stricte : ni sous-domaine, ni suffixe.
  // Un schéma sans autorité (`javascript:…`) donne un hôte vide, donc échoue ici.
  if (url.hostname !== STORE_HOST) return null

  const path = url.pathname

  // ⛔ `//evil.example` est une URL PROTOCOL-RELATIVE, pas un chemin : un navigateur qui la
  // suit quitte le domaine. Elle passe la porte de l'hôte ci-dessus, puisque c'est bien
  // `www.myselfmonart.com` qui l'a servie. C'est donc ICI qu'on l'arrête. (`/\evil.example`
  // est déjà normalisé en `//evil.example` par `URL`, et tombe dans le même filet.)
  if (!path.startsWith('/') || path.startsWith('//')) return null

  return path
}

// Les prix produit passent par `moneyLabel` (currency.ts), comme le bon et les seuils.
//
// Il y avait ici un second formateur, qui figeait `fr-FR` et `narrowSymbol` : un lecteur
// allemand voyait donc le prix de l'œuvre mis en forme à la française, et un montant canadien
// s'affichait « 20 $ », indistinguable d'un montant américain. Un seul formateur, un seul
// endroit — c'est la règle, et c'est aussi ce qui empêche les deux de diverger.
