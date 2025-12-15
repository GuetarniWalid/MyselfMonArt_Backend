import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import fs from 'fs'
import path from 'path'
import MockupQueue from 'App/Services/MockupQueue'

export default class MockupController {
  private queue = MockupQueue.getInstance()

  // Simple status endpoint
  public async status({ response }: HttpContextContract) {
    return response.ok({ status: 'ok', message: 'Mockup service is running' })
  }

  // Get pending jobs
  public async getPendingJobs({ response }: HttpContextContract) {
    const jobs = this.queue.getPendingJobs()
    return response.ok(jobs)
  }

  // Add job to queue
  public async addJob({ request, response }: HttpContextContract) {
    const job = request.only(['id', 'productId', 'productTitle', 'imageUrl'])
    console.log('📝 Job added to queue:', job.id)

    this.queue.addJob(job)

    return response.ok({ success: true, jobId: job.id })
  }

  // Get job status
  public async getJobStatus({ request, response }: HttpContextContract) {
    const jobId = request.input('jobId')
    const job = this.queue.getCompletedJob(jobId)

    if (job) {
      return response.ok({ completed: true, job })
    }

    return response.ok({ completed: false })
  }

  // Mark job as complete
  public async completeJob({ request, response }: HttpContextContract) {
    const data = request.all()
    console.log('✅ Job completion received:', data)

    if (data.jobId) {
      this.queue.completeJob(data.jobId, data)
    }

    return response.ok({ success: true })
  }

  // Download image file
  public async downloadImage({ request, response }: HttpContextContract) {
    const filePath = request.input('path')

    if (!filePath) {
      return response.badRequest({ error: 'No file path provided' })
    }

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return response.notFound({ error: 'File not found' })
      }

      // Read file
      const fileBuffer = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)

      // Send file
      response.header('Content-Type', 'image/jpeg')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)
      return response.send(fileBuffer)
    } catch (error) {
      console.error('❌ Download error:', error)
      return response.internalServerError({ error: 'Failed to download file' })
    }
  }
}
