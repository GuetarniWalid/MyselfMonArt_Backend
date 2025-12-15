/**
 * Test WebSocket Client - Simulates Photoshop UXP Plugin
 *
 * This script simulates a Photoshop plugin responding to mockup jobs.
 * Run this to test Phase 3 before building the actual UXP plugin.
 *
 * Usage: node test-websocket-client.js
 */

const WebSocket = require('ws')

const ws = new WebSocket('ws://localhost:8081')

ws.on('open', () => {
  console.log('🔌 Connected to MockupService')
})

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString())
    console.log('📩 Received message:', message.type)

    switch (message.type) {
      case 'connected':
        console.log('✅', message.message)
        break

      case 'new_job':
        console.log('📝 New job received:')
        console.log('   Job ID:', message.job.id)
        console.log('   Product:', message.job.productTitle)
        console.log('   Image URL:', message.job.imageUrl)

        // Simulate processing delay
        console.log('   ⏳ Simulating Photoshop processing (3 seconds)...')

        setTimeout(() => {
          // Send job completed response
          const response = {
            type: 'job_completed',
            jobId: message.job.id,
            resultPath: `/mockup-result-${message.job.productId}.jpg`,
          }

          ws.send(JSON.stringify(response))
          console.log('   ✅ Sent job completion response')
        }, 3000)
        break

      case 'pong':
        console.log('🏓 Pong received:', message.timestamp)
        break

      default:
        console.log('⚠️  Unknown message type:', message.type)
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error.message)
  }
})

ws.on('close', () => {
  console.log('🔌 Disconnected from MockupService')
})

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message)
})

// Keep the process running
console.log('🚀 Test WebSocket client started')
console.log('   Connecting to ws://localhost:8081')
console.log('   Press Ctrl+C to exit\n')
