let targetElemG;

function adjustWidth(input) {
    const mirrorSpan = input.nextElementSibling
    mirrorSpan.textContent = input.value
}

async function getAllOptions() {
    let data;
    try {
        const response = await fetch('/api/paintings/options/all', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error()
        }

        data = await response.json()
        console.log('success', data);
        return data
    } catch (error) {
        console.log('error', error);
        data = []
    } finally {
        if (data.length === 0) {
            addTopOption()
        } else {

        }
    }
}

// Add options
function addTopOption() {
    addOption(1)
}
function addSiblingOption(button) {
    const siblingContainer = button.closest('.container')
    const level = Number(siblingContainer.dataset.level)
    addOption(level, siblingContainer)
}
function addChildOption(button) {
    const parentContainer = button.closest('.container')
    const level = Number(parentContainer.dataset.level) + 1
    addOption(level, parentContainer)
}
function addLastChildOption(button) {
    const parentContainer = button.closest('.container')
    const level = Number(parentContainer.dataset.level) + 1
    addOption(level, parentContainer)
}
function addLastSiblingOption(button) {
    const parentContainer = button.closest('.container')
    if (!parentContainer.classList.contains('flex')) {
        parentContainer.classList.add('flex')
        parentContainer.classList.add('gap-8')
    }

    const previousSibling = button.closest('.option')
    const [optionElem, bg] = addOptionToContainer(previousSibling, 3, true)
    addButtonLastSibling(optionElem, bg)
}

// Utils
function addOption(level, targetContainer) {
    const container = addContainerToDom(level, targetContainer)
    const [optionElem, bg] = addOptionToContainer(container, level)
    if (level >= 3) addButtonLastSibling(optionElem, bg)
    else addButtonChild(optionElem, bg)
}
function addContainerToDom(level, sibling) {
    let ml;
    switch (level) {
        case 1:
            ml = ''
            break;
        case 2:
            ml = 'ml-10'
            break;
        case 3:
            ml = 'ml-20'
            break;
        case 4:
            ml = 'ml-32'
    }
    const template = document.getElementById('container');
    const content = template.content;
    const clone = content.cloneNode(true);
    const containerElement = clone.querySelector('.container');
    if (ml) containerElement.classList.add(ml)
    containerElement.dataset.level = level

    if (sibling) {
        getTargetSibling(sibling)
        targetElemG.after(containerElement)
    }
    else document.getElementById('wrapper').appendChild(containerElement)

    return containerElement
}
function addOptionToContainer(targetElem, level, isSibling) {
    let bg;
    switch (level) {
        case 1:
            bg = 'bg-main'
            break;
        case 2:
            bg = 'bg-cyan-700'
            break;
        case 3:
            bg = 'bg-green-700'
    }
    const template = document.getElementById('option');
    const content = template.content;
    const clone = content.cloneNode(true);
    const optionElement = clone.querySelector('.option');
    const input = optionElement.querySelector('input')
    input.classList.add(bg)
    if (isSibling) targetElem.after(optionElement)
    else targetElem.appendChild(optionElement)

    return [optionElement, bg]
}
function addButtonChild(optionElem, bg) {
    const template = document.getElementById('button-create-child-or-sibling');
    const content = template.content;
    const clone = content.cloneNode(true);
    const buttonsElement = clone.querySelector('.button-create-child-or-sibling');
    const buttons = buttonsElement.querySelectorAll('button')
    const [, ...colorArr] = bg.split('-')
    const color = colorArr.join('-')
    buttons.forEach(button => {
        button.classList.add(`border-${color}`)
        button.classList.add(`text-${color}`)
        button.classList.add(`hover:${bg}`)
    });
    optionElem.appendChild(buttonsElement)
}
function addButtonLastSibling(optionElem, bg) {
    const template = document.getElementById('button-create-last-sibling');
    const content = template.content;
    const clone = content.cloneNode(true);
    const button = clone.querySelector('.button-create-last-sibling');

    const [, ...colorArr] = bg.split('-')
    const color = colorArr.join('-')
    button.classList.add(`border-${color}`)
    button.classList.add(`text-${color}`)
    button.classList.add(`hover:${bg}`)

    optionElem.appendChild(button)
}
function getTargetSibling(previousSibling, baseMlClass) {
    let tempMlClass;

    const nextSibling = previousSibling.nextElementSibling
    if (!nextSibling) {
        targetElemG = previousSibling
        return
    }

    const previousSiblingClasses = Array.from(previousSibling.classList)
    const previousSiblingMlClass = previousSiblingClasses.find(strClass => strClass.startsWith('ml'))
    if(!baseMlClass && !previousSiblingMlClass) {
        tempMlClass = 'none'
    } else if(!baseMlClass && previousSiblingMlClass) {
        tempMlClass = previousSiblingMlClass
    } else {
        tempMlClass = baseMlClass
    }

    const nextSiblingClasses = Array.from(nextSibling.classList)
    const nextSiblingMlClass = nextSiblingClasses.find(strClass => strClass.startsWith('ml'))

    if (!nextSiblingMlClass) {
        targetElemG = previousSibling
        return
    }


    if (tempMlClass === nextSiblingMlClass) {
        targetElemG = previousSibling
        return
    } else {
        getTargetSibling(nextSibling, tempMlClass)
    }
}


getAllOptions()

window.adjustWidth = adjustWidth
window.addSiblingOption = addSiblingOption
window.addChildOption = addChildOption
window.addLastSiblingOption = addLastSiblingOption