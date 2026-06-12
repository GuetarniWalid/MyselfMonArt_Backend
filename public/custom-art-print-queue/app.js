/* ===== MyselfMonArt — file print (poster perso foot, M9) =====
   Pattern Publisher : vanilla JS, fetch same-origin (cookie de session envoyé d'office).
   API : /admin/custom-art/print-queue (list / :id/file / :id/download /
         :id/approve / :id/regenerate / :id/ordered). */
const $ = (s, r = document) => r.querySelector(s)

const API = '/admin/custom-art/print-queue'

const STATUSES = [
  { key: 'all', label: 'Toutes' },
  { key: 'awaiting_file', label: 'Fichier en préparation' },
  { key: 'awaiting_review', label: 'À valider' },
  { key: 'approved', label: 'Approuvées' },
  { key: 'ordered', label: 'Commandées Picanova' },
  { key: 'shipped', label: 'Expédiées' },
]

const state = {
  orders: [], // [{id, orderName, printStatus, printError, fileUrl, downloadUrl, previewUrl, job, ...}]
  filter: 'awaiting_review',
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

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/* ---------- Onglets de statut ---------- */
function renderTabs() {
  const counts = {}
  for (const o of state.orders) counts[o.printStatus] = (counts[o.printStatus] || 0) + 1
  $('#statusTabs').innerHTML = STATUSES.map((s) => {
    const n = s.key === 'all' ? state.orders.length : counts[s.key] || 0
    const active = state.filter === s.key ? ' active' : ''
    return `<button class="tab${active}" data-filter="${s.key}">${esc(s.label)} <span class="tab-count">${n}</span></button>`
  }).join('')
}

/* ---------- Rendu de la file ---------- */
function statusBadge(status) {
  const labels = {
    awaiting_file: 'fichier en préparation',
    awaiting_review: 'à valider',
    approved: 'approuvée',
    ordered: 'commandée Picanova',
    shipped: 'expédiée',
  }
  return `<span class="badge badge-${esc(status)}">${esc(labels[status] || status)}</span>`
}

function actionsFor(order) {
  const buttons = []
  if (order.printStatus === 'awaiting_review' && order.fileUrl) {
    buttons.push(
      `<button class="primary-btn small" data-action="approve">✓ Approuver</button>`,
      `<button class="ghost-btn small" data-action="zoom">🔍 Voir à 100 %</button>`
    )
  } else if (order.fileUrl) {
    buttons.push(`<button class="ghost-btn small" data-action="zoom">🔍 Voir à 100 %</button>`)
  }
  if (order.printStatus === 'approved') {
    buttons.push(
      `<button class="primary-btn small" data-action="ordered">📦 Marquer commandée Picanova</button>`
    )
  }
  if (order.printStatus !== 'ordered' && order.printStatus !== 'shipped') {
    buttons.push(
      `<button class="ghost-btn small" data-action="regenerate">↻ Régénérer l'upscale</button>`
    )
  }
  if (order.downloadUrl) {
    buttons.push(
      `<a class="ghost-btn small" href="${esc(order.downloadUrl)}" data-noaction>⬇ Télécharger le fichier print</a>`
    )
  }
  if (order.shopifyAdminUrl) {
    buttons.push(
      `<a class="ghost-btn small" href="${esc(order.shopifyAdminUrl)}" target="_blank" rel="noopener" data-noaction>↗ Commande Shopify</a>`
    )
  }
  return buttons.join('')
}

function renderQueue() {
  renderTabs()
  const queue = $('#queue')
  const filtered =
    state.filter === 'all'
      ? state.orders
      : state.orders.filter((o) => o.printStatus === state.filter)
  $('#countHint').textContent = `${filtered.length} commande(s)`

  if (filtered.length === 0) {
    queue.innerHTML = '<p class="empty-row">Aucune commande dans ce statut.</p>'
    return
  }

  queue.innerHTML = filtered
    .map((order) => {
      const job = order.job || {}
      // Vignette : fichier print si dispo (rendu réel), sinon aperçu watermarké
      const thumb = order.fileUrl ? `${order.fileUrl}?w=480` : order.previewUrl || ''
      return `
      <article class="print-card" data-id="${esc(order.id)}">
        ${
          thumb
            ? `<img class="print-thumb" src="${esc(thumb)}" alt="visuel commande ${esc(order.orderName || order.shopifyOrderId)}" loading="lazy" ${order.fileUrl ? 'data-action="zoom" title="Voir à 100 %"' : ''}>`
            : '<div class="print-thumb print-thumb-empty">en préparation…</div>'
        }
        <div class="print-main">
          <div class="print-head">
            <span class="print-title">${esc(order.orderName || '#' + order.shopifyOrderId)}</span>
            ${statusBadge(order.printStatus)}
            <span class="print-meta">payée le ${esc(fmtDate(order.createdAt))}</span>
          </div>
          <p class="print-info">
            <strong>${esc(job.playerName || '—')} · n°${esc(job.playerNumber != null ? job.playerNumber : '—')}</strong>
            — ${esc(job.team || '—')} — ${esc(job.format || '—')} / ${esc(job.frame || '—')}
            ${order.printSpec ? `<span class="print-meta"> · fichier ${esc(order.printSpec)}</span>` : ''}
          </p>
          ${order.customerEmail ? `<p class="print-meta">client : ${esc(order.customerEmail)}</p>` : ''}
          ${order.printError ? `<p class="print-error">⚠ ${esc(order.printError)}</p>` : ''}
          <div class="print-actions">${actionsFor(order)}</div>
        </div>
      </article>`
    })
    .join('')
}

async function loadQueue() {
  try {
    const data = await api('')
    state.orders = data.orders || []
    renderQueue()
  } catch (e) {
    $('#queue').innerHTML = `<p class="empty-row">${esc(e.message)}</p>`
  }
}

/* ---------- Visionneuse zoom 100 % ---------- */
const viewer = $('#viewer')
const viewerImg = $('#viewerImg')
let viewerAt100 = false

function openViewer(order) {
  $('#viewerTitle').textContent =
    `${order.orderName || '#' + order.shopifyOrderId} — ${order.printSpec || ''}`
  viewerImg.src = order.fileUrl // pleine résolution
  viewerAt100 = false
  applyViewerZoom()
  viewer.classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

function applyViewerZoom() {
  viewerImg.classList.toggle('at-100', viewerAt100)
  $('#viewerZoom').textContent = viewerAt100 ? 'Ajuster à l’écran' : 'Zoom 100 %'
}

function closeViewer() {
  viewer.classList.add('hidden')
  viewerImg.src = ''
  document.body.style.overflow = ''
}

$('#viewerClose').addEventListener('click', closeViewer)
$('#viewerZoom').addEventListener('click', () => {
  viewerAt100 = !viewerAt100
  applyViewerZoom()
})
viewerImg.addEventListener('click', () => {
  viewerAt100 = !viewerAt100
  applyViewerZoom()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !viewer.classList.contains('hidden')) closeViewer()
})

/* ---------- Actions ---------- */
$('#statusTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-filter]')
  if (!tab) return
  state.filter = tab.dataset.filter
  renderQueue()
})

$('#queue').addEventListener('click', async (e) => {
  if (e.target.closest('[data-noaction]')) return // liens natifs (download, Shopify)
  const el = e.target.closest('[data-action]')
  if (!el) return
  const card = el.closest('.print-card')
  const id = card && card.dataset.id
  if (!id) return
  const order = state.orders.find((o) => String(o.id) === String(id))
  if (!order) return

  if (el.dataset.action === 'zoom') {
    if (order.fileUrl) openViewer(order)
    return
  }

  if (el.dataset.action === 'approve') {
    if (
      !confirm(
        `Approuver le fichier print de ${order.orderName || order.shopifyOrderId} ?\n` +
          'Le client recevra l’email « votre tableau part en production ».'
      )
    ) {
      return
    }
    el.disabled = true
    try {
      const data = await api(`/${id}/approve`, { method: 'POST' })
      order.printStatus = data.printStatus
      toast('Fichier approuvé — pense à passer la commande sur le portail Picanova.', 'ok')
      renderQueue()
    } catch (err) {
      toast(err.message, 'err')
      el.disabled = false
    }
  }

  if (el.dataset.action === 'regenerate') {
    if (
      !confirm(
        `Régénérer le fichier print de ${order.orderName || order.shopifyOrderId} ?\n` +
          '(upscale Replicate payant ~0,01 €)'
      )
    ) {
      return
    }
    el.disabled = true
    try {
      const data = await api(`/${id}/regenerate`, { method: 'POST' })
      order.printStatus = data.printStatus
      order.printError = null
      toast('Préparation relancée — rafraîchis dans ~1 min.', 'ok')
      renderQueue()
    } catch (err) {
      toast(err.message, 'err')
      el.disabled = false
    }
  }

  if (el.dataset.action === 'ordered') {
    if (
      !confirm(
        `Marquer ${order.orderName || order.shopifyOrderId} comme commandée sur le portail Picanova ?`
      )
    ) {
      return
    }
    el.disabled = true
    try {
      const data = await api(`/${id}/ordered`, { method: 'POST' })
      order.printStatus = data.printStatus
      toast('Commande marquée comme passée chez Picanova.', 'ok')
      renderQueue()
    } catch (err) {
      toast(err.message, 'err')
      el.disabled = false
    }
  }
})

$('#refreshBtn').addEventListener('click', loadQueue)

loadQueue()
