import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtStorage from 'App/Services/CustomArt/Storage'

/**
 * Ce qu'une création laisse sur le stockage, et comment l'effacer.
 *
 * EXTRAIT de `Tasks/PurgeCustomArt` (19/08/2026) pour que la purge automatique J+30 et le retrait
 * MANUEL depuis la file de revue passent par le MÊME code. Une copie aurait tôt fait d'oublier les
 * clés de mockups ci-dessous — qui portent l'œuvre personnalisée du client et resteraient donc
 * accessibles après suppression (fuite RGPD).
 */
export function jobStorageKeys(job: CustomArtJob): string[] {
  const keys: string[] = []
  if (job.photoPath) keys.push(job.photoPath)
  for (const candidate of job.candidates || []) {
    if (candidate.path) keys.push(candidate.path)
    if (candidate.previewPath) keys.push(candidate.previewPath)
  }
  // Mises en situation Photopea (mockup-N.jpg, PUBLIQUES) : mêmes clés qu'à l'écriture
  // (MockupRenderer, indexées sur job.mockups). Sans elles, les mockups — qui portent
  // l'œuvre personnalisée — resteraient accessibles après la purge du job (fuite RGPD).
  // delete() est best-effort : une cellule pending/error sans fichier ne fait pas échouer.
  for (let i = 0; i < (job.mockups || []).length; i++) {
    keys.push(`custom-art/jobs/${job.uuid}/mockup-${i}.jpg`)
  }
  return keys
}

/**
 * Efface les fichiers d'une création et la marque `expired` (état terminal déjà connu du front :
 * il affiche « création expirée » plutôt qu'une page cassée). On ne SUPPRIME pas la ligne : la
 * trace reste pour le suivi, seules les données personnelles partent.
 */
export async function purgeJobFiles(job: CustomArtJob): Promise<void> {
  for (const key of jobStorageKeys(job)) {
    await CustomArtStorage.delete(key)
  }
  job.status = 'expired'
  job.photoPath = ''
  job.candidates = null
  job.chosenIndex = null
  await job.save()
}
