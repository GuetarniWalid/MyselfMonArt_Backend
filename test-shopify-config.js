const Env = require('@ioc:Adonis/Core/Env')

async function testShopifyConfig() {
  console.log('🔍 Testing Shopify Configuration...\n')

  // Check environment variables
  const shopUrl = Env.get('SHOPIFY_SHOP_URL')
  const apiVersion = Env.get('SHOPIFY_API_VERSION')
  const accessToken = Env.get('SHOPIFY_ACCESS_TOKEN_SECRET')

  console.log('Environment Variables:')
  console.log(`  SHOPIFY_SHOP_URL: ${shopUrl ? '✅ Set' : '❌ Missing'}`)
  console.log(`  SHOPIFY_API_VERSION: ${apiVersion ? '✅ Set' : '❌ Missing'}`)
  console.log(`  SHOPIFY_ACCESS_TOKEN_SECRET: ${accessToken ? '✅ Set' : '❌ Missing'}`)

  if (!shopUrl || !apiVersion || !accessToken) {
    console.log('\n❌ Missing required environment variables!')
    console.log('Please check your .env file and ensure all Shopify variables are set.')
    return
  }

  const urlGraphQL = `${shopUrl}/${apiVersion}/graphql.json`
  console.log(`\nGraphQL URL: ${urlGraphQL}`)

  // Test basic connectivity
  try {
    console.log('\n🔗 Testing connectivity...')
    const response = await fetch(urlGraphQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `{
          shop {
            name
            myshopifyDomain
          }
        }`,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      console.log('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
    } else {
      console.log('✅ Connection successful!')
      console.log('Shop info:', JSON.stringify(data.data.shop, null, 2))
    }
  } catch (error) {
    console.log('❌ Connection failed:', error.message)
  }
}

// Run the test
testShopifyConfig().catch(console.error)
