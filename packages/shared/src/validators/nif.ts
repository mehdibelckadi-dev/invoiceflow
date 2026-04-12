/**
 * Validación NIF/NIE/CIF — algoritmo oficial español
 */

const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const CIF_CONTROL_LETTERS = 'JABCDEFGHI'
const CIF_ORG_LETTERS = /^[ABCDEFGHJKLMNPQRSUVW]/i

// Tipos de entidad que usan letra de control (no dígito)
const CIF_LETTER_CONTROL_ORG = /^[KPQRSNW]/i

export type NifValidationResult =
  | { valid: true; type: 'NIF' | 'NIE' | 'CIF' }
  | { valid: false; error: string }

export function validateNif(value: string): NifValidationResult {
  const v = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

  if (!v || v.length < 9) {
    return { valid: false, error: 'Longitud inválida' }
  }

  // NIE: X, Y o Z + 7 dígitos + letra
  if (/^[XYZ]/.test(v)) {
    return validateNie(v)
  }

  // CIF: letra + 7 dígitos + dígito/letra control
  if (CIF_ORG_LETTERS.test(v)) {
    return validateCif(v)
  }

  // NIF: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(v)) {
    return validateNifPersonaFisica(v)
  }

  return { valid: false, error: 'Formato no reconocido' }
}

function validateNifPersonaFisica(v: string): NifValidationResult {
  const digits = parseInt(v.slice(0, 8), 10)
  const letter = v[8]
  const expected = NIF_LETTERS[digits % 23]
  if (letter !== expected) {
    return { valid: false, error: `Letra de control incorrecta (esperada: ${expected})` }
  }
  return { valid: true, type: 'NIF' }
}

function validateNie(v: string): NifValidationResult {
  if (!/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    return { valid: false, error: 'Formato NIE inválido' }
  }
  const prefix = v[0] === 'X' ? '0' : v[0] === 'Y' ? '1' : '2'
  const digits = parseInt(prefix + v.slice(1, 8), 10)
  const letter = v[8]
  const expected = NIF_LETTERS[digits % 23]
  if (letter !== expected) {
    return { valid: false, error: `Letra de control NIE incorrecta (esperada: ${expected})` }
  }
  return { valid: true, type: 'NIE' }
}

function validateCif(v: string): NifValidationResult {
  if (!/^[A-Z]\d{7}[A-Z0-9]$/.test(v)) {
    return { valid: false, error: 'Formato CIF inválido' }
  }

  const orgLetter = v[0]
  const digits = v.slice(1, 8)
  const control = v[8]

  // Calcular suma de control
  let sum = 0
  for (let i = 0; i < 7; i++) {
    let n = parseInt(digits[i], 10)
    if (i % 2 === 0) {
      // Posiciones impares (1, 3, 5): duplicar y sumar dígitos
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }

  const controlDigit = (10 - (sum % 10)) % 10
  const controlLetter = CIF_CONTROL_LETTERS[controlDigit]

  if (CIF_LETTER_CONTROL_ORG.test(orgLetter)) {
    // Control debe ser letra
    if (control !== controlLetter) {
      return { valid: false, error: `Letra de control CIF incorrecta (esperada: ${controlLetter})` }
    }
  } else {
    // Control puede ser dígito o letra
    const isValidDigit = control === String(controlDigit)
    const isValidLetter = control === controlLetter
    if (!isValidDigit && !isValidLetter) {
      return { valid: false, error: `Carácter de control CIF incorrecto (esperado: ${controlDigit} o ${controlLetter})` }
    }
  }

  return { valid: true, type: 'CIF' }
}

/** Retorna true/false — para uso en Zod schemas */
export function isValidNif(value: string): boolean {
  return validateNif(value).valid
}
