import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * La page d'où vient l'inscription, conservée sur l'inscrit lui-même.
 *
 * Elle existait déjà dans `newsletter_consent_events` — mais LÀ-BAS C'EST UNE PREUVE, pas une
 * donnée de travail. Le journal de consentement est append-only et sera PURGÉ à trois ans
 * (art. 5(1)(e)) ; lui faire porter une donnée dont la séquence a besoin reviendrait à faire
 * dépendre le rendu d'un e-mail d'une table qu'on efface. Les deux usages sont distincts et le
 * restent.
 *
 * À quoi elle sert : l'encart s'affiche sur une fiche produit, donc cette URL dit quelle œuvre
 * la personne regardait. E2 et E3 partent trois et six jours plus tard — sans cette colonne,
 * ils ne pourraient pas rappeler le tableau qui a déclenché l'inscription.
 *
 * Nullable : une inscription depuis la page d'accueil ou une collection n'a pas de produit, et
 * le gabarit supprime alors le bloc entier.
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_subscribers'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('source_url', 512).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('source_url')
    })
  }
}
