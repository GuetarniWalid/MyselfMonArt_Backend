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
Route.post('/', 'WebhooksController.handle')
Route.post('/webhooks', 'WebhooksController.handle')

Route.get('/webhooks/meta', 'MessageInboxController.verify')
Route.post('/webhooks/meta', 'MessageInboxController.receive')

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
}).prefix('/api')
