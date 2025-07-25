import type { RegionCode } from 'Types/Translation'

export default class English {
  constructor(private region?: RegionCode) {}

  public translateOptionValue(optionValue: string) {
    const values = optionValue.split('/')
    const translatedValues = values.map((value) => this.translateByType(value))
    return translatedValues.join('/')
  }

  private translateByType(value: string) {
    let response:
      | string
      | {
          translation: string
        }

    response = this.translateIfIsOfTypeLength(value)
    if (typeof response === 'object') return response.translation

    response = this.translateIfIsOfTypeMaterial(value)
    if (typeof response === 'object') return response.translation

    response = this.translateIfIsOfTypeFixation(value)
    if (typeof response === 'object') return response.translation

    response = this.translateIfIsOfTypeChassis(value)
    if (typeof response === 'object') return response.translation

    response = this.translateIfIsOfTypeBorder(value)
    if (typeof response === 'object') return response.translation

    response = this.translateIfIsOfTypeCoating(value)
    if (typeof response === 'object') return response.translation

    response = this.translateIfIsOfTypeFrame(value)
    if (typeof response === 'object') return response.translation

    return value
  }

  private translateIfIsOfTypeLength(value: string) {
    // Only return untranslated for UK if value matches 'N cm' or 'NxM cm'
    const singleNumberPattern = /^\d+\s*cm$/
    const doubleNumberPattern = /^\d+\s*x\s*\d+\s*cm$/

    if (
      this.region === 'UK' &&
      (singleNumberPattern.test(value) || doubleNumberPattern.test(value))
    ) {
      return { translation: value }
    }

    //square
    if (value === '40x40 cm') return { translation: '15.7x15.7 in' }
    if (value === '60x60 cm') return { translation: '23.6x23.6 in' }
    if (value === '80x80 cm') return { translation: '31.5x31.5 in' }
    if (value === '100x100 cm') return { translation: '39.4x39.4 in' }

    //portrait
    if (value === '20x30 cm') return { translation: '7.9x11.8 in' }
    if (value === '30x40 cm') return { translation: '11.8x15.7 in' }
    if (value === '40x60 cm') return { translation: '15.7x23.6 in' }
    if (value === '60x80 cm') return { translation: '23.6x31.5 in' }
    if (value === '75x100 cm') return { translation: '29.5x39.4 in' }
    if (value === '90x120 cm') return { translation: '35.4x47.2 in' }

    //landscape
    if (value === '30x20 cm') return { translation: '11.8x7.9 in' }
    if (value === '40x30 cm') return { translation: '15.7x11.8 in' }
    if (value === '60x40 cm') return { translation: '23.6x15.7 in' }
    if (value === '80x60 cm') return { translation: '31.5x23.6 in' }
    if (value === '100x75 cm') return { translation: '39.4x29.5 in' }
    if (value === '120x90 cm') return { translation: '47.2x35.4 in' }

    //others
    if (value === '2 cm') return { translation: '0.8 in' }
    if (value === '4 cm') return { translation: '1.6 in' }
    else return value
  }

  private translateIfIsOfTypeMaterial(value: string) {
    if (value === 'Toile') return { translation: 'Canvas' }
    if (value === 'Aluminium') return { translation: 'Aluminium' }
    if (value === 'Aluminium + Plexiglas') return { translation: 'Aluminium + Plexiglas' }
    if (value === 'Poster') return { translation: 'Poster' }
    else return value
  }

  private translateIfIsOfTypeFixation(value: string) {
    if (value === 'Sans fixation') return { translation: 'No mounting kit' }
    if (value === 'Set de fixation') return { translation: 'Mounting kit' }
    if (value === 'Crochet') return { translation: 'Hanging Hook' }
    if (value === 'Rails') return { translation: 'Hanging Rails' }
    else return value
  }

  private translateIfIsOfTypeChassis(value: string) {
    if (value === 'Chassis de 2cm') {
      if (this.region === 'UK') {
        return { translation: '2 cm stretcher frame' }
      } else {
        return { translation: '0.8 in stretcher frame' }
      }
    }

    if (value === 'Chassis de 4cm') {
      if (this.region === 'UK') {
        return { translation: '4 cm stretcher frame' }
      } else {
        return { translation: '1.6 in stretcher frame' }
      }
    } else return value
  }

  private translateIfIsOfTypeBorder(value: string) {
    if (value === 'Bordure blanche') return { translation: 'White edges' }
    if (value === 'Bordure noire') return { translation: 'Black edges' }
    if (value === 'Bordure étirée') return { translation: 'Gallery wrap' }
    if (value === 'Bordure miroir') return { translation: 'Mirrored edges' }
    if (value === 'Bordure pliée') return { translation: 'Folded edges' }
    else return value
  }

  private translateIfIsOfTypeCoating(value: string) {
    if (value === 'Mat') return { translation: 'Matte finish' }
    if (value === 'Brillant') return { translation: 'Glossy finish' }
    else return value
  }

  private translateIfIsOfTypeFrame(value: string) {
    if (value === 'Sans cadre') return { translation: 'No frame' }
    if (value === 'Cadre blanc') return { translation: 'White frame' }
    if (value === 'Cadre noir Mat') return { translation: 'Matte black frame' }
    if (value === 'Cadre argent ancien') return { translation: 'Antique silver frame' }
    if (value === 'Cadre chêne clair') return { translation: 'Light oak frame' }
    if (value === 'Cadre noyer') return { translation: 'Walnut frame' }
    else return value
  }

  public translateSizeInText(text: string): string {
    // Regular expression to match both single number (2 cm) and double number (30x40 cm) patterns
    const sizePattern = /(\d+)(?:\s*x\s*(\d+))?\s*cm/gi

    return text.replace(sizePattern, (match) => {
      // Extract numbers
      const numbers = match.match(/\d+/g)
      if (!numbers) return match

      // Handle single number case (e.g., "2 cm")
      if (numbers.length === 1) {
        const normalizedSize = `${numbers[0]} cm`
        return this.translateOptionValue(normalizedSize)
      }

      // Handle double number case (e.g., "30x40 cm")
      if (numbers.length === 2) {
        const normalizedSize = `${numbers[0]}x${numbers[1]} cm`
        return this.translateOptionValue(normalizedSize)
      }

      return match
    })
  }
}
