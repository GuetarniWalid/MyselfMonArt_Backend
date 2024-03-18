//Initialize
async function getAllOptions(aspectRatio) {
  try {
    const url = aspectRatio
      ? `/api/paintings/options/${aspectRatio}`
      : '/api/paintings/options/square'
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error()
    }

    const data = await response.json()
    const variants = data.json
    createDomFromVariants(variants)
    listenPopupInputs()
  } catch (error) {
    console.log('error', error)
    createDomFromVariants([])
  }
}
function createDomFromVariants(variants) {
  variants.forEach((firstLevel) => {
    //first level
    const optionElem = addOption(1)
    Object.keys(firstLevel).forEach((key) => {
      if (key === 'children') return
      setOptionValue(optionElem, key, firstLevel[key])
    })

    //second level
    firstLevel.children.forEach((secondLevel) => {
      const optionElem = addOption(2)
      Object.keys(secondLevel).forEach((key) => {
        if (key === 'children') return
        setOptionValue(optionElem, key, secondLevel[key])
      })

      //third level
      secondLevel.children.forEach((thirdLevels) => {
        let optionElem
        thirdLevels.forEach((thirdLevel, i) => {
          if (i === 0) optionElem = addOption(3)
          else optionElem = addSiblingOption(optionElem)
          Object.keys(thirdLevel).forEach((key) => {
            if (key === 'children') return
            setOptionValue(optionElem, key, thirdLevel[key])
          })
        })
      })
    })
  })
}
getAllOptions()

//DOM construction
function createOptionContainer(level) {
  const template = document.getElementById('option-container')
  const content = template.content
  const clone = content.cloneNode(true)
  const containerOptionElement = clone.querySelector('.option-container')
  containerOptionElement.dataset.level = level
  const marginLeft = 'ml-' + (level - 1) * 10
  containerOptionElement.classList.add(marginLeft)

  if (level === 3) {
    const buttonTemplate = document.getElementById('button-add-sibling-container')
    const buttonContent = buttonTemplate.content
    const buttonClone = buttonContent.cloneNode(true)
    const buttonAddSiblingContainer = buttonClone.querySelector('.button-add-sibling-container')
    containerOptionElement.appendChild(buttonAddSiblingContainer)
  }
  return containerOptionElement
}
function getColor(level) {
  switch (level) {
    case 1:
      return 'main'
    case 2:
      return 'cyan-700'
    case 3:
      return 'green-700'
  }
}
function createOption(parentContainer) {
  const template = document.getElementById('option')
  const content = template.content
  const clone = content.cloneNode(true)
  const optionElement = clone.querySelector('.option')
  const namePriceElem = optionElement.querySelector('.name-price')
  const buttonAddInfoElem = optionElement.querySelector('.button-add-info')
  const level = Number(parentContainer.dataset.level)
  const background = 'bg-' + getColor(level)
  namePriceElem.classList.add(background)
  buttonAddInfoElem.classList.add('text-' + getColor(level))
  return [optionElement, namePriceElem]
}
function createChildOrSiblingButtons(parentContainer) {
  const template = document.getElementById('button-create-child-or-sibling')
  const content = template.content
  const clone = content.cloneNode(true)
  const buttonsWrapper = clone.querySelector('.button-create-child-or-sibling')
  const buttons = buttonsWrapper.querySelectorAll('button')
  const level = Number(parentContainer.dataset.level)
  const color = getColor(level)
  buttons.forEach((button) => {
    button.classList.add(`border-${color}`)
    button.classList.add(`text-${color}`)
    button.classList.add(`hover:bg-${color}`)
  })
  return buttonsWrapper
}
function createSiblingButton(parentContainer) {
  const template = document.getElementById('button-add-sibling')
  const content = template.content
  const clone = content.cloneNode(true)
  const button = clone.querySelector('button')
  const level = Number(parentContainer.dataset.level)
  const color = getColor(level)
  button.classList.add(`border-${color}`)
  button.classList.add(`text-${color}`)
  button.classList.add(`hover:bg-${color}`)
  return button
}

//DOM insertion
function addOption(level, nextContainer) {
  const container = createOptionContainer(level)
  const [option, namePrice] = createOption(container)
  if (level < 3) {
    const buttons = createChildOrSiblingButtons(container)
    namePrice.appendChild(buttons)
  } else {
    const button = createSiblingButton(container)
    namePrice.appendChild(button)
  }

  if (nextContainer) nextContainer.before(container)
  else document.getElementById('wrapper').appendChild(container)
  container.appendChild(option)
  return option
}
function addOptionAfter(targetContainer) {
  const level = Number(targetContainer.dataset.level)
  const containers = Array.from(targetContainer.closest('#wrapper').children).filter((child) =>
    child.classList.contains('option-container')
  )
  const containersAfter = containers.slice(containers.indexOf(targetContainer) + 1)
  const containersAfterSameLevel = containersAfter.filter(
    (container) => Number(container.dataset.level) === level
  )
  let nextContainer = containersAfterSameLevel[0]

  if (!nextContainer) {
    const containersAfterPreviousLevel = containersAfter.filter(
      (container) => Number(container.dataset.level) === level - 1
    )
    nextContainer = containersAfterPreviousLevel[0]
  }

  if (nextContainer) {
    addOption(level, nextContainer)
  } else {
    addOption(level)
  }
}
function addOptionBefore(targetContainer) {
  const level = Number(targetContainer.dataset.level)
  const newlevel = level >= 3 ? 3 : level + 1
  const nextContainer = targetContainer.nextElementSibling
  if (!nextContainer) {
    addOption(newlevel)
    return
  }
  addOption(newlevel, nextContainer)
}
function addSiblingOption(targetOption) {
  const container = targetOption.closest('.option-container')
  const [option, namePrice] = createOption(container)
  const button = createSiblingButton(container)
  namePrice.appendChild(button)
  targetOption.after(option)
  return option
}

//DOM Removal
function recursiveRemoveOption(target, nextContainer, baseLevel) {
  const targetOption = target.closest('.option') ?? target
  const container = targetOption.closest('.option-container')
  const level = Number(container.dataset.level)

  const nextNextContainer = container.nextElementSibling

  if (!nextNextContainer && nextContainer) {
    nextContainer.remove()
  } else if (nextNextContainer && Number(nextNextContainer.dataset.level) > (baseLevel ?? level)) {
    const nextNextTagetOption = nextNextContainer.querySelector('.option')
    recursiveRemoveOption(nextNextTagetOption, nextNextContainer, baseLevel ?? level)
    container.remove()
  } else {
    targetOption.remove()
    const otherOptions = Array.from(container.querySelectorAll('.option'))
    if (otherOptions.length === 0) container.remove()
  }
}
function removeAllContainer() {
  const containers = getAllContainers()
  containers.forEach((container) => container.remove())
}

//DOM manipulation
function adjustWidth(input) {
  const mirrorSpan = input.nextElementSibling
  if (!mirrorSpan || mirrorSpan.nodeName !== 'SPAN') return
  mirrorSpan.textContent = input.value
}
function setOptionValue(optionElem, property, value) {
  const input = optionElem.querySelector(`input[name="${property}"]`)
  if (!input) return
  input.value = value
  adjustWidth(input)
}

//Buttons actions
function addSiblingOptionAction(button) {
  const targetContainer = button.closest('.option-container')
  addOptionAfter(targetContainer)
}
function addChildOptionAction(button) {
  const targetContainer = button.closest('.option-container')
  addOptionBefore(targetContainer)
}
function addSiblingOptionAction2(button) {
  const targetOption = button.closest('.option')
  addSiblingOption(targetOption)
}
function addContainerLevel3Action(button) {
  const container = button.closest('.option-container')
  addOptionBefore(container)
}
async function copyScript() {
  try {
    const content = document.getElementById('string-script').textContent
    await navigator.clipboard.writeText(content)
  } catch (err) {
    console.error('Erreur lors de la copie', err)
  }
}
async function copyLocale() {
  try {
    const content = document.getElementById('string-locale').textContent
    await navigator.clipboard.writeText(content)
  } catch (err) {
    console.error('Erreur lors de la copie', err)
  }
}
async function saveToDatabase(button) {
  button.classList.remove('bg-red-600')
  button.classList.remove('hover:bg-red-700')
  button.disabled = true
  button.classList.add('cursor-not-allowed')
  button.classList.add('bg-green-700')
  button.querySelector('svg').classList.remove('hidden')
  button.querySelector('#static-text').classList.add('hidden')
  button.querySelector('#loading-text').classList.remove('hidden')

  const json = document.getElementById('json-to-save').textContent
  const aspectRatio = document.querySelector('#aspect-ration-selection button[aria-pressed="true"]')
    ?.dataset.aspectRatio
  try {
    const response = await fetch('/api/paintings/options/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ variants: json, aspectRatio: aspectRatio }),
    })

    if (!response.ok) {
      throw new Error()
    }

    const data = await response.json()
    if (data.message === 'success') {
      console.log(data)
    } else {
      throw new Error()
    }
  } catch (error) {
    console.log('error', error)
    button.classList.add('bg-red-600')
    button.classList.add('hover:bg-red-700')
  } finally {
    button.disabled = false
    button.classList.remove('cursor-not-allowed')
    button.classList.remove('bg-green-700')
    button.querySelector('svg').classList.add('hidden')
    button.querySelector('#static-text').classList.remove('hidden')
    button.querySelector('#loading-text').classList.add('hidden')
  }
}
function showInfoPopup(button) {
  const option = button.closest('.option')
  const popup = option.querySelector('.popup-info')
  popup.classList.remove('hidden')
  const color = getColor(Number(option.closest('.option-container').dataset.level))
  popup.classList.add(`border-${color}`)
  document.body.classList.add('overflow-hidden')
  document.getElementById('overlay').classList.remove('hidden')
  option.querySelector('.popup-title').textContent = option.querySelector('input[name]').value
}
function selectAspectRatio(button) {
  const lastButtonSelected = document.querySelector(
    '#aspect-ration-selection button[aria-pressed="true"]'
  )
  lastButtonSelected.setAttribute('aria-pressed', false)
  lastButtonSelected.classList.remove('bg-main')
  lastButtonSelected.classList.replace('text-secondary', 'text-main')

  button.setAttribute('aria-pressed', true)
  button.classList.add('bg-main')
  button.classList.replace('text-main', 'text-secondary')

  removeAllContainer()
  const aspectRatio = button.dataset.aspectRatio
  getAllOptions(aspectRatio)
}

//Listeners
function triggerAfterChangement() {
  const targetNode = document.getElementById('wrapper')
  const config = { childList: true, subtree: true }

  function callback(mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const [optionsArray, optionsArrayTranslated] = createArrayFromOptions()
        createJSONToCopied(optionsArray)
        createScriptToCopied(optionsArrayTranslated)
        createLocale(optionsArray)
      }
    }
  }

  const observer = new MutationObserver(callback)
  observer.observe(targetNode, config)
}
triggerAfterChangement()

function listenPopupInputs() {
  document.querySelectorAll('.popup-info input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const [optionsArray, optionsArrayTranslated] = createArrayFromOptions()
      createJSONToCopied(optionsArray)
      createScriptToCopied(optionsArrayTranslated)
      createLocale(optionsArray)
    })
  })
}

document.getElementById('overlay').addEventListener('click', (e) => {
  document.getElementById('overlay').classList.add('hidden')
  document.querySelector('.popup-info:not(.hidden)').classList.add('hidden')
  document.body.classList.remove('overflow-hidden')
})

//Dom to Array
function createArrayFromOptions() {
  const containers = getAllContainers()
  const options = []
  const optionsTranslated = []

  containers.forEach((container) => {
    const level = Number(container.dataset.level)
    if (level === 1) {
      const [optionValues, optionValuesTranslated] = getOptionValues(container)
      const topObject = createParentObject(optionValues)
      const topObjectTranslated = createParentObject(optionValuesTranslated)
      options.push(topObject)
      optionsTranslated.push(topObjectTranslated)
    } else if (level === 2) {
      const topObject = options[options.length - 1]
      const topObjectTranslated = optionsTranslated[optionsTranslated.length - 1]
      const [optionValues, optionValuesTranslated] = getOptionValues(container)
      const childObject = createParentObject(optionValues)
      const childObjecttranslated = createParentObject(optionValuesTranslated)
      topObject.children.push(childObject)
      topObjectTranslated.children.push(childObjecttranslated)
    } else {
      const childObject =
        options[options.length - 1].children[options[options.length - 1].children.length - 1]
      childObject.children = childObject.children || []

      const childObjecttranslated =
        optionsTranslated[optionsTranslated.length - 1].children[
          optionsTranslated[optionsTranslated.length - 1].children.length - 1
        ]
      childObjecttranslated.children = childObjecttranslated.children || []

      const [optionValuesList, optionValuesListTranslated] = getAllOptionValues(container)
      childObject.children.push(optionValuesList)
      childObjecttranslated.children.push(optionValuesListTranslated)
    }
  })

  return [options, optionsTranslated]
}
function getAllContainers() {
  const wrapper = document.getElementById('wrapper')
  const containers = Array.from(wrapper.querySelectorAll('.option-container'))
  return containers
}
function getOptionValues(option) {
  const inputs = option.querySelectorAll('input')
  const values = {}
  const valuesTranslated = {}
  inputs.forEach((input) => {
    values[input.name] = isNaN(input.value) ? input.value : Number(input.value)
    const translatedValue =
      input.name === 'technicalType' || input.name === 'technicalName'
        ? input.value
        : translateName(input.value)
    valuesTranslated[input.name] = isNaN(translatedValue)
      ? translatedValue
      : Number(translatedValue)
  })

  return [values, valuesTranslated]
}
function getAllOptionValues(container) {
  const options = Array.from(container.querySelectorAll('.option'))
  const values = options.map((option) => getOptionValues(option)[0])
  const valuesTranslated = options.map((option) => getOptionValues(option)[1])
  return [values, valuesTranslated]
}
function createParentObject(optionValues) {
  const topObject = {
    ...optionValues,
    children: [],
  }

  return topObject
}
function translateName(name) {
  if (!isNaN(name)) return name
  const nameWithoutSpace = name.replace(/\s/g, '_')
  const nameWithoutSpecialChar = nameWithoutSpace.replace(/[^\w\s]/gi, '')
  const nameInLowerCase = nameWithoutSpecialChar.toLowerCase()
  return `{{ 'localeImported.${nameInLowerCase}' | t }}`
}

//Create JSON
function createJSONToCopied(optionsArray) {
  const json = optionsArrayToJSON(optionsArray)
  document.getElementById('json-to-save').textContent = json
  return optionsArray
}
function optionsArrayToJSON(arr) {
  return JSON.stringify(arr)
}

//Create Script
function createScriptToCopied(optionsArray) {
  const stringScript = optionsArrayToStringScript(optionsArray)
  document.getElementById('string-script').textContent = stringScript
}
function optionsArrayToStringScript(arr) {
  return `
  <script id="variants-available">
    window.variants = ${JSON.stringify(arr)};
    window.moneySymbol = "{{ localization.country.currency.symbol }}";
  </script>
  `
}

// Create Locale
function createLocale(optionsArray) {
  const uniqueValues = extractUniqueValues(optionsArray)
  const locale = {}
  uniqueValues.forEach((value) => {
    const valueWithoutSpace = value.replace(/\s/g, '_')
    const valueWithoutSpecialChar = valueWithoutSpace.replace(/[^\w\s]/gi, '')
    const valueInLowerCase = valueWithoutSpecialChar.toLowerCase()
    locale[valueInLowerCase] = value
  })
  document.getElementById('string-locale').textContent = `"localeImported":${JSON.stringify(
    locale
  )}`
}
function extractUniqueValues(optionsArray) {
  const uniqueValues = new Set()
  optionsArray.forEach((option) => {
    Object.keys(option).forEach((key) => {
      if (
        key !== 'children' &&
        key !== 'technicalName' &&
        key !== 'technicalType' &&
        isNaN(option[key])
      )
        uniqueValues.add(option[key])
      else if (key === 'children') {
        option[key].forEach((child) => {
          Object.keys(child).forEach((childKey) => {
            if (
              childKey !== 'children' &&
              childKey !== 'technicalName' &&
              childKey !== 'technicalType' &&
              isNaN(child[childKey])
            )
              uniqueValues.add(child[childKey])
            else if (childKey === 'children') {
              child[childKey].forEach((grandChildArray) => {
                grandChildArray.forEach((grandChildObject) => {
                  Object.keys(grandChildObject).forEach((grandChildKey) => {
                    if (
                      grandChildKey !== 'children' &&
                      grandChildKey !== 'technicalName' &&
                      grandChildKey !== 'technicalType' &&
                      isNaN(grandChildObject[grandChildKey])
                    )
                      uniqueValues.add(grandChildObject[grandChildKey])
                  })
                })
              })
            }
          })
        })
      }
    })
  })
  return uniqueValues
}

// Exports
window.adjustWidth = adjustWidth
window.addSiblingOptionAction = addSiblingOptionAction
window.addChildOptionAction = addChildOptionAction
window.recursiveRemoveOption = recursiveRemoveOption
window.addSiblingOptionAction2 = addSiblingOptionAction2
window.addContainerLevel3Action = addContainerLevel3Action
window.copyScript = copyScript
window.saveToDatabase = saveToDatabase
window.copyLocale = copyLocale
window.showInfoPopup = showInfoPopup
window.selectAspectRatio = selectAspectRatio

//tailwindcss, don't remove
//bg-main
//bg-cyan-700
//ml-10
//ml-20
