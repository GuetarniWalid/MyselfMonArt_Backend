import { createHmac } from 'crypto'
import Env from '@ioc:Adonis/Core/Env'

export const CODE_PREFIX = 'MERCI-'

/**
 * 31 symboles, sans I, L, O, 0 ni 1 : le code est lu à l'écran puis retapé à la main au
 * checkout, les caractères ambigus sont donc écartés.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5

/** Plus grand multiple de 31 tenant dans un octet (248) — borne du tirage sans biais. */
const REJECTION_LIMIT = Math.floor(256 / ALPHABET.length) * ALPHABET.length

/**
 * Code de la semaine : `MERCI-` + 5 symboles dérivés de HMAC-SHA256(secret, semaine ISO).
 *
 * JAMAIS D'ALÉATOIRE — c'est ce qui rend le cron idempotent. Si le cron se relance (crash,
 * double lancement, rattrapage), il recalcule exactement le même code : la relecture le
 * retrouve et aucune remise en double n'est créée.
 *
 * Le secret reste hors du dépôt, donc le code de la semaine suivante reste imprévisible de
 * l'extérieur.
 *
 * L'alphabet fait 31 symboles (et non 32) : un base32 canonique est donc impossible. On
 * tire chaque symbole d'un octet du condensat par rejet des octets ≥ 248, ce qui donne une
 * distribution uniforme (un simple modulo favoriserait les 8 premiers symboles).
 */
export function codeForWeek(isoWeek: string, secret: string): string {
  const digest = createHmac('sha256', secret).update(isoWeek).digest()

  let out = ''
  for (const byte of digest) {
    if (out.length === CODE_LENGTH) break
    if (byte >= REJECTION_LIMIT) continue // tirage uniforme
    out += ALPHABET[byte % ALPHABET.length]
  }
  // 32 octets pour 5 symboles à 96,9 % d'acceptation : jamais atteint en pratique, mais on
  // ne renvoie sous aucun prétexte un code plus court que prévu.
  while (out.length < CODE_LENGTH) out += ALPHABET[0]

  return CODE_PREFIX + out
}

/**
 * Secret de dérivation. `PROMO_CODE_SECRET` s'il est posé, sinon `APP_KEY` — lui aussi
 * secret, jamais commité, et toujours présent. Ce repli est délibéré : le dispositif doit
 * tourner à vie sans intervention, une variable oubliée ne doit donc pas figer la rotation.
 * En changer plus tard est sans danger — la semaine suivante produit simplement un nouveau
 * code, et l'ancien reste valide jusqu'à son expiration.
 */
export function rotationSecret(): string {
  return (Env.get('PROMO_CODE_SECRET') as string | undefined) || (Env.get('APP_KEY') as string)
}
