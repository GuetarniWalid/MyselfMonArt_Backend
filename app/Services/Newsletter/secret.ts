import Env from '@ioc:Adonis/Core/Env'

/**
 * Secret de dérivation des empreintes d'adresse et des jetons de désabonnement.
 *
 * `NEWSLETTER_SECRET` s'il est posé, sinon `APP_KEY` — lui aussi secret, jamais commité, et
 * toujours présent. Le repli est délibéré : le dispositif doit démarrer et tourner à vie sans
 * intervention, une variable oubliée ne doit donc pas empêcher une inscription.
 *
 * ⛔ CONTRAIREMENT au secret de la rotation hebdomadaire, celui-ci NE DOIT JAMAIS CHANGER une
 * fois en service. Il ne dérive pas une valeur jetable mais deux identités durables :
 *
 *   • les empreintes de la LISTE REPOUSSOIR — les changer rend la liste illisible et
 *     réexpose des personnes qui s'étaient plaintes, ce qui coûte le compte d'envoi ;
 *   • les JETONS de désabonnement déjà partis dans des e-mails — les changer transforme
 *     chaque lien « se désabonner » déjà envoyé en 404, donc en signalement de spam.
 *
 * Si `APP_KEY` doit un jour tourner, poser `NEWSLETTER_SECRET` à son ANCIENNE valeur AVANT
 * la rotation.
 */
export function newsletterSecret(): string {
  return (Env.get('NEWSLETTER_SECRET') as string | undefined) || (Env.get('APP_KEY') as string)
}
