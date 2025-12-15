import type { ApplicationContract } from '@ioc:Adonis/Core/Application'
import MockupService from 'App/Services/MockupService'

export default class AppProvider {
  private mockupService?: MockupService

  constructor(protected app: ApplicationContract) {}

  public register() {
    // Register your own bindings
  }

  public async boot() {
    // IoC container is ready
  }

  public async ready() {
    // Only initialize WebSocket server when HTTP server is running
    try {
      const Server = this.app.container.resolveBinding('Adonis/Core/Server')

      // If Server instance exists, we're running the HTTP server
      if (Server && Server.instance) {
        // App is ready - Initialize WebSocket server
        this.mockupService = new MockupService()

        // Initialize WebSocket on port 8081 (8080 is used by Encore)
        this.mockupService.initializeWebSocketServer(8081)

        // Store the service instance globally for access from commands
        global.mockupService = this.mockupService
      }
    } catch (error) {
      // Server not available, we're probably running a command
      // Do nothing
    }
  }

  public async shutdown() {
    // Cleanup, since app is going down
    if (this.mockupService) {
      this.mockupService.closeServer()
    }
  }
}
