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

Route.get('/test', async () => {
  console.log('🚀 ~ test ok')
  return 'test ok'
})

Route.group(() => {
  Route.get('/', async ({ ally }) => {
    return ally.use('google').redirect()
  })
  Route.get('/callback', 'SocialAuthsController.index')
  Route.get('/merchant-center', 'SocialAuthsController.redirectToGoogle')
  Route.get('/merchant-center/callback', 'SocialAuthsController.handleGoogleCallback')
}).prefix('/login')

Route.group(() => {
  Route.get('/backlinks', async ({ view }) => {
    return view.render('pages/backlinks')
  })
  Route.get('/painting-options', async ({ view }) => {
    return view.render('pages/painting-options')
  })
  Route.get('/tapestry-options', async ({ view }) => {
    return view.render('pages/tapestry-options')
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
    Route.get('/options/:aspectRatio', 'PaintingsController.index')
    Route.post('/options/store', 'PaintingsController.store')
  }).prefix('/paintings')

  Route.group(() => {
    Route.get('/price', 'TapestriesController.index')
    Route.put('/price', 'TapestriesController.update')
  }).prefix('/tapestry')

  Route.group(() => {
    Route.post('/create', 'ProductsController.create')
    Route.post('/update/painting', 'ProductsController.updatePainting')
    Route.post('/update/tapestry', 'ProductsController.updateTapestry')
    Route.post('/update/metafield/likes-count', 'ProductsController.updateMetafieldLikesCount')
  }).prefix('/product')

  Route.post('/webhooks', 'WebhooksController.handle')
}).prefix('/api')
