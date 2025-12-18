# Mockup Automation - Photoshop UXP Plugin

Photoshop plugin for automated mockup generation. This plugin connects to the backend WebSocket server to receive mockup jobs, process them in Photoshop, and return the results.

## Features

- WebSocket connection to backend server
- Real-time job status updates
- Activity logging
- Job statistics tracking
- Auto-reconnect on connection loss

## Prerequisites

- Adobe Photoshop 2023 or later (version 24.0.0+)
- UXP Developer Tool installed
- Node.js and npm installed

## Setup

### 1. Configure Backend URL

Before building the plugin, you need to configure your backend URL:

**Option A: For Development (Local Testing)**
- The default configuration in `src/bundle.js` uses `http://localhost:3333`
- No changes needed for local development

**Option B: For Production Deployment**
1. Open `src/bundle.js`
2. Find the config section (around line 16)
3. Change:
   ```javascript
   const config = {
     BACKEND_URL: 'https://YOUR_BACKEND_DOMAIN',
     ENV: 'production',
   }
   ```
4. Open `manifest.json`
5. Find the network domains section (around line 21)
6. Replace `https://YOUR_BACKEND_DOMAIN` with your actual backend URL

**IMPORTANT**: Never commit your actual backend URL to git. Keep it in your local environment only.

### 2. Install Dependencies

```bash
cd photoshop-plugin
npm install
```

### 3. Build the Plugin

Compile TypeScript to JavaScript:

```bash
npm run build
```

For development with auto-rebuild on file changes:

```bash
npm run watch
```

### 3. Add Plugin Icon

The plugin requires an icon file. Create a 48x48 PNG icon and save it as:

```
photoshop-plugin/icons/icon.png
```

You can use any image editor to create a simple icon, or use a placeholder.

### 4. Load Plugin in Photoshop

1. Open **UXP Developer Tool**
2. Click **Add Plugin**
3. Navigate to the `photoshop-plugin` folder and select `manifest.json`
4. Click **Load** to load the plugin into Photoshop
5. The plugin should appear in Photoshop's Plugins panel

## Testing Phase 4

### Step 1: Start the Backend Server

In Terminal 1:
```bash
npm run dev
```

This starts the WebSocket server on `ws://localhost:8081`.

### Step 2: Open Plugin in Photoshop

1. Open Photoshop
2. Go to **Plugins > Mockup Automation**
3. The plugin panel should open

### Step 3: Connect to Server

1. Click **Connect to Server** button in the plugin
2. Status indicator should turn green
3. Activity log should show "Connected to server!"

### Step 4: Test with Command

In Terminal 2:
```bash
node ace photoshop:mockup_automation
```

1. Select to process 1-2 products
2. Plugin should receive the jobs
3. Check plugin logs for job details
4. Jobs should auto-complete after 2 seconds (simulated)
5. Stats should show "Jobs Received" and "Jobs Completed"

### Verification Checklist

- [ ] Plugin loads in Photoshop without errors
- [ ] UI displays correctly
- [ ] Connect button works
- [ ] Status indicator changes to green when connected
- [ ] Activity log shows connection messages
- [ ] Plugin receives jobs from command
- [ ] Job details appear in logs
- [ ] Statistics update correctly
- [ ] Disconnect button works

## Project Structure

```
photoshop-plugin/
├── manifest.json           # Plugin configuration
├── index.html             # Plugin UI
├── package.json           # Node dependencies
├── tsconfig.json          # TypeScript config
├── icons/
│   └── icon.png          # Plugin icon (48x48)
└── src/
    ├── index.ts          # Main entry point
    ├── index.js          # Compiled JavaScript
    ├── websocket-client.ts    # WebSocket client
    └── websocket-client.js    # Compiled JavaScript
```

## Troubleshooting

### Plugin won't load
- Ensure all TypeScript files are compiled (`npm run build`)
- Check that `manifest.json` is valid JSON
- Verify icon file exists at `icons/icon.png`

### Can't connect to server
- Ensure backend server is running (`npm run dev`)
- Check that WebSocket server is on port 8081
- Verify no firewall blocking localhost connections

### Jobs not received
- Check Activity Log for connection status
- Verify backend server is running
- Check Terminal 1 for WebSocket connection messages

## Next Steps

**Phase 5** will implement:
- Actual Photoshop mockup processing
- Smart object manipulation
- Layer export
- Result file generation

**Phase 6** will implement:
- Upload processed mockups to Shopify
- File cleanup
- Error handling
