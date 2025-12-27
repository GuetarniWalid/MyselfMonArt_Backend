// Singleton service to manage mockup job queue
class MockupQueue {
  private static instance: MockupQueue
  private pendingJobs: any[] = []
  private completedJobs: Map<string, any> = new Map()
  private jobMetadata: Map<string, any> = new Map() // Store original job data by jobId

  private constructor() {}

  public static getInstance(): MockupQueue {
    if (!MockupQueue.instance) {
      MockupQueue.instance = new MockupQueue()
    }
    return MockupQueue.instance
  }

  public addJob(job: any) {
    this.pendingJobs.push(job)
    // Store full job metadata for later retrieval
    this.jobMetadata.set(job.id, job)
    console.log(`📝 Job added to queue: ${job.id}`)
  }

  public getPendingJobs(): any[] {
    const jobs = [...this.pendingJobs]
    this.pendingJobs = []
    return jobs
  }

  public completeJob(jobId: string, data: any) {
    this.completedJobs.set(jobId, {
      ...data,
      completedAt: new Date(),
    })
    console.log(`✅ Job marked complete: ${jobId}`)
  }

  public getCompletedJob(jobId: string): any | undefined {
    return this.completedJobs.get(jobId)
  }

  /**
   * Get original job data (including mockupTemplatePath) by jobId
   */
  public getJobMetadata(jobId: string): any | undefined {
    return this.jobMetadata.get(jobId)
  }

  /**
   * Clean up job metadata after completion
   */
  public cleanupJob(jobId: string): void {
    this.jobMetadata.delete(jobId)
    this.completedJobs.delete(jobId)
  }
}

export default MockupQueue
