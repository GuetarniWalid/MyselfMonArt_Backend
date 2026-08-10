/**
 * Test « golden » de la PUBLICATION SOCIALE (Pinterest / Instagram).
 *
 * POURQUOI CE TEST EXISTE
 * Les deux régressions qu'il verrouille ne provoquent aucune erreur quand elles reviennent :
 * le cron dit « publié », les logs sont verts, et c'est la boutique qui se retrouve avec
 * deux fois la même œuvre sur le compte — constaté en production.
 *
 *  1. LE REPLI QUI PUBLIE DEUX FOIS. Quand un format riche échoue, on se rabat sur une
 *     simple image pour ne pas perdre la publication du jour. Mais si l'échec est survenu
 *     PENDANT l'appel qui met le post en ligne (timeout, 5xx, socket coupé), la plateforme
 *     a très bien pu accepter le post malgré tout : le repli en publie alors un second.
 *     C'est exactement ce qui a produit « un carrousel + une image » pour un même tableau.
 *     On verrouille donc la règle de décision : seul un refus EXPLICITE (4xx) autorise le
 *     repli ; toute ambiguïté l'interdit.
 *
 *  2. LE CARROUSEL SANS TITRE. Pinterest affiche le titre porté par CHAQUE diapositive, pas
 *     celui du pin. Tant que `media_source.items[]` ne portait que l'image, les carrousels
 *     sortaient muets alors que le pin avait bien un titre. On verrouille la présence du
 *     titre sur chaque diapositive ET le respect des limites Pinterest (100 / 800), y
 *     compris sur la bascule de secours qui reprend les champs Shopify bruts (titre trop
 *     long, description en HTML).
 *
 * On verrouille enfin la règle « un produit n'est publié qu'une seule fois », tous boards
 * confondus — la déduplication par paire (produit × board) laissait repasser un même
 * tableau sur chaque board correspondant.
 *
 * POURQUOI PAS JAPA : mêmes raisons que les autres goldens — de la logique pure, on
 * transpile le TypeScript en mémoire, `node` suffit.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const ts = require(path.join(ROOT, 'node_modules/typescript'))

// Le générateur de texte appelle le modèle : hors sujet ici, et il tirerait tout le SDK.
// On le remplace par une doublure — les tests portent sur le formatage, pas sur la rédaction.
const STUBS = {
  Claude: {
    __esModule: true,
    default: class {
      async generatePinPayload() {
        return { title: '', description: '', alt_text: '' }
      }
    },
  },
}

function resolveTs(absPath) {
  for (const candidate of [absPath, `${absPath}.ts`, path.join(absPath, 'index.ts')]) {
    if (candidate.endsWith('.ts') && fs.existsSync(candidate)) return candidate
  }
  throw new Error(`Module TS introuvable : ${absPath}`)
}

/** Charge un module TS en mémoire, en résolvant récursivement ses imports relatifs. */
function loadTsModule(absPath, cache = new Map()) {
  const resolved = resolveTs(absPath)
  if (cache.has(resolved)) return cache.get(resolved)

  const js = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText

  const module = { exports: {} }
  cache.set(resolved, module.exports)
  const req = (id) => {
    if (id.includes('Claude/')) return STUBS.Claude
    if (id.startsWith('.')) return loadTsModule(path.resolve(path.dirname(resolved), id), cache)
    return require(id)
  }
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(req, module, module.exports)
  cache.set(resolved, module.exports)
  return module.exports
}

let pass = 0
let fail = 0
function ok(cond, label) {
  if (cond) pass++
  else {
    fail++
    console.log('  FAIL  ' + label)
  }
}

const publishError = loadTsModule(path.join(ROOT, 'app/Services/Social/PublishError.ts'))
const { PublishError, isAmbiguousPublishFailure, isDefinitiveRejection } = publishError

console.log('\n▸ Publication sociale — anti-doublon et titres de carrousel\n')

// ── 1. La règle de repli : seule une erreur non ambiguë autorise une republication ───────
{
  const httpError = (status) => ({ response: { status, data: { error: 'x' } } })

  // Échecs AVANT publication : rien n'existe côté plateforme, le repli est sûr.
  const prepare = new PublishError('conteneur refusé', 'prepare', httpError(500))
  ok(!isAmbiguousPublishFailure(prepare), 'échec en phase prepare = repli autorisé (rien publié)')

  // Refus explicite pendant la publication : la requête est rejetée, rien n'est créé.
  for (const status of [400, 401, 403, 404, 422]) {
    const rejected = new PublishError('rejeté', 'publish', httpError(status))
    ok(
      !isAmbiguousPublishFailure(rejected),
      `publish + ${status} = refus explicite, repli autorisé`
    )
  }

  // Ambigus : la plateforme a PEUT-ÊTRE publié. Republier = doublon.
  for (const status of [408, 429, 500, 502, 503, 504]) {
    const ambiguous = new PublishError('incertain', 'publish', httpError(status))
    ok(isAmbiguousPublishFailure(ambiguous), `publish + ${status} = ambigu, repli INTERDIT`)
  }

  // Le cas réellement observé en production : aucune réponse du tout.
  const timeout = new PublishError('Connection timeout', 'publish', new Error('Connection timeout'))
  ok(
    isAmbiguousPublishFailure(timeout),
    'publish sans réponse (timeout réseau) = ambigu, repli INTERDIT'
  )
  ok(
    !isDefinitiveRejection(new Error('socket hang up')),
    'une erreur sans réponse HTTP n’est jamais un refus explicite'
  )

  // Une erreur quelconque (hors PublishError) ne doit pas bloquer le repli légitime.
  ok(
    !isAmbiguousPublishFailure(new Error('pas assez d’images pour un carrousel')),
    'erreur de construction du payload = repli autorisé'
  )
}

// ── 1 bis. La contrainte d'unicité est reconnue quelle que soit la forme de l'erreur ─────
// `uq_channel_product` est le dernier rempart : quand deux exécutions se chevauchent, la
// seconde DOIT reconnaître le refus de MySQL et abandonner son tick. Si la détection rate,
// l'erreur remonte comme une panne et, pire, la réservation est perdue.
{
  const { isDuplicateKeyError } = publishError

  // Forme brute de mysql2, telle que vérifiée en production (ERROR 1062).
  ok(isDuplicateKeyError({ code: 'ER_DUP_ENTRY', errno: 1062 }), 'erreur mysql2 brute reconnue')
  // Formes emballées par Lucid / knex.
  ok(
    isDuplicateKeyError({ cause: { code: 'ER_DUP_ENTRY' } }),
    'erreur emballée (cause.code) reconnue'
  )
  ok(isDuplicateKeyError({ cause: { errno: 1062 } }), 'erreur emballée (cause.errno) reconnue')
  ok(
    isDuplicateKeyError(
      new Error("Duplicate entry 'pinterest-gid://shopify/Product/1' for key 'uq_channel_product'")
    ),
    'erreur réduite à son message reconnue'
  )
  // Et surtout : ne pas confondre une vraie panne avec un doublon, sinon on avalerait
  // silencieusement des incidents.
  ok(!isDuplicateKeyError(new Error('ECONNREFUSED')), 'une panne de base n’est pas un doublon')
  ok(
    !isDuplicateKeyError({ code: 'ER_NO_SUCH_TABLE', errno: 1146 }),
    'une autre erreur SQL n’est pas un doublon'
  )
  ok(!isDuplicateKeyError(null), 'absence d’erreur = pas un doublon')
}

// ── 1 ter. On ne publie que sur le compte de la boutique ─────────────────────────────────
// Le 2026-08-10, une ré-autorisation OAuth a connecté le jeton au compte « madebymood.app »
// au lieu de « myselfmonart ». Sans ce garde-fou, le cron de 18h aurait publié les œuvres de
// la boutique chez un tiers — irréversible une fois en ligne.
{
  const { assertExpectedAccount } = loadTsModule(
    path.join(ROOT, 'app/Services/Social/AccountGuard.ts')
  )
  const check = (username, expected) => {
    try {
      assertExpectedAccount({ channel: 'Instagram', username, expected })
      return 'passe'
    } catch (error) {
      return error.message
    }
  }

  ok(check('myselfmonart', 'myselfmonart') === 'passe', 'le bon compte passe')
  ok(
    check('MyselfMonArt', 'myselfmonart') === 'passe',
    'la casse ne fait pas echouer un compte legitime'
  )
  ok(check(' myselfmonart ', 'myselfmonart') === 'passe', 'les espaces parasites non plus')

  // Le cas réel de l'incident.
  const wrong = check('madebymood.app', 'myselfmonart')
  ok(wrong !== 'passe', 'le mauvais compte est BLOQUÉ')
  ok(
    wrong.includes('madebymood.app') && wrong.includes('myselfmonart'),
    'le message nomme le compte connecté ET celui attendu'
  )

  // Un compte inconnu est traité comme un écart, pas comme un feu vert.
  ok(check(undefined, 'myselfmonart') !== 'passe', 'un compte non identifié est bloqué')
  ok(check('', 'myselfmonart') !== 'passe', 'un nom vide est bloqué')

  // Non configuré : on ne change rien au comportement existant.
  ok(
    check('nimporte-qui', undefined) === 'passe',
    'garde-fou non configuré = comportement inchangé'
  )
  ok(check('nimporte-qui', '   ') === 'passe', 'valeur vide = garde-fou considéré non configuré')
}

// ── 2. Le carrousel porte un titre sur CHAQUE diapositive, dans les limites Pinterest ────
{
  const PinFormatter = loadTsModule(
    path.join(ROOT, 'app/Services/Pinterest/PinFormatter.ts')
  ).default

  const slot = PinFormatter.buildCarouselSlot(
    'Ces pointes de danse racontent une histoire de persévérance',
    'Une description inspirante.',
    'https://www.myselfmonart.com/products/x?shopify_product_id=gid://shopify/Product/1'
  )
  ok(Boolean(slot.title && slot.title.length > 0), 'chaque diapositive porte un titre non vide')
  ok(
    Boolean(slot.link && slot.link.includes('shopify_product_id')),
    'chaque diapositive porte le lien produit'
  )

  // La bascule de secours reprend le titre Shopify brut : il peut dépasser la limite.
  const longTitle = 'Tableau '.repeat(40)
  const longDescription = 'Mot '.repeat(500)
  const bounded = PinFormatter.buildCarouselSlot(longTitle, longDescription, 'https://x.test')
  ok(bounded.title.length <= 100, `titre borné à 100 (obtenu : ${bounded.title.length})`)
  ok(
    bounded.description.length <= 800,
    `description bornée à 800 (obtenu : ${bounded.description.length})`
  )
  ok(bounded.title.endsWith('…'), 'la troncature est visible (ellipse) plutôt que coupée net')
}

// ── 2 bis. Dédoublonnage des pins : on garde le plus performant ──────────────────────────
// Décision IRRÉVERSIBLE (l'API Pinterest ne restaure rien) : c'est ce classement qui choisit
// quel pin meurt. Une inversion supprimerait le pin le plus vu du compte, sans recours.
{
  const { rankByPerformance } = loadTsModule(
    path.join(ROOT, 'app/Services/Pinterest/PinRanking.ts')
  )
  const pin = (id, metrics, createdAt) => ({ id, metrics, createdAt })

  // Les vues priment.
  let ranked = rankByPerformance([
    pin('faible', { impression: 12, reaction: 40 }, 1000),
    pin('fort', { impression: 900, reaction: 1 }, 2000),
  ])
  ok(ranked[0].id === 'fort', 'le pin le plus vu est conservé')

  // À vues égales, les « j'aime » départagent.
  ranked = rankByPerformance([
    pin('peu-aime', { impression: 100, reaction: 2 }, 1000),
    pin('tres-aime', { impression: 100, reaction: 30 }, 2000),
  ])
  ok(ranked[0].id === 'tres-aime', 'à vues égales, le plus aimé est conservé')

  // Un pin sans aucune statistique ne doit jamais l'emporter sur un pin qui en a.
  ranked = rankByPerformance([
    pin('sans-stats', {}, 1000),
    pin('avec-stats', { impression: 3 }, 5000),
  ])
  ok(ranked[0].id === 'avec-stats', 'métriques absentes = zéro, jamais gagnant')

  // Égalité parfaite : le plus ancien gagne (mieux établi, mieux indexé).
  ranked = rankByPerformance([
    pin('recent', { impression: 5, reaction: 1 }, 9000),
    pin('ancien', { impression: 5, reaction: 1 }, 1000),
  ])
  ok(ranked[0].id === 'ancien', 'à égalité parfaite, le pin le plus ancien est conservé')

  // Le tri ne doit pas muter l'entrée de l'appelant.
  const input = [pin('a', { impression: 1 }, 1), pin('b', { impression: 2 }, 2)]
  rankByPerformance(input)
  ok(input[0].id === 'a', 'le classement ne mute pas le tableau fourni')

  // Un seul perdant par paire, jamais plus.
  const trio = rankByPerformance([
    pin('x', { impression: 1 }, 1),
    pin('y', { impression: 2 }, 2),
    pin('z', { impression: 3 }, 3),
  ])
  ok(trio.length === 3 && trio[0].id === 'z', 'un groupe de 3 est ordonné du meilleur au pire')
}

// ── 3. Un produit n'est publié qu'une seule fois, tous boards confondus ──────────────────
{
  const PublicationSelector = loadTsModule(
    path.join(ROOT, 'app/Services/Pinterest/PublicationSelector.ts')
  ).default

  const board = (id, name) => ({ id, name, privacy: 'PUBLIC' })
  const product = (id, createdAt) => ({
    id: `gid://shopify/Product/${id}`,
    title: `Tableau chat ${id}`,
    createdAt,
    artworkTypeMetafield: { value: 'painting' },
    // La collection mère est ce qui rattache un produit à ses boards.
    metafields: {
      edges: [
        {
          node: {
            namespace: 'link',
            key: 'mother_collection',
            reference: { title: 'Tableau Chat Chambre' },
          },
        },
      ],
    },
    onlineStoreUrl: `https://www.myselfmonart.com/products/p${id}`,
    media: {
      nodes: [0, 1, 2, 3].map((i) => ({
        mediaContentType: 'IMAGE',
        alt: 'alt',
        image: { url: `https://cdn.test/${id}-${i}.jpg` },
      })),
    },
  })

  // Deux boards correspondent au même produit : c'est précisément la situation qui, avec
  // une déduplication par paire (produit × board), republiait le tableau sur le second.
  const boards = [board('b1', 'Tableau Décoration Chat'), board('b2', 'Tableau Décoration Chambre')]
  const products = [product('1', '2026-01-01'), product('2', '2026-02-01')]

  const published = new Set(['gid://shopify/Product/2'])
  const selector = new PublicationSelector(boards, [], products, published)

  return selector.selectNextProductToPublish().then(async (first) => {
    ok(first !== null, 'un produit non publié reste sélectionnable')
    ok(
      first && first.product.id === 'gid://shopify/Product/1',
      'le produit déjà publié est écarté, quel que soit le board'
    )

    // Une fois les deux produits au registre, plus rien n'est éligible : le cron saute son
    // tour au lieu de republier (et sans lever d'erreur cinq fois par jour).
    const exhausted = new PublicationSelector(
      boards,
      [],
      products,
      new Set(products.map((p) => p.id))
    )
    ok(
      (await exhausted.selectNextProductToPublish()) === null,
      'catalogue épuisé = null, pas de republication'
    )

    // Même sans trace en base, un pin vivant pointant vers le produit suffit à l'exclure.
    const livePin = {
      id: 'pin1',
      board_id: 'b1',
      link: 'https://www.myselfmonart.com/products/p1?shopify_product_id=gid://shopify/Product/1',
    }
    const withLivePin = new PublicationSelector(boards, [livePin], [products[0]], new Set())
    ok(
      (await withLivePin.selectNextProductToPublish()) === null,
      'un pin déjà en ligne exclut le produit même sans trace en base'
    )

    console.log(`\n  ${pass} assertions OK, ${fail} en échec\n`)
    if (fail > 0) process.exit(1)
  })
}
