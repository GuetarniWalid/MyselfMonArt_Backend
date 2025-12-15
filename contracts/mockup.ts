import type MockupService from 'App/Services/MockupService'

declare module '@ioc:Adonis/Core/Application' {
  interface ContainerBindings {
    'Mockup/Service': MockupService
  }
}

declare global {
  var mockupService: MockupService
}

export {}
