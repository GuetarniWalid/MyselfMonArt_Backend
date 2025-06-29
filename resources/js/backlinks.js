import { Grid, html } from 'gridjs'

const data = [
  ['John', 'john@example.com', 'ancre', true],
  ['Mark', 'mark@gmail.com', 'ancre', false],
  ['Eoin', 'eoin@gmail.com', 'ancre', true],
  ['Sarah', 'sarahcdd@gmail.com', 'ancre', false],
  ['Afshin', 'afshin@mail.com', 'ancre', 'idle'],
]

const gridContainer = document.getElementById('gridjs-container')
const grid = new Grid({
  columns: [
    {
      name: 'Site',
      attributes: (cell, row) => ({ ...formatAttributes(cell, row) }),
      formatter: (cell, _, column) => formatOutput(cell, _, column),
    },
    {
      name: 'Url',
      attributes: (cell, row) => ({ ...formatAttributes(cell, row) }),
      formatter: (cell, _, column) => formatOutput(cell, _, column),
    },
    {
      name: 'Ancre',
      attributes: (cell, row) => ({ ...formatAttributes(cell, row) }),
      formatter: (cell, _, column) => formatOutput(cell, _, column),
    },
    {
      name: 'État',
      attributes: (cell, row) => ({ ...formatAttributes(cell, row) }),
      formatter: (cell, _, column) => formatOutput(cell, _, column),
    },
  ],
  sort: true,
  data: fetchBacklinks,
}).render(gridContainer)

grid.on('cellClick', (e, args) => copyLinkElement(e, args.data))
grid.on('rowClick', (e, args) => deleteLinkElement(e, args.cells))

/***** Utils *****/
async function fetchBacklinks() {
  try {
    const response = await fetch('/api/backlinks')
    if (!response.ok) {
      throw new Error()
    } else {
      const responseDAta = await response.json()
      const dataFormatted = responseDAta.map((data) => {
        let siteData
        let urlData
        let anchorData
        if (!data.state) {
          siteData = data.site ?? '?'
          urlData = data.url ?? '?'
          anchorData = data.anchor ?? '?'
        } else {
          siteData = data.site ?? 'loading'
          urlData = data.url ?? 'loading'
          anchorData = data.anchor ?? 'loading'
        }
        return [siteData, urlData, anchorData, data.state ?? 'loading']
      })
      return dataFormatted.reverse()
    }
  } catch (error) {
    console.log('An error is occured :(')
  }
}

function backgroundClass(status) {
  switch (status) {
    case 'ok':
      return {
        class: 'gridjs-td !bg-emerald-200 cursor-default max-w-[150px] truncate relative group',
      }
    case 'ko':
      return { class: 'gridjs-td !bg-red-200 cursor-default max-w-[150px] truncate relative group' }
    default:
      return {
        class: 'gridjs-td !bg-stone-100 cursor-default max-w-[150px] truncate relative group',
      }
  }
}

function formatAttributes(cell, row) {
  if (cell === null) return
  const isLinkActive = row?.cells[3].data
  switch (isLinkActive) {
    case true:
      return { ...backgroundClass('ok') }
    case false:
      return { ...backgroundClass('ko') }
    case 'idle':
      return { ...backgroundClass('idle') }
    default:
      return { ...backgroundClass() }
  }
}

function formatOutput(cell, _, column) {
  let content
  if (cell === true) {
    content = 'actif'
  } else if (cell === false) {
    content = 'inactif'
  } else if (cell === 'idle') {
    content = createInterrogationPointCell()
  } else if (cell === 'loading') {
    content = createLoadingCell()
  } else if (cell === '?' && column.name !== 'Site') {
    content = createInterrogationPointCell()
  } else if (column.name === 'Site') {
    content =
      cell === '?'
        ? `<span class='w-full block text-center cursor-default'>?</sapn>`
        : `<span>${cell}</span>`
    content = html(`
        ${content}
        <div class="delete absolute top-1/2 -translate-y-1/2 right-2 bg-gray-200/70 text-gray-700 p-2 cursor-pointer hover:bg-gray-300 hidden group-hover:block rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24">
                <path fill="currentColor" d="M7 21q-.825 0-1.413-.588T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.588 1.413T17 21H7ZM17 6H7v13h10V6ZM9 17h2V8H9v9Zm4 0h2V8h-2v9ZM7 6v13V6Z"/>
            </svg>
        </div>
`)
  } else if (column.name === 'Url') {
    const [isInputString, value, raiseError] = cell.split(' ')
    const isInput = isInputString === '#input#'
    if (!isInput) {
      content = html(`
                <span>${cell}</span>
                <span class="url absolute inset-0 cursor-pointer"></span>
                <div class="copy-content absolute top-1/2 -translate-y-1/2 right-2 bg-gray-200/70 text-gray-700 p-2 cursor-pointer hover:bg-gray-300 hidden group-hover:block rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M9 18q-.825 0-1.413-.588T7 16V4q0-.825.588-1.413T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.588 1.413T18 18H9Zm0-2h9V4H9v12Zm-4 6q-.825 0-1.413-.588T3 20V7q0-.425.288-.713T4 6q.425 0 .713.288T5 7v13h10q.425 0 .713.288T16 21q0 .425-.288.713T15 22H5Zm4-6V4v12Z" />
                    </svg>
                </div>
        `)
    } else {
      content = createInputCell(column, value, raiseError === '#raiseError#')
    }
  } else {
    content = cell
  }

  return content
}

function createInputCell(column, value = '', raiseError) {
  const modal = raiseError
    ? `
    <p class='absolute px-3 py-2 bg-red-100 text-red-950 rounded-md border-2 border-red-500 -top-5 right-0 left-0 -translate-y-full'>L'url n'est pas valide, veuillez entrer une adresse correcte</p>
    `
    : ''
  return html(`
    <input-cell class='relative'>
        ${modal}
        <input type='text' placeholder='${column.name}' class='w-full outline-none bg-stone-100' value='${value}' />
    </input-cell>
    `)
}

function createInterrogationPointCell() {
  return html(`<span class='w-full block text-center cursor-default'>?</sapn>`)
}

function createLoadingCell() {
  return html(`
    <span class='block text-center'>
        <svg class="w-5 inline-block cursor-default animate-spin h-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </span>
    `)
}

async function updateGridData(payload) {
  const newData = await fetchBacklinks()
  if (payload?.type === 'input') {
    let inputString = `#input# ${payload.value}`
    if (payload.error) inputString += ' #raiseError#'
    newData.push(['idle', inputString, 'idle', 'idle'])
  } else if (payload?.type === 'row') {
    newData.push(['loading', payload.value, 'loading', 'loading'])
  }
  if (!newData.length) return

  grid
    .updateConfig({
      data: newData,
    })
    .forceRender()
}

function isValidUrl(url) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

async function copyLinkElement(e, content) {
  try {
    const elemClicked = e.target
    const isCellUrl = elemClicked.classList.contains('url')
    const isCopyButton = !!elemClicked.closest('.copy-content')

    if (isCellUrl) {
      window.open(content)
    } else if (isCopyButton) {
      await navigator.clipboard.writeText(content)
    }
  } catch (err) {
    console.error('Erreur lors de la copie', err)
  }
}

async function deleteLinkElement(e, cells) {
  try {
    const elemClicked = e.target
    const deleteButton = elemClicked?.closest('.delete')
    const isdeleteButton = !!deleteButton

    if (isdeleteButton) {
      const cell = deleteButton.closest('td')
      deleteButton.remove()

      //create loading button
      const loadingButton = document.createElement('span')
      loadingButton.classList.add(
        'absolute',
        'top-1/2',
        '-translate-y-1/2',
        'right-2',
        'bg-gray-200/70',
        'text-gray-700',
        'p-2',
        'cursor-pointer',
        'hover:bg-gray-300',
        'rounded'
      )
      loadingButton.innerHTML = `
                <span class='block text-center'>
                    <svg class="w-5 inline-block cursor-default animate-spin h-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </span>
                `
      cell.appendChild(loadingButton)

      //call serve to delete from database
      const response = await fetch('/api/backlinks/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: cells[1].data,
        }),
      })

      if (!response.ok) {
        throw new Error()
      } else {
        await updateGridData()
      }
    }
  } catch (err) {
    console.error('Erreur lors de la suppression du lien', err)
  }
}

/***** Events *****/
document
  .getElementById('add-row')
  .addEventListener('click', () => updateGridData({ type: 'input', value: '' }))

/***** classes *****/
class InputCell extends HTMLElement {
  constructor() {
    super()
    this.input = this.querySelector('input')
  }

  connectedCallback() {
    this.input.focus()
    this.input.addEventListener('change', this.onInputChange)
  }

  disconnectedCallback() {
    this.input.removeEventListener('change', this.onInputChange)
  }

  onInputChange = async (e) => {
    const url = e.target.value
    if (!url) {
      updateGridData()
      return
    } else if (!isValidUrl(url)) {
      updateGridData({ type: 'input', value: e.target.value, error: true })
      return
    } else {
      await this.checkLink(e.target.value)
    }
  }

  async checkLink(url) {
    try {
      await updateGridData({ type: 'row', value: url })
      const response = await fetch('/api/backlinks/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [url],
        }),
      })

      if (!response.ok) {
        throw new Error()
      } else {
        await updateGridData()
      }
    } catch (error) {
      updateGridData({ type: 'input', value: url, error: true })
    }
  }
}
customElements.define('input-cell', InputCell)
