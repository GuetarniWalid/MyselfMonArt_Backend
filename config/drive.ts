/**
 * Config source: https://git.io/JBt3o
 *
 * Feel free to let us know via PR, if you find something broken in this config
 * file.
 */

import Env from '@ioc:Adonis/Core/Env'
import { driveConfig } from '@adonisjs/core/build/config'
import Application from '@ioc:Adonis/Core/Application'

// S3 config for Digital Ocean Spaces (defined separately to avoid TypeScript errors)
const spacesConfig = {
  driver: 's3' as const,
  visibility: 'public' as const,
  key: Env.get('DO_SPACES_KEY') || '',
  secret: Env.get('DO_SPACES_SECRET') || '',
  region: Env.get('DO_SPACES_REGION') || '',
  bucket: Env.get('DO_SPACES_BUCKET') || '',
  endpoint: Env.get('DO_SPACES_ENDPOINT') || '',
}

/*
|--------------------------------------------------------------------------
| Drive Config
|--------------------------------------------------------------------------
|
| The `DriveConfig` relies on the `DisksList` interface which is
| defined inside the `contracts` directory.
|
*/
const config = driveConfig({
  /*
  |--------------------------------------------------------------------------
  | Default disk
  |--------------------------------------------------------------------------
  |
  | The default disk to use for managing file uploads. The value is driven by
  | the `DRIVE_DISK` environment variable.
  |
  */
  disk: Env.get('DRIVE_DISK') as 'local',

  disks: {
    /*
    |--------------------------------------------------------------------------
    | Local
    |--------------------------------------------------------------------------
    |
    | Uses the local file system to manage files. Make sure to turn off serving
    | files when not using this disk.
    |
    */
    local: {
      driver: 'local',
      visibility: 'public',

      /*
      |--------------------------------------------------------------------------
      | Storage root - Local driver only
      |--------------------------------------------------------------------------
      |
      | Define an absolute path to the storage directory from where to read the
      | files.
      |
      */
      root: Application.tmpPath('uploads'),

      /*
      |--------------------------------------------------------------------------
      | Serve files - Local driver only
      |--------------------------------------------------------------------------
      |
      | When this is set to true, AdonisJS will configure a files server to serve
      | files from the disk root. This is done to mimic the behavior of cloud
      | storage services that has inbuilt capabilities to serve files.
      |
      */
      serveFiles: true,

      /*
      |--------------------------------------------------------------------------
      | Base path - Local driver only
      |--------------------------------------------------------------------------
      |
      | Base path is always required when "serveFiles = true". Also make sure
      | the `basePath` is unique across all the disks using "local" driver and
      | you are not registering routes with this prefix.
      |
      */
      basePath: '/uploads',
    },

    /*
    |--------------------------------------------------------------------------
    | Digital Ocean Spaces Driver
    |--------------------------------------------------------------------------
    |
    | Uses Digital Ocean Spaces (S3-compatible) to store video files.
    | Videos are stored with CDN delivery enabled.
    | Note: This disk is added programmatically below to avoid TypeScript errors.
    |
    */
  },
})

// Add S3-compatible disk for Digital Ocean Spaces
// This is done outside driveConfig() to avoid TypeScript strict mode errors
// The runtime behavior is correct, the types just don't align perfectly
;(config.disks as any).spaces = spacesConfig

export default config
