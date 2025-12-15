import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class MockupController {
  // Simple status endpoint
  public async status({ response }: HttpContextContract) {
    return response.ok({ status: 'ok', message: 'Mockup service is running' })
  }

  // Get pending jobs (placeholder for now)
  public async getPendingJobs({ response }: HttpContextContract) {
    // For Phase 4, return empty array
    // Phase 5 will implement actual job queue
    return response.ok([])
  }

  // Mark job as complete
  public async completeJob({ request, response }: HttpContextContract) {
    const data = request.all()
    console.log('📝 Job completion received:', data)

    // For Phase 4, just log it
    // Phase 5 will implement actual processing
    return response.ok({ success: true })
  }
}
