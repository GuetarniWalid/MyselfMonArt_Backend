import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Cache des juges « photo-check » du studio (endpoint POST /api/custom-art/photo-check).
 *
 * Pas de Redis dans ce projet → cache déterministe en MySQL, clé = SHA-256 de la photo
 * ORIGINALE (calculé côté client). TTL ~1 h appliqué À LA LECTURE (created_at). On ne
 * stocke QUE le hash + le verdict structuré (RGPD : jamais la photo). Garantit
 * « 1 photo unique = 1 appel LLM maximum » (backstop multi-appareils ; le front dédoublonne
 * déjà par hash de son côté).
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_photo_checks'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // SHA-256 hex (64 car.) des octets de la photo originale — clé de cache
      table.string('hash', 64).notNullable().unique('uniq_photo_check_hash')
      // Évaluation INTRINSÈQUE de la photo (indépendante de l'angle demandé) :
      // { faceCount, faceAngle, tooDark, blurry, faceTooSmall, obstructed, lowQuality, nsfw }.
      // Le verdict final (ok/issues/angle_mismatch) est recalculé en code à chaque appel.
      table.json('assessment').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Balayage best-effort des entrées périmées (purge au-delà du TTL)
      table.index(['created_at'], 'idx_photo_check_created')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
