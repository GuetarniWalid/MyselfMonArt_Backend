/* ===== MyselfMonArt — file de revue artiste (poster perso foot, M5) =====
   Pattern Publisher : vanilla JS, fetch same-origin (cookie de session envoyé d'office).
   API : /admin/custom-art/review (list / :uuid/retry / :uuid/result). */
const $ = (s, r = document) => r.querySelector(s)

const API = '/admin/custom-art/review'
const ADMIN = '/admin/custom-art'

const state = {
  jobs: [], // [{uuid, playerName, playerNumber, team, format, frame, reason, photoUrl, candidates}]
  providers: [], // maillons relançables, ex 'gemini:gemini-3-pro-image'
  creations: [], // toutes les créations actionnables (pas seulement celles en revue)
  creationsChargees: false, // évite d'afficher « introuvable » avant le 1er chargement
  suivi: [], // relances que l'atelier garde sous les yeux : [{uuid, nom, provider, depuis}]
}

/* ---------- Toast ---------- */
let toastT
function toast(msg, kind = '') {
  const el = $('#toast')
  el.textContent = msg
  el.className = 'toast ' + kind
  clearTimeout(toastT)
  toastT = setTimeout(() => el.classList.add('hidden'), 3200)
  el.classList.remove('hidden')
}

/* ---------- Helpers HTTP (toujours JSON en retour) ---------- */
async function req(url, options = {}) {
  const rsp = await fetch(url, options)
  let body = null
  try {
    body = await rsp.json()
  } catch {
    /* réponse non-JSON (ex: redirection login) */
  }
  if (!rsp.ok || !body || body.success === false) {
    const msg =
      (body && body.message) ||
      (rsp.status === 401 ? 'Session expirée — reconnecte-toi.' : `Erreur serveur (${rsp.status})`)
    throw new Error(msg)
  }
  return body.data
}

async function api(path, options = {}) {
  return req(API + path, options)
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ---------- Rendu de la file ---------- */
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function renderQueue() {
  const queue = $('#queue')
  $('#countHint').textContent = `${state.jobs.length} en attente`

  if (state.jobs.length === 0) {
    queue.innerHTML = '<p class="empty-row">Aucune création en attente de revue. 🎉</p>'
    return
  }

  const providerOptions = state.providers
    .map((p) => `<option value="${esc(p)}">${esc(p)}</option>`)
    .join('')

  queue.innerHTML = state.jobs
    .map((job) => {
      const cands = (job.candidates || [])
        .map(
          (c) => `
          <span class="cand" title="${esc(c.reason || '')}">
            <img src="${esc(c.previewUrl)}" alt="candidat ${esc(c.provider)}" loading="lazy">
            <span class="cand-score">${c.pass ? '✓' : '✗'} ${esc(c.score)}${c.suspicion ? ` · s${esc(c.suspicion)}` : ''}</span>
          </span>`
        )
        .join('')
      // Jobs génériques (recette produit) : pas de numéro — playerName porte le libellé
      // (titre/tokens) et `inputs` détaille les textes que l'artiste doit reproduire.
      const title =
        job.playerNumber != null
          ? `${esc(job.playerName)} · n°${esc(job.playerNumber)}`
          : esc(job.playerName || '—')
      const inputsLine = job.inputs
        ? `<span class="review-meta">textes : ${esc((job.inputs.tokens || []).join(' · '))}${
            job.inputs.title ? ` — titre : « ${esc(job.inputs.title)} »` : ''
          }</span>`
        : ''
      return `
      <article class="review-card" data-uuid="${esc(job.uuid)}">
        <img class="review-photo" src="${esc(job.photoUrl)}" alt="photo client" loading="lazy">
        <div class="review-main">
          <div class="review-head">
            <span class="review-title">${title}</span>
            <span class="review-meta">${esc(job.team)} — ${esc(job.format)} / ${esc(job.frame)}</span>
            ${inputsLine}
            <span class="review-meta">reçu le ${esc(fmtDate(job.createdAt))}</span>
          </div>
          ${job.reason ? `<p class="review-reason">${esc(job.reason)}</p>` : ''}
          ${cands ? `<div class="review-candidates">${cands}</div>` : ''}
          <div class="review-actions">
            <select aria-label="Provider de relance" data-role="provider">${providerOptions}</select>
            <button class="ghost-btn small" data-action="retry">↻ Relancer avec ce provider</button>
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-role="file">
            <button class="primary-btn small" data-action="attach">⬆ Attacher le résultat final</button>
            <button class="ghost-btn small danger" data-action="dismiss">🗑 Retirer de la file</button>
          </div>
        </div>
      </article>`
    })
    .join('')
}

async function loadQueue() {
  try {
    const data = await api('')
    state.jobs = data.jobs || []
    state.providers = data.providers || []
    renderQueue()
  } catch (e) {
    $('#queue').innerHTML = `<p class="empty-row">${esc(e.message)}</p>`
  }
}

/* ---------- Actions ---------- */
$('#queue').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const card = btn.closest('.review-card')
  const uuid = card && card.dataset.uuid
  if (!uuid) return

  if (btn.dataset.action === 'retry') {
    const provider = card.querySelector('[data-role="provider"]').value
    if (!provider) return toast('Choisis un provider.', 'err')
    if (!confirm(`Relancer cette création avec ${provider} ? (génération payante)`)) return
    btn.disabled = true
    try {
      await api(`/${uuid}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      // La création quitte la file (elle n'est plus `manual_review`) : sans trace, elle
      // « disparaissait » sous les yeux de l'atelier. On la met sous suivi à la place.
      const nom = ((card.querySelector('.review-title') || {}).textContent || 'création').trim()
      state.suivi = [
        { uuid, nom, provider, depuis: new Date().toISOString() },
        ...state.suivi.filter((s) => s.uuid !== uuid),
      ]
      ecrireSuivi(state.suivi)
      toast('Relancée — suis-la dans « Relances en cours ».', 'ok')
      state.jobs = state.jobs.filter((j) => j.uuid !== uuid)
      renderQueue()
      renderSuivi()
      loadCreations()
    } catch (err) {
      toast(err.message, 'err')
      btn.disabled = false
    }
  }

  // Retrait d'une création sans objet (test, doublon, demande abandonnée). Effacement RÉEL des
  // fichiers (photo du client comprise) : on confirme, et on nomme la création dans la question.
  if (btn.dataset.action === 'dismiss') {
    const nom = (card.querySelector('.review-title') || {}).textContent || 'cette création'
    if (
      !confirm(`Retirer ${nom.trim()} de la file ?

La photo du client et les rendus déjà générés seront définitivement supprimés. Une création achetée ne peut pas être retirée.`)
    )
      return
    btn.disabled = true
    btn.textContent = 'Retrait…'
    try {
      await api(`/${uuid}/dismiss`, { method: 'POST' })
      card.remove()
      toast('Création retirée de la file ✓')
      if (!document.querySelectorAll('.review-card').length) loadQueue()
    } catch (err) {
      alert(err.message || 'Retrait impossible.')
      btn.disabled = false
      btn.textContent = '🗑 Retirer de la file'
    }
    return
  }

  if (btn.dataset.action === 'attach') {
    const input = card.querySelector('[data-role="file"]')
    input.onchange = async () => {
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      const fd = new FormData()
      fd.append('image', file)
      btn.disabled = true
      btn.textContent = 'Envoi en cours…'
      try {
        await api(`/${uuid}/result`, { method: 'POST', body: fd })
        toast('Résultat attaché — le client voit son tableau (ready).', 'ok')
        state.jobs = state.jobs.filter((j) => j.uuid !== uuid)
        renderQueue()
      } catch (err) {
        toast(err.message, 'err')
        btn.disabled = false
        btn.textContent = '⬆ Attacher le résultat final'
      }
    }
    input.click()
  }
})

/* ===================== Toutes les créations =====================
   La file du haut ne montre que `manual_review` : une création qui aboutit en sort et
   devenait introuvable — impossible de savoir à qui écrire ni de corriger l'image
   (incident 30/08/2026). Ici on la retrouve, avec les deux seules actions qui restent
   utiles : remplacer l'image, prévenir la cliente. */

function creationRow(c) {
  const titre = c.numero != null ? `${esc(c.nom)} · n°${esc(c.numero)}` : esc(c.nom)
  const thumb = c.apercuUrl
    ? `<img class="crea-thumb" src="${esc(c.apercuUrl)}" alt="aperçu de la création" loading="lazy">`
    : '<div class="crea-thumb"></div>'

  // L'état de l'e-mail est porté par la ligne d'adresse : c'est ce qui décide si on clique.
  const ligneMail = c.email
    ? c.mailPretEnvoyeLe
      ? `${esc(c.email)} — prévenue le ${esc(fmtDate(c.mailPretEnvoyeLe))}`
      : `${esc(c.email)} — jamais prévenue`
    : 'aucune adresse laissée — impossible de lui écrire'

  const peutAttacher = c.statut === 'ready' || c.statut === 'manual_review'
  const peutEcrire = Boolean(c.email) && c.statut === 'ready'

  return `
  <article class="crea" data-uuid="${esc(c.uuid)}">
    ${thumb}
    <div class="crea-id">
      <span class="crea-name">${titre}
        <span class="crea-state ${c.statut === 'manual_review' ? 'is-review' : ''}">${esc(c.statutLisible)}</span>
        ${c.achetee ? '<span class="crea-state">achetée</span>' : ''}
      </span>
      <span class="crea-line">${esc(c.option)} — ${esc(c.format)} / ${esc(c.frame)} · reçue le ${esc(fmtDate(c.creeLe))}</span>
      <span class="crea-line">${ligneMail}</span>
    </div>
    <div class="crea-actions">
      <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-role="file">
      ${peutAttacher ? '<button class="ghost-btn small" data-action="crea-attach">⬆ Remplacer l\'image</button>' : ''}
      ${peutEcrire ? `<button class="primary-btn small" data-action="crea-mail">✉ ${c.mailPretEnvoyeLe ? 'Renvoyer' : 'Envoyer'} l'e-mail</button>` : ''}
    </div>
  </article>`
}

function renderCreations() {
  const box = $('#creations')
  const q = ($('#creationsSearch').value || '').trim().toLowerCase()
  const rows = state.creations.filter(
    (c) =>
      !q || [c.nom, c.option, c.email, c.uuid].some((v) => v && String(v).toLowerCase().includes(q))
  )
  $('#creationsHint').textContent = q
    ? `${rows.length} sur ${state.creations.length}`
    : `${state.creations.length} création${state.creations.length > 1 ? 's' : ''}`

  box.innerHTML = rows.length
    ? rows.map(creationRow).join('')
    : `<p class="empty-row">${q ? 'Aucune création ne correspond.' : 'Aucune création.'}</p>`
}

async function loadCreations() {
  try {
    const data = await req(`${ADMIN}/creations`)
    state.creations = data.creations || []
    state.creationsChargees = true
    renderCreations()
    // Le suivi des relances lit son état ICI : une seule source, un seul appel réseau.
    renderSuivi()
    planifierSuivi()
  } catch (e) {
    $('#creations').innerHTML = `<p class="empty-row">${esc(e.message)}</p>`
  }
}

/* ===================== Relances en cours =====================
   Un clic sur « Relancer » sort la création de `manual_review`, donc de la file : elle
   disparaissait de l'écran sur-le-champ, sans rien laisser. C'est exactement ce qu'a vécu
   l'atelier le 30/08/2026. Elle reste désormais ici, avec son état réel, jusqu'à ce que
   l'atelier la retire lui-même. Mémorisé par onglet (sessionStorage) : un rafraîchissement
   ne perd pas le fil. */

const SUIVI_KEY = 'ca_suivi'
const SUIVI_TERMINAL = ['ready', 'failed', 'manual_review']
const SUIVI_POLL_MS = 8000
let suiviTimer = null

function lireSuivi() {
  try {
    const v = JSON.parse(sessionStorage.getItem(SUIVI_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function ecrireSuivi(v) {
  try {
    sessionStorage.setItem(SUIVI_KEY, JSON.stringify(v))
  } catch {
    /* navigation privée : le suivi vit alors le temps de la page */
  }
}

function renderSuivi() {
  const carte = $('#suiviCard')
  const box = $('#suivi')
  if (!state.suivi.length) {
    carte.hidden = true
    box.innerHTML = ''
    return
  }
  carte.hidden = false
  $('#suiviHint').textContent = `${state.suivi.length} en suivi`

  box.innerHTML = state.suivi
    .map((s) => {
      const live = state.creations.find((c) => c.uuid === s.uuid)
      const etat = live
        ? live.statutLisible
        : state.creationsChargees
          ? 'introuvable'
          : 'chargement…'
      const fini = Boolean(live) && SUIVI_TERMINAL.includes(live.statut)
      const thumb =
        live && live.apercuUrl
          ? `<img class="crea-thumb" src="${esc(live.apercuUrl)}" alt="aperçu de la création" loading="lazy">`
          : '<div class="crea-thumb"></div>'
      // Ce que l'atelier doit faire ensuite, en une ligne — pas un journal d'état.
      const suite = !live
        ? state.creationsChargees
          ? 'cette création n’est plus dans la liste (expirée ou retirée)'
          : '…'
        : live.statut === 'ready'
          ? 'le tableau est prêt — la cliente peut le voir et commander'
          : live.statut === 'manual_review'
            ? 'revenue en revue : elle est de nouveau dans la file du dessus'
            : live.statut === 'failed'
              ? 'la relance a échoué'
              : 'génération en cours…'
      return `
      <article class="crea" data-uuid="${esc(s.uuid)}">
        ${thumb}
        <div class="crea-id">
          <span class="crea-name">${esc(s.nom)}
            <span class="crea-state ${live && live.statut === 'manual_review' ? 'is-review' : ''}">${esc(etat)}</span>
          </span>
          <span class="crea-line">relancée avec ${esc(s.provider)} · ${esc(fmtDate(s.depuis))}</span>
          <span class="crea-line">${esc(suite)}</span>
        </div>
        <div class="crea-actions">
          <button class="ghost-btn small" data-action="suivi-stop">${fini ? '✓ Retirer du suivi' : 'Arrêter le suivi'}</button>
        </div>
      </article>`
    })
    .join('')
}

/** Re-scrute tant qu'une relance suivie n'a pas atteint un état terminal. */
function planifierSuivi() {
  clearTimeout(suiviTimer)
  const enCours = state.suivi.some((s) => {
    const live = state.creations.find((c) => c.uuid === s.uuid)
    // Introuvable APRÈS chargement (expirée, retirée) : plus rien à attendre — sinon on
    // scruterait indéfiniment une création qui ne reviendra jamais dans la liste.
    if (!live) return !state.creationsChargees
    return !SUIVI_TERMINAL.includes(live.statut)
  })
  if (!enCours) return
  suiviTimer = setTimeout(loadCreations, SUIVI_POLL_MS)
}

$('#suivi').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="suivi-stop"]')
  if (!btn) return
  const card = btn.closest('.crea')
  if (!card) return
  state.suivi = state.suivi.filter((s) => s.uuid !== card.dataset.uuid)
  ecrireSuivi(state.suivi)
  renderSuivi()
  planifierSuivi()
})

$('#creationsSearch').addEventListener('input', renderCreations)

$('#creations').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const card = btn.closest('.crea')
  const uuid = card && card.dataset.uuid
  if (!uuid) return
  const crea = state.creations.find((c) => c.uuid === uuid)
  if (!crea) return

  // Remplacer l'image : même endpoint que la file du haut, qui accepte désormais `ready`.
  // Sur une création DÉJÀ ACHETÉE, le remplacement change le fichier qui partira à
  // l'impression : on le dit avant, plutôt que de le découvrir sur le tirage.
  if (btn.dataset.action === 'crea-attach') {
    if (
      crea.achetee &&
      !confirm(
        `Cette création a été ACHETÉE.\n\nRemplacer son image change le fichier qui part à l’impression. Si le tirage est déjà lancé, il faudra le refaire.\n\nContinuer ?`
      )
    ) {
      return
    }
    const input = card.querySelector('[data-role="file"]')
    input.onchange = async () => {
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      const fd = new FormData()
      fd.append('image', file)
      btn.disabled = true
      btn.textContent = 'Envoi en cours…'
      try {
        await api(`/${uuid}/result`, { method: 'POST', body: fd })
        toast('Image remplacée — c’est elle que voit la cliente.', 'ok')
        await Promise.all([loadCreations(), loadQueue()])
      } catch (err) {
        toast(err.message, 'err')
        btn.disabled = false
        btn.textContent = "⬆ Remplacer l'image"
      }
    }
    input.click()
    return
  }

  // Écrire à la cliente : action sortante et irréversible -> on nomme l'adresse dans la question.
  if (btn.dataset.action === 'crea-mail') {
    const question = crea.mailPretEnvoyeLe
      ? `Renvoyer l’e-mail « votre création est prête » à ${crea.email} ?\n\nElle a déjà été prévenue le ${fmtDate(crea.mailPretEnvoyeLe)}.`
      : `Envoyer l’e-mail « votre création est prête » à ${crea.email} ?`
    if (!confirm(question)) return
    btn.disabled = true
    btn.textContent = 'Envoi…'
    try {
      await req(`${ADMIN}/creations/${uuid}/ready-mail`, { method: 'POST' })
      toast(`E-mail envoyé à ${crea.email} ✓`, 'ok')
      await loadCreations()
    } catch (err) {
      toast(err.message, 'err')
      btn.disabled = false
      btn.textContent = "✉ Envoyer l'e-mail"
    }
  }
})

$('#refreshBtn').addEventListener('click', () => {
  loadQueue()
  loadCreations()
})

state.suivi = lireSuivi()
renderSuivi()

loadQueue()
loadCreations()
