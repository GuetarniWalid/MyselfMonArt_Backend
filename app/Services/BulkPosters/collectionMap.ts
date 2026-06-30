/**
 * Table de correspondance collection TOILE (GID) → collection POSTER (GID + titre), pour le batch
 * « posters en masse ». Construite le 28/06/2026 par appariement « Tableau X » → « Poster & Affiche X »
 * (40 paires couvrant pièces, couleurs et thèmes).
 *
 * STRICT : une toile dont la collection mère n'est PAS dans cette table n'aura PAS de poster (le batch
 * la saute et la rapporte). Garantit qu'aucun poster n'est rangé dans une collection de toiles.
 * Pour activer un thème : créer sa collection poster puis ajouter une ligne ici (toileGID → posterGID).
 *
 * Thèmes SANS équivalent poster (volontairement non mappés, donc sautés) :
 *   amérindiens, Marvel, best-seller, Manga.
 */
export const POSTER_COLLECTION_MAP: Record<string, { id: string; title: string }> = {
  'gid://shopify/Collection/403801309439': {
    id: 'gid://shopify/Collection/675215999323',
    title: 'Poster & Affiche Cuisine',
  }, // Tableau Cuisine
  'gid://shopify/Collection/404485669119': {
    id: 'gid://shopify/Collection/675215835483',
    title: 'Poster & Affiche Salon',
  }, // Tableau Salon
  'gid://shopify/Collection/404666908927': {
    id: 'gid://shopify/Collection/675216064859',
    title: 'Poster & Affiche Chambre',
  }, // Tableau Chambre
  'gid://shopify/Collection/406505226495': {
    id: 'gid://shopify/Collection/675216294235',
    title: 'Poster & Affiche Chambre Bébé',
  }, // Tableaux Chambre Bebe
  'gid://shopify/Collection/406508994815': {
    id: 'gid://shopify/Collection/675216195931',
    title: 'Poster & Affiche Chambre Fillette',
  }, // Tableau Chambre Fillette
  'gid://shopify/Collection/406510534911': {
    id: 'gid://shopify/Collection/675216130395',
    title: 'Poster & Affiche Chambre Enfant',
  }, // Tableau Chambre Enfant
  'gid://shopify/Collection/406513090815': {
    id: 'gid://shopify/Collection/675216097627',
    title: 'Poster & Affiche Chambre Ado',
  }, // Tableau Chambre Ado
  'gid://shopify/Collection/406514532607': {
    id: 'gid://shopify/Collection/675216032091',
    title: 'Poster & Affiche Chambre Adulte',
  }, // Tableau Chambre Adulte
  'gid://shopify/Collection/406514893055': {
    id: 'gid://shopify/Collection/675216163163',
    title: 'Poster & Affiche Chambre Garçon',
  }, // Tableau Chambre Garçon
  'gid://shopify/Collection/406516138239': {
    id: 'gid://shopify/Collection/675216261467',
    title: 'Poster & Affiche Chambre Fille',
  }, // Tableau Chambre Fille
  'gid://shopify/Collection/407429972223': {
    id: 'gid://shopify/Collection/675215376731',
    title: 'Poster & Affiche Animaux',
  }, // Tableau Animaux
  'gid://shopify/Collection/407649157375': {
    id: 'gid://shopify/Collection/675215966555',
    title: 'Poster & Affiche Bureau',
  }, // Tableau Bureau
  'gid://shopify/Collection/599544299867': {
    id: 'gid://shopify/Collection/675215409499',
    title: 'Poster & Affiche Japonais',
  }, // Tableau Japonais
  'gid://shopify/Collection/599645290843': {
    id: 'gid://shopify/Collection/675215638875',
    title: 'Poster & Affiche Ethnique',
  }, // Tableau Ethnique
  'gid://shopify/Collection/599721574747': {
    id: 'gid://shopify/Collection/675216458075',
    title: 'Poster & Affiche Jaune',
  }, // Tableau Jaune
  'gid://shopify/Collection/599890166107': {
    id: 'gid://shopify/Collection/675216392539',
    title: 'Poster & Affiche Rouge',
  }, // Tableau Rouge
  'gid://shopify/Collection/599920804187': {
    id: 'gid://shopify/Collection/675216425307',
    title: 'Poster & Affiche Bleu',
  }, // Tableau Bleu
  'gid://shopify/Collection/599959470427': {
    id: 'gid://shopify/Collection/675216490843',
    title: 'Poster & Affiche Vert',
  }, // Tableau Vert
  'gid://shopify/Collection/600150933851': {
    id: 'gid://shopify/Collection/675216359771',
    title: 'Poster & Affiche Rose',
  }, // Tableau Rose
  'gid://shopify/Collection/600154669403': {
    id: 'gid://shopify/Collection/675216523611',
    title: 'Poster & Affiche Gris',
  }, // Tableau Gris
  'gid://shopify/Collection/600281612635': {
    id: 'gid://shopify/Collection/675215278427',
    title: 'Poster & Affiche Noir et Blanc',
  }, // Tableau Noir et Blanc
  'gid://shopify/Collection/600335221083': {
    id: 'gid://shopify/Collection/675216556379',
    title: 'Poster & Affiche Orange',
  }, // Tableau Orange
  'gid://shopify/Collection/600338071899': {
    id: 'gid://shopify/Collection/675216589147',
    title: 'Poster & Affiche Violet',
  }, // Tableau Violet
  'gid://shopify/Collection/600341086555': {
    id: 'gid://shopify/Collection/675216327003',
    title: 'Poster & Affiche Coloré',
  }, // Tableau Coloré
  'gid://shopify/Collection/602732953947': {
    id: 'gid://shopify/Collection/675215212891',
    title: 'Poster & Affiche Pop Art',
  }, // Tableau Pop Art
  'gid://shopify/Collection/604416967003': {
    id: 'gid://shopify/Collection/675215606107',
    title: 'Poster & Affiche Zen',
  }, // Tableau Zen
  'gid://shopify/Collection/607034311003': {
    id: 'gid://shopify/Collection/675215311195',
    title: 'Poster & Affiche Fleurs',
  }, // Tableau Fleurs
  'gid://shopify/Collection/607047844187': {
    id: 'gid://shopify/Collection/675215343963',
    title: 'Poster & Affiche Nature',
  }, // Tableaux Nature
  'gid://shopify/Collection/607562432859': {
    id: 'gid://shopify/Collection/675215442267',
    title: 'Poster & Affiche Paysage',
  }, // Tableau Paysage
  'gid://shopify/Collection/619498307931': {
    id: 'gid://shopify/Collection/675215737179',
    title: 'Poster & Affiche Mer',
  }, // Tableau Mer
  'gid://shopify/Collection/620119982427': {
    id: 'gid://shopify/Collection/675215245659',
    title: 'Poster & Affiche Abstrait',
  }, // Tableau Abstrait
  'gid://shopify/Collection/624281387355': {
    id: 'gid://shopify/Collection/675215507803',
    title: 'Poster & Affiche Street Art',
  }, // Tableau Street Art
  'gid://shopify/Collection/640741704027': {
    id: 'gid://shopify/Collection/675215769947',
    title: 'Poster & Affiche Lion',
  }, // Tableau Lion
  'gid://shopify/Collection/644724818267': {
    id: 'gid://shopify/Collection/675215671643',
    title: 'Poster & Affiche Frida Kahlo',
  }, // Tableau Frida Kahlo
  'gid://shopify/Collection/644760338779': {
    id: 'gid://shopify/Collection/675215704411',
    title: 'Poster & Affiche Portrait',
  }, // Tableau Portrait
  'gid://shopify/Collection/646969459035': {
    id: 'gid://shopify/Collection/675215868251',
    title: 'Poster & Affiche Islamique',
  }, // Tableau Islamique
  'gid://shopify/Collection/650738270555': {
    id: 'gid://shopify/Collection/675215475035',
    title: 'Poster & Affiche Bouddha',
  }, // Tableaux Bouddha
  'gid://shopify/Collection/407673012479': {
    id: 'gid://shopify/Collection/675215802715',
    title: 'Poster & Affiche Africains',
  }, // Tableau Africain
  'gid://shopify/Collection/656988471643': {
    id: 'gid://shopify/Collection/675215573339',
    title: 'Poster & Affiche Cheval',
  }, // Tableau chevaux
  'gid://shopify/Collection/623299887451': {
    id: 'gid://shopify/Collection/675258237275',
    title: 'Poster & Affiche Fruits et Légumes',
  }, // Tableau Fruits et Légumes
}

/** Collection poster correspondant à une collection toile, ou null si non mappée (→ la toile est sautée). */
export function posterCollectionFor(
  toileCollectionId: string | null
): { id: string; title: string } | null {
  if (!toileCollectionId) return null
  return POSTER_COLLECTION_MAP[toileCollectionId] || null
}
