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

Route.get('/', 'DashboardController.index').middleware(['auth'])
Route.post('/', 'WebhooksController.handle')
Route.post('/webhooks', 'WebhooksController.handle')

Route.group(() => {
  Route.get('/', () => 'test ok')
  Route.get('/websocket', async ({ view }) => {
    return view.render('pages/test-websocket')
  })
}).prefix('/test')

// Mockup API routes
Route.group(() => {
  Route.get('/status', 'MockupController.status')
  Route.get('/pending-jobs', 'MockupController.getPendingJobs')
  Route.post('/complete', 'MockupController.completeJob')
}).prefix('/api/mockup')

Route.group(() => {
  Route.get('/', async ({ ally }) => {
    return ally.use('google').redirect()
  })
  Route.get('/callback', 'SocialAuthsController.index')
  Route.get('/pinterest', 'SocialAuthsController.redirectToPinterest')
  Route.get('/pinterest/callback', 'SocialAuthsController.handlePinterestCallback')
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

  Route.post('/midjourney/publish', 'MidjourneysController.publishOnShopify')
}).prefix('/api')
