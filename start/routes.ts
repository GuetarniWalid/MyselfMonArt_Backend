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
