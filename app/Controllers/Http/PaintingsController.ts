// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Material from 'App/Models/Material'

export default class PaintingsController {
    public async index() {
        const materials = await Material.all()
        return materials
    }
}
