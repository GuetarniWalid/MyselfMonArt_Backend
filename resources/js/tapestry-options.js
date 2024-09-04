async function getTapestryPrice() {
  try {
    const url = '/api/tapestry/price'
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error()
    }

    const tapestry = await response.json()
    const price = tapestry.price
    return price
  } catch (error) {
    console.log('error', error)
  }
}

function displayTapestryPrice(price) {
  const priceElement = document.getElementById('price-m2')
  priceElement.value = price
}

function listenTapestryPriceChange() {
  const priceElement = document.getElementById('price-m2')
  priceElement.addEventListener('change', async () => {
    let price = priceElement.value
    await updateTapestryPrice(price)
    price = await getTapestryPrice()
    displayTapestryPrice(price)
  })
}

async function updateTapestryPrice(price) {
  try {
    const url = '/api/tapestry/price'
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price: price,
      }),
    })

    if (!response.ok) {
      throw new Error()
    }
  } catch (error) {
    console.log('error', error)
  }
}

async function start() {
  const price = await getTapestryPrice()
  displayTapestryPrice(price)
  listenTapestryPriceChange()
}
start()
