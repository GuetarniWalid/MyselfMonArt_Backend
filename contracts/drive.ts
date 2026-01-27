/**
 * Contract source: https://git.io/JBt3I
 *
 * Feel free to let us know via PR, if you find something broken in this contract
 * file.
 */

import type { InferDisksFromConfig } from '@adonisjs/core/build/config'
import type driveConfig from '../config/drive'

declare module '@ioc:Adonis/Core/Drive' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DisksList extends InferDisksFromConfig<typeof driveConfig> {}
}

// Augment to allow 'spaces' disk (S3-compatible driver for Digital Ocean Spaces)
declare module '@ioc:Adonis/Core/Drive' {
  interface DisksList {
    // @ts-ignore - S3 driver configuration for Digital Ocean Spaces
    spaces: any
  }
}
