/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer''
|
*/

import Route from '@ioc:Adonis/Core/Route'
import Env from '@ioc:Adonis/Core/Env'

Route.get('/', 'DashboardController.index').middleware(['auth'])
// Application "Publisher" : UI servie ici ; le rendu des mockups est délégué au moteur externe (PC via tunnel Cloudflare).
// URL fixe par défaut (tunnel nommé render.myselfmonart.com) ; surchargeable par la variable d'env RENDER_ENGINE_URL.
Route.get('/publisher', async ({ view }) => {
  const renderBase = Env.get('RENDER_ENGINE_URL') || 'https://render.myselfmonart.com'
  return view.render('pages/publisher', { renderBase })
}).middleware(['auth'])
// Mode « reimage » : même UI Publisher, mais pour REMPLACER les images d'un produit
// existant. Le template injecte mode='reimage' dans window.PUBLISHER_CONFIG.
Route.get('/publisher/reimage', async ({ view }) => {
  const renderBase = Env.get('RENDER_ENGINE_URL') || 'https://render.myselfmonart.com'
  return view.render('pages/publisher', { renderBase, mode: 'reimage' })
}).middleware(['auth'])
// Mode « personalized » : même UI Publisher, pour CRÉER un produit poster personnalisé
// (studio de personnalisation piloté par metafields studio.config / studio.recipe).
// Le template injecte mode='personalized' ; la logique front vit dans publisher/personalized.js.
Route.get('/publisher/personalized', async ({ view }) => {
  const renderBase = Env.get('RENDER_ENGINE_URL') || 'https://render.myselfmonart.com'
  return view.render('pages/publisher', { renderBase, mode: 'personalized' })
}).middleware(['auth'])
// Page « posters en masse » : crée 1 poster par toile (mockups favoris dédiés + texte IA), par
// ratio, avec lien bidirectionnel toile↔poster. Même pattern que /publisher (Edge + JS vanilla,
// moteur de rendu du PC injecté). cf. BulkPostersController.
Route.get('/bulk-posters', async ({ view }) => {
  const renderBase = Env.get('RENDER_ENGINE_URL') || 'https://render.myselfmonart.com'
  return view.render('pages/bulk-posters', { renderBase })
}).middleware(['auth'])
Route.post('/', 'WebhooksController.handle')
Route.post('/webhooks', 'WebhooksController.handle')

Route.get('/webhooks/meta', 'MessageInboxController.verify')
Route.post('/webhooks/meta', 'MessageInboxController.receive')

// Gmail push (Pub/Sub) for the SAV email channel. Auth via ?token=<secret>.
Route.post('/webhooks/email', 'EmailInboxController.receive')

Route.group(() => {
  Route.get('/', () => 'test ok')
  Route.get('/websocket', async ({ view }) => {
    return view.render('pages/test-websocket')
  })
}).prefix('/test')

// Mockup API routes
Route.group(() => {
  Route.get('/status', 'MockupController.status')
  Route.post('/add-job', 'MockupController.addJob')
  Route.get('/pending-jobs', 'MockupController.getPendingJobs')
  Route.get('/painting-collections', 'MockupController.getPaintingCollections')
  Route.get('/job-status', 'MockupController.getJobStatus')
  Route.post('/complete', 'MockupController.completeJob')
  Route.post('/upload', 'MockupController.uploadMockup')
  Route.get('/download', 'MockupController.downloadImage')
  Route.post('/start-automation', 'MockupController.startAutomation')
  Route.post('/cleanup', 'MockupController.cleanupFiles')
  Route.post('/cleanup-product', 'MockupController.cleanupProductFiles')
}).prefix('/api/mockup')

Route.group(() => {
  Route.get('/', async ({ ally }) => {
    return ally.use('google').redirect()
  })
  Route.get('/callback', 'SocialAuthsController.index')
  Route.get('/pinterest', 'SocialAuthsController.redirectToPinterest')
  Route.get('/pinterest/callback', 'SocialAuthsController.handlePinterestCallback')
  Route.get('/instagram', 'SocialAuthsController.redirectToInstagram')
  Route.get('/instagram/callback', 'SocialAuthsController.handleInstagramCallback')
}).prefix('/login')

Route.group(() => {
  Route.get('/check', 'PinterestAuthController.checkAuth')
}).prefix('/pinterest')

Route.group(() => {
  Route.get('/backlinks', async ({ view }) => {
    return view.render('pages/backlinks')
  })
})
  .prefix('/dashboard')
  .middleware(['auth'])

Route.group(() => {
  Route.group(() => {
    Route.get('/', 'BacklinksController.index')
    Route.post('/delete', 'BacklinksController.delete')
    Route.post('/check', 'BacklinksController.checkLinks')
  }).prefix('/backlinks')

  Route.group(() => {
    Route.post('/update/metafield/likes-count', 'ProductsController.updateMetafieldLikesCount')
  }).prefix('/product')

  Route.post('/webhooks', 'WebhooksController.handle')

  Route.get('/collections', 'CollectionsController.getByType')

  Route.post(
    '/shopify-product-publisher/publish',
    'ShopifyProductPublishersController.publishOnShopify'
  )

  // Mode « reimage » : remplacement de TOUTES les images d'un produit existant.
  // Auth obligatoire (mutations Shopify + appels IA payants).
  Route.post(
    '/shopify-product-publisher/replace-images',
    'ShopifyProductPublishersController.replaceImages'
  ).middleware(['auth'])

  // Mode « reimage » : recherche du produit à refaire + contexte (orientation
  // verrouillée, type, collection, images actuelles). Auth (données boutique).
  Route.get('/products/search', 'ShopifyProductPublishersController.searchProducts').middleware([
    'auth',
  ])
  Route.get(
    '/products/reimage-context',
    'ShopifyProductPublishersController.reimageContext'
  ).middleware(['auth'])

  // Redimensionnement intelligent d'une oeuvre vers un ratio cible (3:4 / 1:1 / 4:3) via Nano Banana 2.
  // Asynchrone (job + polling) : on reste loin des ~100s que Cloudflare tolère (sinon 524).
  // Auth obligatoire : ces routes déclenchent un appel Gemini PAYANT -> jamais public (la page
  // /publisher est déjà protégée, donc le cookie de session est envoyé sur ces fetch same-origin).
  Route.post('/resize-artwork', 'ResizeArtworkController.resize').middleware(['auth']) // démarre le job -> { jobId }
  Route.get('/resize-artwork/result', 'ResizeArtworkController.result').middleware(['auth']) // état du job (polling)

  // Génération d'un DÉCOR IA (intérieur + cadre vide au bon ratio) via Nano Banana 2.
  // Asynchrone (job + polling) comme le resize. Auth obligatoire (appel Gemini payant).
  Route.post('/generate-decor', 'DecorController.generate').middleware(['auth']) // démarre le job -> { jobId }
  Route.get('/generate-decor/result', 'DecorController.result').middleware(['auth']) // état du job (polling)

  // Insertion de l'oeuvre dans le décor validé via Nano Banana (Gemini). Async (job+polling), auth (payant).
  Route.post('/insert-artwork', 'InsertArtworkController.generate').middleware(['auth']) // démarre le job
  Route.get('/insert-artwork/result', 'InsertArtworkController.result').middleware(['auth']) // état (polling)

  // Nettoyage d'un mockup importé (photo réelle -> marquages retirés, support vidé #ECECEC au
  // ratio de l'œuvre, converti au type produit) via Nano Banana 2. Async (job+polling), auth (payant).
  Route.post('/clean-mockup', 'CleanMockupController.generate').middleware(['auth']) // démarre le job
  Route.get('/clean-mockup/result', 'CleanMockupController.result').middleware(['auth']) // état (polling)
}).prefix('/api')

// Batch « posters en masse » (cf. BulkPostersController). Appelé par le moteur de rendu PC (workflow
// sans navigateur) ET l'ancienne page /bulk-posters. NON authentifié, comme /api/shopify-product-
// publisher/publish (qui crée déjà des produits sans session) : aucun secret à poser nulle part.
// Garde-fou ciblé : delete-draft ne supprime QUE le brouillon réellement enregistré sur la toile
// (link.poster_draft = ce productId) — jamais un produit publié arbitraire.
// create-one = mode COPIE (pivot 30/06) : crée le brouillon SANS IA, texte fourni par l'agent.
Route.group(() => {
  Route.get('/candidates', 'BulkPostersController.candidates')
  Route.post('/create-one', 'BulkPostersController.createOne')
  Route.get('/status', 'BulkPostersController.status')
  Route.post('/finalize', 'BulkPostersController.finalize')
  Route.post('/delete-draft', 'BulkPostersController.deleteDraft')
}).prefix('/api/bulk-posters')

// CustomArt (poster personnalisé foot) — API publique du studio, rate-limitée.
// Génération asynchrone : POST /jobs répond immédiatement (jobId), le front polle
// GET /jobs/:uuid (jamais d'attente synchrone : Cloudflare coupe à ~100s).
// CORS : l'origin boutique est ajouté dans config/cors.ts (STOREFRONT_URL).
Route.group(() => {
  Route.get('/teams', 'CustomArtController.teams').middleware(['throttle:120,60'])
  // Juge « photo-check » : valide la photo TÔT (avant POST /jobs), sans session, par IP.
  // Verdict mis en cache par hash → 1 photo unique = 1 appel LLM max.
  Route.post('/photo-check', 'CustomArtController.photoCheck').middleware(['throttle:30,60'])
  Route.post('/jobs', 'CustomArtController.create').middleware(['throttle:10,60'])
  // Reprise « mon dernier job » (A2) — DOIT précéder /jobs/:uuid, sinon ':uuid' capterait 'last'
  Route.get('/jobs/last', 'CustomArtController.last').middleware(['throttle:120,60'])
  Route.get('/jobs/:uuid', 'CustomArtController.show').middleware(['throttle:120,60'])
  // Preview watermarkée proxifiée (en-tête ACAO pour la texture WebGL du thème)
  Route.get('/jobs/:uuid/preview/:n', 'CustomArtController.preview').middleware(['throttle:120,60'])
  Route.post('/jobs/:uuid/reveal-next', 'CustomArtController.revealNext').middleware([
    'throttle:20,60',
  ])
  Route.post('/jobs/:uuid/save', 'CustomArtController.save').middleware(['throttle:10,60'])
}).prefix('/api/custom-art')

// CustomArt — admin (auth existante) : stats squelette (jobs/jour, coûts, taux de pass)
// + bibliothèque d'équipes (M4) : CRUD + upload des images de maillot de référence
// + file de revue artiste (M5, décision §0.15) : jobs manual_review, relance, résultat manuel
Route.group(() => {
  Route.get('/stats', 'CustomArtController.adminStats')

  Route.get('/teams', 'CustomArtTeamsAdminController.index')
  Route.post('/teams', 'CustomArtTeamsAdminController.store')
  Route.put('/teams/:id', 'CustomArtTeamsAdminController.update')
  Route.post('/teams/:id/toggle-active', 'CustomArtTeamsAdminController.toggleActive')
  Route.post('/teams/:id/kit-images', 'CustomArtTeamsAdminController.uploadKit')
  Route.post('/teams/:id/kit-images/delete', 'CustomArtTeamsAdminController.deleteKit')

  Route.get('/review', 'CustomArtReviewAdminController.index')
  Route.get('/review/:uuid/photo', 'CustomArtReviewAdminController.photo')
  Route.post('/review/:uuid/retry', 'CustomArtReviewAdminController.retry')
  Route.post('/review/:uuid/result', 'CustomArtReviewAdminController.uploadResult')

  // File print (M9, plan §9) : validation humaine de chaque fichier d'impression
  // avant la commande manuelle sur le portail Picanova.
  Route.get('/print-queue', 'CustomArtPrintAdminController.index')
  Route.get('/print-queue/:id/file', 'CustomArtPrintAdminController.file')
  Route.get('/print-queue/:id/download', 'CustomArtPrintAdminController.download')
  Route.post('/print-queue/:id/approve', 'CustomArtPrintAdminController.approve')
  Route.post('/print-queue/:id/regenerate', 'CustomArtPrintAdminController.regenerate')
  Route.post('/print-queue/:id/ordered', 'CustomArtPrintAdminController.markOrdered')
})
  .prefix('/admin/custom-art')
  .middleware(['auth'])

// Page admin de la bibliothèque d'équipes (pattern /publisher : vue Edge + JS vanilla
// dans public/custom-art-teams/ ; les fetch same-origin envoient le cookie de session).
Route.get('/custom-art-teams', async ({ view }) => {
  return view.render('pages/custom-art-teams')
}).middleware(['auth'])

// Page admin de la file de revue artiste (même pattern : Edge + JS vanilla dans
// public/custom-art-review/). Lien envoyé dans l'email de notification manual_review.
Route.get('/custom-art-review', async ({ view }) => {
  return view.render('pages/custom-art-review')
}).middleware(['auth'])

// Page admin de la file print (même pattern : Edge + JS vanilla dans
// public/custom-art-print-queue/). Lien envoyé dans les emails « fichier à valider ».
Route.get('/custom-art-print-queue', async ({ view }) => {
  return view.render('pages/custom-art-print-queue')
}).middleware(['auth'])
