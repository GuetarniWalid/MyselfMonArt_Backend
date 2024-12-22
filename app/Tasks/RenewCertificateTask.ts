import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import Logger from '@ioc:Adonis/Core/Logger'

const execAsync = promisify(exec)

export default class RenewCertificateTask extends BaseTask {
  public static get schedule() {
    return '0 0,12 * * *'
  }

  public static get useLock() {
    return true
  }

  private async checkCertificate() {
    const { stdout } = await execAsync('docker-compose exec certbot certbot certificates')
    const daysMatch = stdout.match(/VALID: (\d+) days/)
    return daysMatch ? parseInt(daysMatch[1]) : 0
  }

  private async restartContainer(name: string) {
    try {
      await execAsync(`docker-compose restart ${name}`)
      Logger.info(`${name} container restarted successfully`)
    } catch (error) {
      Logger.error(`Failed to restart ${name} container:`, error.message)
    }
  }

  public async handle() {
    try {
      const daysRemaining = await this.checkCertificate()
      Logger.info(`Certificate valid for ${daysRemaining} days`)

      if (daysRemaining > 30) {
        Logger.info('Certificate still valid, skipping renewal')
        return
      }

      Logger.info('Starting certificate renewal...')
      const { stdout, stderr } = await execAsync(
        'docker-compose exec certbot certbot renew --quiet --agree-tos'
      )

      if (stderr) {
        Logger.error('Error during renewal:', stderr)
        return
      }

      if (stdout) {
        Logger.info('Renewal output:', stdout)
      }

      // Restart containers after successful renewal
      await this.restartContainer('certbot')
      await this.restartContainer('nginx')

      Logger.info('Certificate renewal completed')
    } catch (error) {
      Logger.error('Failed to process certificate:', error.message)
      throw error
    }
  }
}
