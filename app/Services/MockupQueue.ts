// Singleton service to manage mockup job queue
class MockupQueue {
  private static instance: MockupQueue
  private pendingJobs: any[] = []
  private completedJobs: Map<string, any> = new Map()

  private constructor() {}

  public static getInstance(): MockupQueue {
    if (!MockupQueue.instance) {
      MockupQueue.instance = new MockupQueue()
    }
    return MockupQueue.instance
  }

  public addJob(job: any) {
    this.pendingJobs.push(job)
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
}

export default MockupQueue
