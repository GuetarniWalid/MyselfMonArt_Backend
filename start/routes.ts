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

Route.get('/', async ({ view }) => {
  return view.render('welcome')
}).middleware(['auth'])

Route.get('/test', async () => {
  return 'test ok'
})

Route.group(() => {
  Route.get('/', async ({ ally }) => {
    return ally.use('google').redirect()
  })
  Route.get('/callback', 'SocialAuthsController.index')
}).prefix('/login')

Route.group(() => {
  Route.get('/backlinks', async ({ view }) => {
    return view.render('pages/backlinks')
  })
  Route.get('/painting-options', async ({ view }) => {
    return view.render('pages/painting-options')
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
    Route.post('/create', 'ProductsController.create')
    Route.post('/update', 'ProductsController.update')
    Route.post('/update/metafield/likes-count', 'ProductsController.updateMetafieldLikesCount')
  }).prefix('/product')
}).prefix('/api')
