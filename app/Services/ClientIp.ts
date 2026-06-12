import Env from '@ioc:Adonis/Core/Env'
import type { RequestContract } from '@ioc:Adonis/Core/Request'

/**
 * IP réelle du client pour les caps anti-abus et le rate limiting.
 *
 * En prod la chaîne est Cloudflare -> nginx -> Adonis avec trustProxy('loopback') :
 * request.ip() ne vaut l'IP du visiteur que si nginx ré-injecte l'IP Cloudflare dans
 * X-Forwarded-For (proxy_set_header X-Forwarded-For $http_cf_connecting_ip;). Sinon
 * tous les visiteurs partagent la même IP vue par Adonis et les caps par IP sont
 * soit globaux (feature cassée, faux 429), soit contournables.
 *
 * Tant que la conf nginx n'est pas vérifiée, TRUST_CF_CONNECTING_IP=true permet de
 * lire directement l'en-tête CF-Connecting-IP, posé par Cloudflare et fiable tant
 * que l'origine n'accepte que le trafic Cloudflare (firewall droplet).
 */
export function clientIp(request: RequestContract): string {
  if (Env.get('TRUST_CF_CONNECTING_IP')) {
    const cfIp = request.header('cf-connecting-ip')
    if (cfIp) return cfIp
  }
  return request.ip()
}
