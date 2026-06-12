/* ===== MyselfMonArt — admin bibliothèque d'équipes (poster personnalisé foot, M4) =====
   Pattern Publisher : vanilla JS, fetch same-origin (cookie de session envoyé d'office).
   API : /admin/custom-art/teams (list/create/update/toggle-active/kit-images). */
const $ = (s, r = document) => r.querySelector(s)

const API = '/admin/custom-art/teams'
const MAX_KIT_IMAGES = 3

const state = {
  teams: [], // [{id, name, slug, aliases, colors, kitRefUrls, active}]
  editing: null, // équipe en cours d'édition (null = création)
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

const postJson = (path, payload, method = 'POST') =>
  api(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

/* ---------- Rendu du tableau ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderTable() {
  const body = $('#teamsBody')
  $('#countHint').textContent = `${state.teams.length} équipe${state.teams.length > 1 ? 's' : ''}`

  if (state.teams.length === 0) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty-row">Aucune équipe — ajoute la première.</td></tr>'
    return
  }

  body.innerHTML = state.teams
    .map((t) => {
      const colors = t.colors || {}
      const swatches = ['primary', 'secondary', 'accent']
        .filter((k) => colors[k])
        .map(
          (k) =>
            `<span class="swatch" style="background:${esc(colors[k])}" title="${esc(k)}"></span>`
        )
        .join('')
      const kits = (t.kitRefUrls || [])
        .map(
          (u) =>
            `<img class="kit-thumb" src="${esc(u)}" alt="maillot ${esc(t.name)}" loading="lazy">`
        )
        .join('')
      return `
      <tr class="${t.active ? '' : 'inactive'}" data-id="${t.id}">
        <td>
          <span class="team-name">${esc(t.name)}</span>
          ${t.aliases && t.aliases.length ? `<span class="team-aliases">${esc(t.aliases.join(', '))}</span>` : ''}
        </td>
        <td><code class="slug-code">${esc(t.slug)}</code></td>
        <td>${swatches ? `<span class="swatches">${swatches}</span>` : '<span class="swatch-none">—</span>'}</td>
        <td>${kits ? `<span class="kits">${kits}</span>` : '<span class="kit-missing">à uploader</span>'}</td>
        <td>
          <button class="status-btn ${t.active ? 'on' : 'off'}" data-action="toggle" data-id="${t.id}">
            ${t.active ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button class="ghost-btn small" data-action="edit" data-id="${t.id}">Modifier</button>
          </div>
        </td>
      </tr>`
    })
    .join('')
}

async function loadTeams() {
  try {
    state.teams = await api('')
    renderTable()
  } catch (e) {
    $('#teamsBody').innerHTML = `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`
  }
}

/* ---------- Formulaire ajout / édition ---------- */
const overlay = $('#formOverlay')

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents (diacritiques décomposés par NFD)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function openForm(team = null) {
  state.editing = team
  $('#formTitle').textContent = team ? `Modifier — ${team.name}` : 'Ajouter une équipe'
  $('#fName').value = team ? team.name : ''
  $('#fSlug').value = team ? team.slug : ''
  $('#fSlug').dataset.touched = team ? '1' : '' // slug auto seulement en création
  $('#fAliases').value = team && team.aliases ? team.aliases.join(', ') : ''
  $('#fColorPrimary').value = (team && team.colors && team.colors.primary) || '#1c2024'
  $('#fColorSecondary').value = (team && team.colors && team.colors.secondary) || '#ffffff'
  $('#fFidelityNotes').value = (team && team.fidelityNotes) || ''
  $('#fActive').checked = team ? Boolean(team.active) : true
  renderKitList()
  $('#kitUploadBtn').classList.toggle('hidden', !team)
  $('#kitHint').classList.toggle('hidden', Boolean(team))
  overlay.classList.remove('hidden')
  $('#fName').focus()
}

function closeForm() {
  overlay.classList.add('hidden')
  state.editing = null
}

function renderKitList() {
  const list = $('#kitList')
  const team = state.editing
  const urls = (team && team.kitRefUrls) || []
  list.innerHTML = urls
    .map(
      (u) => `
      <span class="kit-item">
        <img src="${esc(u)}" alt="maillot">
        <button type="button" class="kit-del" data-url="${esc(u)}" title="Supprimer cette image" aria-label="Supprimer cette image">✕</button>
      </span>`
    )
    .join('')
  $('#kitUploadBtn').disabled = urls.length >= MAX_KIT_IMAGES
}

function formPayload() {
  const aliases = $('#fAliases')
    .value.split(',')
    .map((a) => a.trim())
    .filter(Boolean)
  return {
    name: $('#fName').value.trim(),
    slug: $('#fSlug').value.trim(),
    aliases,
    colors: {
      primary: $('#fColorPrimary').value,
      secondary: $('#fColorSecondary').value,
    },
    // null = notes vidées (le back remet la colonne à NULL)
    fidelityNotes: $('#fFidelityNotes').value.trim() || null,
    active: $('#fActive').checked,
  }
}

/** Remplace/insère l'équipe retournée par l'API dans le state local. */
function upsertTeam(updated) {
  const idx = state.teams.findIndex((t) => t.id === updated.id)
  if (idx === -1) state.teams.push(updated)
  else state.teams[idx] = updated
  state.teams.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  renderTable()
  return updated
}

/* ---------- Événements ---------- */
$('#addBtn').addEventListener('click', () => openForm(null))
$('#cancelBtn').addEventListener('click', closeForm)
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeForm()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeForm()
})

// Slug auto-généré depuis le nom tant que l'admin n'y a pas touché
$('#fName').addEventListener('input', () => {
  if (!$('#fSlug').dataset.touched) $('#fSlug').value = slugify($('#fName').value)
})
$('#fSlug').addEventListener('input', () => {
  $('#fSlug').dataset.touched = '1'
})

$('#teamForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const payload = formPayload()
  if (!payload.name || !payload.slug) return toast('Nom et slug sont requis.', 'err')

  const btn = $('#saveBtn')
  btn.disabled = true
  try {
    if (state.editing) {
      const updated = await postJson(`/${state.editing.id}`, payload, 'PUT')
      state.editing = upsertTeam(updated)
      toast('Équipe mise à jour.', 'ok')
    } else {
      const created = await postJson('', payload)
      state.editing = upsertTeam(created)
      // Passe en mode édition : l'upload des maillots devient possible sans fermer
      $('#formTitle').textContent = `Modifier — ${created.name}`
      $('#fSlug').dataset.touched = '1'
      $('#kitUploadBtn').classList.remove('hidden')
      $('#kitHint').classList.add('hidden')
      renderKitList()
      toast('Équipe créée — ajoute maintenant ses images de maillot.', 'ok')
    }
  } catch (err) {
    toast(err.message, 'err')
  } finally {
    btn.disabled = false
  }
})

// Upload des images de maillot (multipart, équipe existante uniquement)
$('#kitUploadBtn').addEventListener('click', () => $('#kitInput').click())
$('#kitInput').addEventListener('change', async (e) => {
  const team = state.editing
  const files = [...e.target.files]
  e.target.value = '' // permet de re-sélectionner les mêmes fichiers
  if (!team || files.length === 0) return

  const remaining = MAX_KIT_IMAGES - (team.kitRefUrls || []).length
  if (files.length > remaining) {
    return toast(`Maximum ${MAX_KIT_IMAGES} images par équipe (${remaining} restante(s)).`, 'err')
  }

  const fd = new FormData()
  files.forEach((f) => fd.append('images', f))

  const btn = $('#kitUploadBtn')
  btn.disabled = true
  btn.textContent = 'Upload en cours…'
  try {
    const updated = await api(`/${team.id}/kit-images`, { method: 'POST', body: fd })
    state.editing = upsertTeam(updated)
    renderKitList()
    toast('Image(s) de maillot ajoutée(s).', 'ok')
  } catch (err) {
    toast(err.message, 'err')
  } finally {
    btn.disabled = false
    btn.textContent = '⬆ Ajouter des images'
    renderKitList()
  }
})

// Suppression d'une image de maillot (délégation sur la liste du formulaire)
$('#kitList').addEventListener('click', async (e) => {
  const btn = e.target.closest('.kit-del')
  const team = state.editing
  if (!btn || !team) return
  if (!confirm('Supprimer cette image de maillot ?')) return
  try {
    const updated = await postJson(`/${team.id}/kit-images/delete`, { url: btn.dataset.url })
    state.editing = upsertTeam(updated)
    renderKitList()
    toast('Image supprimée.', 'ok')
  } catch (err) {
    toast(err.message, 'err')
  }
})

// Actions du tableau (toggle actif / modifier)
$('#teamsBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const team = state.teams.find((t) => t.id === Number(btn.dataset.id))
  if (!team) return

  if (btn.dataset.action === 'edit') return openForm(team)

  if (btn.dataset.action === 'toggle') {
    btn.disabled = true
    try {
      const updated = await postJson(`/${team.id}/toggle-active`, {})
      upsertTeam(updated)
      toast(updated.active ? `${updated.name} activée.` : `${updated.name} désactivée.`, 'ok')
    } catch (err) {
      toast(err.message, 'err')
      btn.disabled = false
    }
  }
})

loadTeams()
