import type { ApplicationContract } from '@ioc:Adonis/Core/Application'

export default class AppProvider {
  constructor(protected app: ApplicationContract) {}

  public register() {
    // Register your own bindings
  }

  public async boot() {
    // IoC container is ready

    // Règle de validation custom `printableFirstName` (M10) : le prénom CustomArt est
    // PEINT sur l'œuvre livrée -> refus des injures/termes inappropriés FR-EN de la
    // blocklist (matching normalisé : accents, leetspeak basique, séparateurs).
    // Utilisée par CustomArtJobValidator ; typage déclaré dans contracts/validator.ts.
    const { validator } = await import('@ioc:Adonis/Core/Validator')
    const { isBlockedFirstName } = await import('App/Services/CustomArt/blocklist')
    validator.rule('printableFirstName', (value, _, options) => {
      if (typeof value !== 'string' || !isBlockedFirstName(value)) return
      options.errorReporter.report(
        options.pointer,
        'printableFirstName',
        'printableFirstName validation failed',
        options.arrayExpressionPointer
      )
    })
  }

  public async ready() {
    // App is ready
    // Using HTTP polling for mockup automation (no WebSocket needed)

    // Worker CustomArt (jobs MySQL + re-scan des orphelins au boot) : process web
    // uniquement (pas ace/scheduler). Import dynamique obligatoire dans un provider.
    if (this.app.environment === 'web') {
      const { default: CustomArtWorker } = await import('App/Services/CustomArt/Worker')
      CustomArtWorker.start()
    }
  }

  public async shutdown() {
    // Cleanup, since app is going down
  }
}
