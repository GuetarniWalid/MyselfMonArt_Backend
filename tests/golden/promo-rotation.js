/**
 * Test « golden » de la ROTATION DU CODE PROMO (app/Services/PromoRotation).
 *
 * POURQUOI CE TEST EXISTE
 * Le dispositif doit tourner des années sans que personne ne le regarde. Ses deux pièces
 * les plus fragiles ne provoquent aucune erreur quand elles se trompent :
 *
 *  1. L'HEURE D'ÉTÉ. `startsAt`/`endsAt` sont des instants ABSOLUS. Envoyer 23:59:59Z pour
 *     une boutique parisienne fait expirer la remise une à deux heures trop tard, et l'écart
 *     change deux fois par an. Rien ne le signale : le code promo « marche », simplement pas
 *     aux bonnes heures. On vérifie donc chaque semaine de 2026 et 2027 contre un ORACLE
 *     INDÉPENDANT — l'algorithme `Intl` en deux passes du brief — pour prouver que le calcul
 *     via Luxon donne exactement le même instant.
 *
 *  2. LE RECOUVREMENT DE 7 JOURS. Les pages boutique sont mises en cache et Shopify ne
 *     documente ni TTL ni purge : un visiteur peut recevoir une page portant le code de la
 *     semaine précédente. Si la validité cessait de dépasser la fenêtre d'affichage, ce
 *     client verrait son code REFUSÉ au checkout — une vente perdue, invisible côté serveur.
 *     Le recouvrement est donc verrouillé ici, pas seulement commenté.
 *
 * On verrouille aussi le déterminisme du code (c'est lui qui rend le cron rejouable sans
 * créer de remise en double) et la cohérence `ends_at` / `ends_ts` (deux métachamps qui
 * DOIVENT décrire le même instant à la seconde).
 *
 * POURQUOI PAS JAPA : mêmes raisons que les autres goldens — de l'arithmétique pure, on
 * transpile le TypeScript en mémoire, `node` suffit.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const ts = require(path.join(ROOT, 'node_modules/typescript'))

const TZ = 'Europe/Paris'
const SECRET = 'secret-de-test-jamais-en-prod'

const STUBS = {
  '@ioc:Adonis/Core/Env': { __esModule: true, default: { get: () => SECRET } },
}

function loadTsModule(absPath, extraStubs = {}) {
  const js = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const stubs = { ...STUBS, ...extraStubs }
  const module = { exports: {} }
  const req = (id) => (stubs[id] ? stubs[id] : require(id))
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(req, module, module.exports)
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

const week = loadTsModule(path.join(ROOT, 'app/Services/PromoRotation/week.ts'))
const code = loadTsModule(path.join(ROOT, 'app/Services/PromoRotation/code.ts'))
const { DateTime } = require(path.join(ROOT, 'node_modules/luxon'))

// ── L'ORACLE : l'algorithme du brief, en Intl pur, sans Luxon ────────────────────────────
// Instant UTC de 23:59:59 heure locale. Deux passes : la première estime le décalage, la
// seconde le corrige si l'estimation tombait du mauvais côté d'une bascule d'heure d'été.
function endOfDayUtc(y, m, d, tz = TZ) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const offsetAt = (date) => {
    const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]))
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
    return asUtc - date.getTime()
  }
  const naive = Date.UTC(y, m - 1, d, 23, 59, 59)
  let inst = new Date(naive - offsetAt(new Date(naive)))
  inst = new Date(naive - offsetAt(inst))
  return inst
}

console.log('\n▸ Rotation du code promo\n')

// ── 1. Le code est déterministe, lisible, et imprévisible sans le secret ─────────────────
{
  const w = '2026-W32'
  const a = code.codeForWeek(w, SECRET)
  const b = code.codeForWeek(w, SECRET)

  ok(a === b, 'même semaine + même secret = même code (idempotence du cron)')
  ok(/^MERCI-[A-Z2-9]{5}$/.test(a), `format MERCI-XXXXX (obtenu : ${a})`)
  ok(
    !/[ILO01]/.test(a.slice(6)),
    'aucun caractère ambigu (I, L, O, 0, 1) — le code est retapé à la main'
  )
  ok(
    code.codeForWeek('2026-W33', SECRET) !== a,
    'deux semaines consécutives donnent deux codes différents'
  )
  ok(
    code.codeForWeek(w, 'un-autre-secret') !== a,
    'sans le secret, le code de la semaine n’est pas devinable'
  )

  // Distribution : sur 520 semaines (10 ans), aucune collision ne doit apparaître.
  const seen = new Set()
  for (let y = 2026; y < 2036; y++) {
    for (let n = 1; n <= 52; n++) {
      seen.add(code.codeForWeek(week.formatIsoWeek(y, n), SECRET))
    }
  }
  ok(seen.size === 520, `520 semaines, ${seen.size} codes distincts (aucune collision sur 10 ans)`)
}

// ── 2. La fenêtre : lundi 00:00:00 → dimanche J+13 23:59:59, heure BOUTIQUE ──────────────
{
  const w = week.windowForWeek('2026-W32', TZ)

  ok(w.startsAt.weekday === 1, 'la validité démarre un lundi')
  ok(
    w.startsAt.hour === 0 && w.startsAt.minute === 0 && w.startsAt.second === 0,
    'elle démarre à 00:00:00 heure boutique'
  )
  ok(w.endsAt.weekday === 7, 'elle s’achève un dimanche')
  ok(
    w.endsAt.hour === 23 && w.endsAt.minute === 59 && w.endsAt.second === 59,
    'elle s’achève à 23:59:59 heure boutique'
  )
  ok(
    w.endsAt.diff(w.startsAt, 'days').days > 13.9 && w.endsAt.diff(w.startsAt, 'days').days < 14,
    'la validité couvre 14 jours calendaires (moins la seconde qui manque à minuit)'
  )
}

// ── 3. LE RECOUVREMENT DE 7 JOURS — ce qui protège les pages en cache ────────────────────
{
  let minOverlapDays = Infinity
  for (let n = 1; n < 52; n++) {
    const current = week.windowForWeek(week.formatIsoWeek(2026, n), TZ)
    const next = week.windowForWeek(week.formatIsoWeek(2026, n + 1), TZ)
    // Quand le code de la semaine suivante s'affiche, celui-ci doit rester valide.
    const overlap = current.endsAt.diff(next.startsAt, 'days').days
    minOverlapDays = Math.min(minOverlapDays, overlap)
  }
  ok(
    minOverlapDays > 6.9 && minOverlapDays < 7.1,
    `l’ancien code reste valide 7 jours après l’affichage du nouveau (min constaté : ${minOverlapDays.toFixed(2)} j)`
  )
}

// ── 4. HEURE D'ÉTÉ : Luxon doit tomber exactement sur l'oracle Intl du brief ─────────────
{
  let mismatches = 0
  let checked = 0
  const offsets = new Set()

  for (const year of [2026, 2027]) {
    for (let n = 1; n <= 52; n++) {
      const w = week.windowForWeek(week.formatIsoWeek(year, n), TZ)
      const oracle = endOfDayUtc(w.endsAt.year, w.endsAt.month, w.endsAt.day, TZ)
      checked++
      offsets.add(w.endsAt.offset)
      if (Math.floor(w.endsAt.toSeconds()) !== Math.floor(oracle.getTime() / 1000)) {
        mismatches++
        if (mismatches <= 3) {
          console.log(
            `        ${year}-W${n}: luxon=${w.endsAt.toISO()} oracle=${oracle.toISOString()}`
          )
        }
      }
    }
  }

  ok(mismatches === 0, `${checked} semaines : Luxon == oracle Intl du brief (${mismatches} écart)`)
  ok(
    offsets.has(120) && offsets.has(60),
    'les deux décalages parisiens sont bien traversés (+02:00 l’été, +01:00 l’hiver)'
  )
}

// La semaine qui ENJAMBE la bascule d'automne : le lundi est en CEST, le dimanche de fin en CET.
{
  // Dernier dimanche d'octobre 2026 = 25/10. La fenêtre qui se termine après cette date
  // doit s'achever à 23:59:59+01:00, pas +02:00.
  const autumn = [...Array(52).keys()]
    .map((i) => week.windowForWeek(week.formatIsoWeek(2026, i + 1), TZ))
    .find((w) => w.startsAt.offset === 120 && w.endsAt.offset === 60)

  ok(autumn !== undefined, 'une fenêtre enjambe bien le retour à l’heure d’hiver')
  if (autumn) {
    ok(
      autumn.endsAt.toISO().endsWith('+01:00') && autumn.endsAt.hour === 23,
      `fin de fenêtre à 23:59:59+01:00 (obtenu : ${autumn.endsAt.toISO()})`
    )
    // Sans la correction de fuseau, on aurait publié une heure de trop.
    const naiveUtc = Date.UTC(
      autumn.endsAt.year,
      autumn.endsAt.month - 1,
      autumn.endsAt.day,
      23,
      59,
      59
    )
    ok(
      Math.floor(autumn.endsAt.toSeconds()) === naiveUtc / 1000 - 3600,
      '23:59:59Z aurait fait expirer la remise 1 h trop tard'
    )
  }
}

// ── 5. `ends_at` (affichage) et `ends_ts` (comparaison) décrivent le MÊME instant ─────────
{
  let drift = 0
  let naiveIso = 0
  for (let n = 1; n <= 52; n++) {
    const w = week.windowForWeek(week.formatIsoWeek(2026, n), TZ)
    const ends = week.renderEnds(w.endsAt, TZ)
    if (DateTime.fromISO(ends.endsAt).toSeconds() !== ends.endsTs) drift++
    // Le champ d'affichage doit porter un DÉCALAGE explicite : une date nue serait lue à
    // minuit UTC par Liquid.
    if (!/[+-]\d{2}:\d{2}$/.test(ends.endsAt)) naiveIso++
  }
  ok(drift === 0, 'ends_at et ends_ts pointent le même instant, à la seconde (52 semaines)')
  ok(naiveIso === 0, 'ends_at porte toujours un décalage explicite (+02:00 / +01:00)')
  ok(
    Number.isInteger(week.renderEnds(week.windowForWeek('2026-W32', TZ).endsAt, TZ).endsTs),
    'ends_ts est un entier (number_integer côté Shopify)'
  )
}

// ── 6. La semaine ISO est lue à l'heure de la BOUTIQUE, pas du serveur ───────────────────
{
  const instant = DateTime.fromISO('2026-08-09T23:30:00+02:00') // dimanche soir à Paris
  ok(
    week.currentIsoWeek(TZ, instant) === '2026-W32',
    `dimanche 23:30 heure de Paris appartient encore à 2026-W32 (obtenu : ${week.currentIsoWeek(TZ, instant)})`
  )
  const justAfter = DateTime.fromISO('2026-08-10T00:30:00+02:00') // lundi, semaine suivante
  ok(
    week.currentIsoWeek(TZ, justAfter) === '2026-W33',
    'la bascule a lieu au lundi 00:00 heure de Paris'
  )
  ok(
    week.currentIsoWeek('UTC', instant) === '2026-W32',
    'le même instant reste W32 en UTC (le test isole bien la logique de semaine)'
  )
}

console.log(`\n  ${pass} ok, ${fail} échec(s)\n`)
process.exit(fail === 0 ? 0 : 1)
