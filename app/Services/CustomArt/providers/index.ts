import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import GeminiProvider from './GeminiProvider'
import OpenAIProvider from './OpenAIProvider'
import ReplicateProvider from './ReplicateProvider'
import FakeProvider from './FakeProvider'
import type { CustomArtProvider } from './types'

/**
 * Chaîne par défaut — arbitrage bench M1 validé par Walid (2026-06-11) :
 *   1. gemini-3.1-flash-image  (primaire : meilleur rapport fidélité/latence/coût)
 *   2. gemini-3-pro-image      (round 2 silencieux / secours)
 *   3. gemini-2.5-flash-image  (dernier recours auto : filtre d'entrée moins strict,
 *                               avant le fallback humain manual_review)
 * Surchargable par env CUSTOM_ART_PROVIDER_CHAIN (entrées 'nom[:modèle]' séparées
 * par des virgules), ou en rétro-compat par CUSTOM_ART_PRIMARY/FALLBACK_PROVIDER.
 */
export const DEFAULT_PROVIDER_CHAIN =
  'gemini:gemini-3.1-flash-image,gemini:gemini-3-pro-image,gemini:gemini-2.5-flash-image'

// Avertissements du mode factice : une seule fois par process (le worker re-résout
// la chaîne à chaque job, on ne spamme pas les logs).
let fakeModeWarned = false
let fakeProdWarned = false

/**
 * Mode provider FACTICE (M10, tests locaux + charge M12) : env
 * CUSTOM_ART_FAKE_PROVIDER=true -> image statique du bench, zéro appel API payant,
 * juge court-circuité (verdict factice « pass », voir Worker). REFUSÉ en production :
 * on ne sert jamais une image du bench à un vrai client.
 */
export function fakeProviderEnabled(): boolean {
  if (!Env.get('CUSTOM_ART_FAKE_PROVIDER')) return false
  if (Env.get('NODE_ENV') === 'production') {
    if (!fakeProdWarned) {
      fakeProdWarned = true
      Logger.error(
        'custom-art: CUSTOM_ART_FAKE_PROVIDER=true IGNORÉ en production (providers réels conservés)'
      )
    }
    return false
  }
  return true
}

/**
 * Fabrique un provider depuis une entrée de chaîne 'nom[:modèle]'
 * (ex 'gemini:gemini-3-pro-image', 'openai', 'replicate').
 */
export function makeProvider(entry: string): CustomArtProvider | null {
  const trimmed = (entry || '').trim()
  const sep = trimmed.indexOf(':')
  const name = (sep === -1 ? trimmed : trimmed.slice(0, sep)).toLowerCase()
  const model = sep === -1 ? undefined : trimmed.slice(sep + 1).trim() || undefined

  switch (name) {
    case 'gemini':
      return new GeminiProvider(model)
    case 'openai':
      return new OpenAIProvider(model)
    case 'replicate':
      return new ReplicateProvider()
    case 'fake':
      // Uniquement via le mode factice (jamais résolu si le flag est absent/prod)
      return fakeProviderEnabled() ? new FakeProvider() : null
    default:
      return null
  }
}

/** Spécification de la chaîne : env dédiée > rétro-compat primaire/secours > défaut bench. */
function chainSpec(): string {
  const chain = Env.get('CUSTOM_ART_PROVIDER_CHAIN')
  if (chain) return chain
  const primary = Env.get('CUSTOM_ART_PRIMARY_PROVIDER')
  const fallback = Env.get('CUSTOM_ART_FALLBACK_PROVIDER')
  if (primary || fallback) return [primary, fallback].filter(Boolean).join(',')
  return DEFAULT_PROVIDER_CHAIN
}

/**
 * Chaîne ordonnée de providers (primaire → secours → dernier recours). Les maillons
 * indisponibles (clé absente) ou inconnus sont filtrés ; la liste peut donc être vide.
 */
export function resolveProviderChain(): CustomArtProvider[] {
  // Mode factice (tests locaux / charge) : chaîne réduite au seul provider statique
  if (fakeProviderEnabled()) {
    if (!fakeModeWarned) {
      fakeModeWarned = true
      Logger.warn(
        'custom-art: PROVIDER FACTICE actif (CUSTOM_ART_FAKE_PROVIDER) — images du bench, aucun appel API payant'
      )
    }
    return [new FakeProvider()]
  }

  const chain: CustomArtProvider[] = []
  for (const entry of chainSpec().split(',')) {
    if (!entry.trim()) continue
    const provider = makeProvider(entry)
    if (!provider) {
      Logger.warn('custom-art: maillon de chaîne inconnu "%s" (ignoré)', entry.trim())
      continue
    }
    if (!provider.isAvailable()) {
      Logger.warn('custom-art: provider "%s" non configuré (clé absente), ignoré', provider.key)
      continue
    }
    if (!chain.some((p) => p.key === provider.key)) {
      chain.push(provider)
    }
  }
  return chain
}

/**
 * Résout un maillon imposé depuis la file admin (« relancer avec <provider> ») :
 * d'abord par clé exacte dans la chaîne configurée, sinon construit directement.
 * Retourne null si le provider est inconnu ou sans clé API.
 */
export function resolveForcedProvider(key: string): CustomArtProvider | null {
  const fromChain = resolveProviderChain().find((p) => p.key === key)
  if (fromChain) return fromChain
  const provider = makeProvider(key)
  return provider && provider.isAvailable() ? provider : null
}

/**
 * Modèles à essayer pour UNE recette, DANS L'ORDRE. Extrait du Worker (22/08/2026) pour que le
 * bouton « tester le prompt » du Publisher et les vraies commandes ne puissent plus diverger :
 * un test qui n'interrogerait pas le même modèle que la production mentirait précisément là où
 * on attend une preuve.
 *
 * Priorité, inchangée : maillon imposé (file admin) > mode factice > chaîne déclarée par la
 * recette > modèle unique de la recette. Une recette SANS `providers` retombe donc exactement
 * sur le comportement historique — c'est ce qui protège les produits déjà publiés.
 *
 * Rend une liste possiblement VIDE (clés API absentes) : l'appelant décide quoi en faire.
 */
export function resolveRecipeProviders(input: {
  recipe: { model: string; providers?: { chain: string[] } | null }
  forcedProvider?: string | null
}): CustomArtProvider[] {
  if (input.forcedProvider) {
    const forced = resolveForcedProvider(input.forcedProvider)
    return forced ? [forced] : []
  }
  if (fakeProviderEnabled()) return resolveProviderChain().slice(0, 1)
  if (input.recipe.providers) {
    // Les maillons non configurés (clé API absente) sont écartés plutôt que de faire échouer
    // toute la chaîne : c'est le principe même d'un filet de secours.
    return input.recipe.providers.chain
      .map((key) => makeProvider(key))
      .filter((p): p is CustomArtProvider => Boolean(p && p.isAvailable()))
  }
  const built = makeProvider(`gemini:${input.recipe.model}`)
  return built && built.isAvailable() ? [built] : []
}
