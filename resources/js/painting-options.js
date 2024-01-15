// Initialize
async function getAllOptions() {
  try {
    const response = await fetch('/api/paintings/options/all', {
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
        setOptionValue(optionElem, key, firstLevel[key])
      })

      //third level
      secondLevel.children.forEach((thirdLevels) => {
        let optionElem
        thirdLevels.forEach((thirdLevel, i) => {
          if (i === 0) optionElem = addOption(3)
          else optionElem = addSiblingOption(optionElem)
          Object.keys(thirdLevel).forEach((key) => {
            if (key === 'children') return
            setOptionValue(optionElem, key, firstLevel[key])
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
  const newlevel = level + 1
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

  // if (level < 3) {
  //   container.remove()
  // } else {
  //   const options = Array.from(container.querySelectorAll('.option'))
  //   if (options.length === 1) {
  //     container.remove()
  //     return
  //   }
  //   targetOption.remove()
  // }
}

//DOM manipulation
function adjustWidth(input) {
  const mirrorSpan = input.nextElementSibling
  mirrorSpan.textContent = input.value
}
function setOptionValue(optionElem, property, value) {
  const input = optionElem.querySelector(`input[name="${property}"]`)
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

// let targetElemG

// // Remove option
// function removeVariant(button) {
//   const container = button.closest('.container')
//   const level = Number(container.dataset.level)
//   if (level < 3) {
//     recursiveRemoveContainer(container, level)
//   } else {
//     const options = Array.from(container.querySelectorAll('.option'))
//     if (options.length === 1) {
//       container.remove()
//       return
//     }
//     button.closest('.option').remove()
//   }

//   const containers = Array.from(document.querySelectorAll('.container'))
//   if (containers.length === 0) addTopOption()
//   triggerAfterChangement()
// }
// function recursiveRemoveContainer(container, baseLevel) {
//   const nextContainer = container.nextElementSibling
//   if (!nextContainer) {
//     container.remove()
//     return
//   }
//   const nextLevel = Number(nextContainer.dataset.level)
//   if (nextLevel > baseLevel) {
//     nextContainer.remove()
//     recursiveRemoveContainer(container, baseLevel)
//   } else {
//     container.remove()
//   }
// }

// // Add options
// function addTopOption() {
//   addOption(1)
// }
// function addSiblingOption(button) {
//   const siblingContainer = button.closest('.container')
//   const level = Number(siblingContainer.dataset.level)
//   addOption(level, siblingContainer)
// }
// function addChildOption(button) {
//   const parentContainer = button.closest('.container')
//   const level = Number(parentContainer.dataset.level) + 1
//   addOption(level, parentContainer)
// }

// // Utils
// function addOption(level, targetContainer) {
//   const container = addContainerToDom(level, targetContainer)
//   const [optionElem, bg] = addOptionToContainer(container, level)
//   addButtonChild(optionElem, bg)
//   triggerAfterChangement()
//   return optionElem
// }
// function addContainerToDom(level, sibling) {
//   let ml
//   switch (level) {
//     case 1:
//       ml = ''
//       break
//     case 2:
//       ml = 'ml-10'
//       break
//     case 3:
//       ml = 'ml-20'
//       break
//     case 4:
//       ml = 'ml-32'
//   }
//   const template = document.getElementById('container')
//   const content = template.content
//   const clone = content.cloneNode(true)
//   const containerElement = clone.querySelector('.container')
//   if (ml) containerElement.classList.add(ml)
//   containerElement.dataset.level = level

//   if (sibling) {
//     getTargetSibling(sibling)
//     targetElemG.after(containerElement)
//   } else document.getElementById('wrapper').appendChild(containerElement)

//   return containerElement
// }
// function addOptionToContainer(targetElem, level, isSibling) {
//   let bg
//   switch (level) {
//     case 1:
//       bg = 'bg-main'
//       break
//     case 2:
//       bg = 'bg-cyan-700'
//       break
//     case 3:
//       bg = 'bg-green-700'
//   }
//   const template = document.getElementById('option')
//   const content = template.content
//   const clone = content.cloneNode(true)
//   const optionWrapperElement = clone.querySelector('.option-info-wrapper')
//   const optionElement = optionWrapperElement.querySelector('.option')
//   const infoButtonElement = optionWrapperElement.querySelector('.button-add-info')
//   optionElement.classList.add(bg)
//   const textColor = 'text' + bg?.substring(2)
//   infoButtonElement.classList.add(textColor)

//   if (isSibling) targetElem.after(optionWrapperElement)
//   else targetElem.appendChild(optionWrapperElement)

//   return [optionElement, bg]
// }
// function addButtonChild(optionElem, bg) {
//   const template = document.getElementById('button-create-child-or-sibling')
//   const content = template.content
//   const clone = content.cloneNode(true)
//   const buttonsElement = clone.querySelector('.button-create-child-or-sibling')
//   const buttons = buttonsElement.querySelectorAll('button')
//   const [, ...colorArr] = bg.split('-')
//   const color = colorArr.join('-')
//   buttons.forEach((button) => {
//     button.classList.add(`border-${color}`)
//     button.classList.add(`text-${color}`)
//     button.classList.add(`hover:${bg}`)
//   })
//   optionElem.appendChild(buttonsElement)
// }
// function getTargetSibling(previousSibling, baseMlClass) {
//   let tempMlClass

//   const nextSibling = previousSibling.nextElementSibling
//   if (!nextSibling) {
//     targetElemG = previousSibling
//     return
//   }

//   const previousSiblingClasses = Array.from(previousSibling.classList)
//   const previousSiblingMlClass = previousSiblingClasses.find((strClass) =>
//     strClass.startsWith('ml')
//   )
//   if (!baseMlClass && !previousSiblingMlClass) {
//     tempMlClass = 'none'
//   } else if (!baseMlClass && previousSiblingMlClass) {
//     tempMlClass = previousSiblingMlClass
//   } else {
//     tempMlClass = baseMlClass
//   }

//   const nextSiblingClasses = Array.from(nextSibling.classList)
//   const nextSiblingMlClass = nextSiblingClasses.find((strClass) => strClass.startsWith('ml'))

//   if (!nextSiblingMlClass) {
//     targetElemG = previousSibling
//     return
//   }

//   if (tempMlClass === nextSiblingMlClass) {
//     targetElemG = previousSibling
//     return
//   } else {
//     getTargetSibling(nextSibling, tempMlClass)
//   }
// }

// // Copy Script
// async function copyScript() {
//   try {
//     const content = document.getElementById('script-to-copy').textContent
//     await navigator.clipboard.writeText(content)
//   } catch (err) {
//     console.error('Erreur lors de la copie', err)
//   }
// }

// // Copy Locale
// async function copyLocale() {
//   try {
//     const content = document.getElementById('locale-to-copy').textContent
//     await navigator.clipboard.writeText(content)
//   } catch (err) {
//     console.error('Erreur lors de la copie', err)
//   }
// }

// // Trigger after each changement
// function triggerAfterChangement() {
//   createJSON()
//   createLocale()
// }

// // Create JSON
// function createJSON() {
//   const wrapper = document.getElementById('wrapper')
//   const containers = Array.from(wrapper.querySelectorAll('.container'))
//   const [optionsArray, optionsTranslatedArray] = createArrayFromOptions(containers)
//   prepareScriptoBeCopied(optionsTranslatedArray)
//   prepareJSONToBeCopied(optionsArray)
// }

// function createArrayFromOptions(containers) {
//   const options = []
//   const optionsTranslated = []

//   containers.forEach((container) => {
//     const level = Number(container.dataset.level)
//     if (level === 1) {
//       const [optionValue, optionValueTranslated] = getOptionValue(container)
//       const topObject = createParentObject(optionValue)
//       const topObjectTranslated = createParentObject(optionValueTranslated)
//       options.push(topObject)
//       optionsTranslated.push(topObjectTranslated)
//     } else if (level === 2) {
//       const topObject = options[options.length - 1]
//       const topObjectTranslated = optionsTranslated[optionsTranslated.length - 1]
//       const [optionValue, optionValueTranslated] = getOptionValue(container)
//       const childObject = createParentObject(optionValue)
//       const childObjectTranslated = createParentObject(optionValueTranslated)
//       topObject.children.push(childObject)
//       topObjectTranslated.children.push(childObjectTranslated)
//     } else {
//       const childObject =
//         options[options.length - 1].children[options[options.length - 1].children.length - 1]
//       const childObjectTranslated =
//         optionsTranslated[optionsTranslated.length - 1].children[
//           optionsTranslated[optionsTranslated.length - 1].children.length - 1
//         ]
//       childObject.children = childObject.children || []
//       childObjectTranslated.children = childObjectTranslated.children || []
//       const [optionValues, optionValuesTranslated] = getOptionValues(container)
//       childObject.children.push(optionValues)
//       childObjectTranslated.children.push(optionValuesTranslated)
//     }
//   })

//   return [options, optionsTranslated]
// }

// function getOptionValue(container) {
//   const [inputName, inputPrice] = container.querySelectorAll('input')
//   const nameWithTranslation = translateName(inputName.value)
//   return [
//     { name: inputName.value, price: Number(inputPrice.value) },
//     { name: nameWithTranslation, price: Number(inputPrice.value) },
//   ]
// }
// function getOptionValues(container) {
//   const inputNames = Array.from(container.querySelectorAll('input[name="name"]'))
//   const inputPrices = container.querySelectorAll('input[name="price"]')
//   const values = inputNames.map((inputName, i) => {
//     return {
//       name: inputName.value,
//       price: Number(inputPrices[i].value),
//     }
//   })
//   return [values, values.map((value) => ({ ...value, name: translateName(value.name) }))]
// }

// function createParentObject(optionValue) {
//   const topObject = {
//     name: optionValue.name,
//     price: optionValue.price,
//     children: [],
//   }
//   return topObject
// }

// function translateName(name) {
//   const nameWithoutSpace = name.replace(/\s/g, '_')
//   return `{{ 'localeImported.${nameWithoutSpace}' | t }}`
// }

// function prepareScriptoBeCopied(arr) {
//   const jsonContainer = document.getElementById('script-to-copy')
//   jsonContainer.innerText = `
//   <script id="variants-available">
//     window.variants = ${JSON.stringify(arr)};
//     window.moneySymbol = {{ money.currency.symbol }};
//   </script>
//   `
// }

// function prepareJSONToBeCopied(arr) {
//   const buttonSaveToDatabase = document.getElementById('save-to-database')
//   buttonSaveToDatabase.dataset.json = JSON.stringify(arr)
// }

// // Create Locale
// function createLocale() {
//   const values = getAllInputOptionValues()

//   const content = {
//     localeImported: {},
//   }
//   values.forEach((value) => {
//     content.localeImported[value] = value.replace(/_/g, ' ')
//   })

//   const contentContainer = document.getElementById('locale-to-copy')
//   contentContainer.textContent = JSON.stringify(content)
// }
// function getAllInputOptionValues() {
//   const wrapper = document.getElementById('wrapper')
//   const containers = Array.from(wrapper.querySelectorAll('.container'))
//   const optionsValues = extractoptionsValuesFromContainers(containers)
//   const optionsValuesFormatted = formatOptionsValues(optionsValues)
//   return optionsValuesFormatted
// }
// function extractoptionsValuesFromContainers(containers) {
//   const optionsValues = []
//   containers.forEach((container) => {
//     const inputNames = container.querySelectorAll('input[name="name"]')
//     inputNames.forEach((inputName) => {
//       optionsValues.push(inputName.value)
//     })
//   })
//   return [...new Set(optionsValues)]
// }
// function formatOptionsValues(optionsValues) {
//   const optionsValuesFormatted = optionsValues.map((value) => {
//     return value.replace(/\s/g, '_')
//   })
//   return optionsValuesFormatted
// }

// // Save to Database
// async function saveToDatabase(button) {
//   button.classList.remove('bg-red-600')
//   button.classList.remove('hover:bg-red-700')
//   button.disabled = true
//   button.classList.add('cursor-not-allowed')
//   button.classList.add('bg-green-700')
//   button.querySelector('svg').classList.remove('hidden')
//   button.querySelector('#static-text').classList.add('hidden')
//   button.querySelector('#loading-text').classList.remove('hidden')

//   const json = document.getElementById('save-to-database').dataset.json
//   try {
//     const response = await fetch('/api/paintings/options/store', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ variants: json }),
//     })

//     if (!response.ok) {
//       throw new Error()
//     }

//     const data = await response.json()
//     if (data.message === 'success') {
//       console.log(data)
//     } else {
//       throw new Error()
//     }
//   } catch (error) {
//     console.log('error', error)
//     button.classList.add('bg-red-600')
//     button.classList.add('hover:bg-red-700')
//   } finally {
//     button.disabled = false
//     button.classList.remove('cursor-not-allowed')
//     button.classList.remove('bg-green-700')
//     button.querySelector('svg').classList.add('hidden')
//     button.querySelector('#static-text').classList.remove('hidden')
//     button.querySelector('#loading-text').classList.add('hidden')
//   }
// }

// Exports
window.adjustWidth = adjustWidth
window.addSiblingOptionAction = addSiblingOptionAction
window.addChildOptionAction = addChildOptionAction
window.recursiveRemoveOption = recursiveRemoveOption
// window.addSiblingOption = addSiblingOption
// window.addChildOption = addChildOption
// window.copyScript = copyScript
// window.triggerAfterChangement = triggerAfterChangement
// window.saveToDatabase = saveToDatabase
// window.removeVariant = removeVariant
// window.copyLocale = copyLocale
