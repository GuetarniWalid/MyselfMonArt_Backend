#!/usr/bin/env node
/**
 * OAuth2 Setup Script for Gmail MCP Server
 *
 * This script helps you obtain a refresh token for the Gmail API.
 * Run it once with: npm run setup
 *
 * Prerequisites:
 * - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment
 * - The OAuth2 credentials must have http://localhost:3000/oauth2callback as authorized redirect URI
 */

import { google } from 'googleapis'
import http from 'http'
import { URL } from 'url'
import dotenv from 'dotenv'

// Load environment variables from parent directory
dotenv.config({ path: '../../.env' })

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3000/oauth2callback'
const SCOPES = ['https://www.googleapis.com/auth/gmail.send']

// Escape HTML to prevent XSS
function escapeHtml(str) {
  const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(str).replace(/[&<>"']/g, (c) => escapeMap[c])
}

async function main() {
  console.log('\n=== Gmail OAuth2 Setup ===\n')

  // Validate credentials
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Erreur: GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être définis.')
    console.error(
      '\nAssurez-vous que ces variables sont définies dans le fichier .env du projet principal.'
    )
    process.exit(1)
  }

  console.log('Client ID trouvé:', GOOGLE_CLIENT_ID.substring(0, 20) + '...')
  console.log('Client Secret trouvé:', GOOGLE_CLIENT_SECRET.substring(0, 10) + '...')

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI)

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  })

  console.log('\n1. Ouvrez cette URL dans votre navigateur:\n')
  console.log(authUrl)
  console.log('\n2. Connectez-vous avec le compte team@myselfmonart.com')
  console.log("3. Autorisez l'application à envoyer des emails")
  console.log('\nEn attente de la redirection...\n')

  // Create a temporary server to handle the OAuth callback
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:3000`)

      if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<h1>Erreur</h1><p>${escapeHtml(error)}</p>`)
          console.error('Erreur OAuth:', error)
          server.close()
          process.exit(1)
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end("<h1>Erreur</h1><p>Code d'autorisation manquant</p>")
          server.close()
          process.exit(1)
        }

        // Exchange code for tokens
        console.log("Code d'autorisation reçu, échange contre les tokens...")
        const { tokens } = await oauth2Client.getToken(code)

        // Success response
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Gmail OAuth2 - Succès</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #4CAF50; }
              code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
              .token-box { background: #e8f5e9; padding: 15px; border-radius: 4px; word-break: break-all; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Configuration réussie!</h1>
              <p>Vous pouvez fermer cette fenêtre et retourner au terminal.</p>
              <p>Le refresh token a été affiché dans la console.</p>
            </div>
          </body>
          </html>
        `)

        // Display tokens in console
        console.log('\n=== CONFIGURATION RÉUSSIE ===\n')
        console.log('Access Token:', tokens.access_token?.substring(0, 50) + '...')

        if (tokens.refresh_token) {
          console.log('\n=== REFRESH TOKEN (à copier) ===\n')
          console.log(tokens.refresh_token)
          console.log('\n================================\n')
          console.log("Ajoutez cette variable d'environnement à votre serveur de production:\n")
          console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
          console.log('\n')
        } else {
          console.log('\nATTENTION: Aucun refresh token reçu.')
          console.log('Cela peut arriver si vous avez déjà autorisé cette application.')
          console.log('Pour obtenir un nouveau refresh token:')
          console.log('1. Allez sur https://myaccount.google.com/permissions')
          console.log("2. Révoquez l'accès de l'application")
          console.log('3. Relancez ce script\n')
        }

        server.close()
        process.exit(0)
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    } catch (error) {
      console.error('Erreur:', error)
      res.writeHead(500)
      res.end('Internal Server Error')
      server.close()
      process.exit(1)
    }
  })

  server.listen(3000, () => {
    console.log("Serveur d'authentification démarré sur http://localhost:3000")
  })

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('Erreur: Le port 3000 est déjà utilisé.')
      console.error("Fermez l'application qui utilise ce port et réessayez.")
    } else {
      console.error('Erreur serveur:', error)
    }
    process.exit(1)
  })
}

main()
