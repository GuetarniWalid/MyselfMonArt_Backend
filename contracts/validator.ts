/**
 * Déclarations des règles de validation custom du projet (enregistrées dans
 * providers/AppProvider.boot) — nécessaire pour que `rules.printableFirstName()`
 * soit connu du compilateur dans les Validators.
 */
declare module '@ioc:Adonis/Core/Validator' {
  import { Rule } from '@ioc:Adonis/Core/Validator'

  interface Rules {
    /**
     * Prénom imprimable sur l'œuvre : refuse les injures / termes inappropriés
     * FR-EN de la blocklist (App/Services/CustomArt/blocklist, matching normalisé
     * sans accents ni leetspeak basique).
     */
    printableFirstName(): Rule
  }
}
