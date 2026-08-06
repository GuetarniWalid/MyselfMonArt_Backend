import crypto from 'crypto'

/**
 * Signature AWS Signature Version 4, pour un POST de formulaire vers une API AWS « Query ».
 *
 * POURQUOI ÉCRIT À LA MAIN plutôt qu'avec le SDK AWS — l'exigence est « régler une fois et ne
 * plus jamais y toucher ». SigV4 est une spécification FIGÉE depuis 2012 : ces quarante lignes
 * ne bougeront plus. Un SDK, lui, se met à jour, change de découpage de paquets, abandonne des
 * versions de Node, et devient une dépendance de plus à surveiller pour une seule requête dont
 * la forme ne varie jamais.
 *
 * La dérivation est vérifiée par un test doré (tests/golden/newsletter-sigv4.js) contre le
 * vecteur publié par AWS — si un jour elle casse, ça se voit avant le déploiement.
 *
 * Module PUR : aucune dépendance Adonis, aucune E/S.
 */

const ALGORITHM = 'AWS4-HMAC-SHA256'

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

/**
 * Clé de signature dérivée : secret -> date -> région -> service -> "aws4_request".
 * Chaque étage réduit la portée de la clé ; c'est ce qui fait qu'une signature interceptée ne
 * vaut que pour un jour, une région et un service.
 */
export function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

export interface SignedRequest {
  url: string
  headers: Record<string, string>
  body: string
}

/**
 * Signe un POST `application/x-www-form-urlencoded`.
 *
 * `amzDate` est injectable pour rendre la signature REPRODUCTIBLE en test (format
 * `YYYYMMDDTHHMMSSZ`). En production, on prend l'horloge.
 */
export function signFormPost(input: {
  host: string
  region: string
  service: string
  accessKeyId: string
  secretAccessKey: string
  /** Jeton de session STS, si la machine utilise des identifiants temporaires. */
  sessionToken?: string
  body: string
  amzDate?: string
  /**
   * Chemin canonique de la ressource. `/` pour les API « query » classiques (SES, SNS, IAM) ;
   * SQS, lui, adresse chaque file par son chemin (`/<compte>/<file>`), et signer `/` ferait
   * échouer la signature.
   */
  path?: string
}): SignedRequest {
  const amzDate = input.amzDate ?? new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const contentType = 'application/x-www-form-urlencoded; charset=utf-8'
  const payloadHash = sha256Hex(input.body)

  // Les en-têtes signés doivent être triés par nom, en minuscules. `x-amz-security-token` en
  // fait partie quand il est présent : l'omettre ferait rejeter la requête.
  const headerPairs: Array<[string, string]> = [
    ['content-type', contentType],
    ['host', input.host],
    ['x-amz-date', amzDate],
  ]
  if (input.sessionToken) headerPairs.push(['x-amz-security-token', input.sessionToken])
  headerPairs.sort((a, b) => (a[0] < b[0] ? -1 : 1))

  const canonicalHeaders = headerPairs.map(([k, v]) => `${k}:${v}\n`).join('')
  const signedHeaders = headerPairs.map(([k]) => k).join(';')

  const path = input.path || '/'

  const canonicalRequest = [
    'POST',
    path,
    '', // pas de chaîne de requête : tout est dans le corps
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`
  const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n')

  const signature = crypto
    .createHmac('sha256', signingKey(input.secretAccessKey, dateStamp, input.region, input.service))
    .update(stringToSign, 'utf8')
    .digest('hex')

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'X-Amz-Date': amzDate,
    'Authorization':
      `${ALGORITHM} Credential=${input.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
  if (input.sessionToken) headers['X-Amz-Security-Token'] = input.sessionToken

  return { url: `https://${input.host}${path}`, headers, body: input.body }
}
