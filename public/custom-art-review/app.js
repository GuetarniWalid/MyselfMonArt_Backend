/* ===== MyselfMonArt — file de revue artiste (poster perso foot, M5) =====
   Pattern Publisher : vanilla JS, fetch same-origin (cookie de session envoyé d'office).
   API : /admin/custom-art/review (list / :uuid/retry / :uuid/result). */
const $ = (s, r = document) => r.querySelector(s)

const API = '/admin/custom-art/review'

const state = {
  jobs: [], // [{uuid, playerName, playerNumber, team, format, frame, reason, photoUrl, candidates}]
  providers: [], // maillons relançables, ex 'gemini:gemini-3-pro-image'
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
async function api(path, options = {}) {
  const rsp = await fetch(API + path, options)
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
      toast('Job relancé — il quitte la file.', 'ok')
      state.jobs = state.jobs.filter((j) => j.uuid !== uuid)
      renderQueue()
    } catch (err) {
      toast(err.message, 'err')
      btn.disabled = false
    }
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

$('#refreshBtn').addEventListener('click', loadQueue)

loadQueue()
