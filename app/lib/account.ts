// Mock sign-in: the one-time code is shown on the page, never sent, and there is no password.

import { defaultStore, isRecord, read, remove, write } from './storage.ts'

const SESSION_KEY = 'usual:account'
export const FIRST_NAME_MAX = 24

export interface Session {
  firstName: string
  contact: string
}

export interface Contact {
  kind: 'email' | 'mobile'
  /** lea@example.com, or +63 917 123 4567. */
  value: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** An email address, or a mobile number written 09xx, 639xx or +639xx; with `kind`, only that kind counts. */
export function parseContact(raw: string, kind?: Contact['kind']): Contact | null {
  const text = raw.trim()
  const found = readContact(text)
  return found && (!kind || found.kind === kind) ? found : null
}

function readContact(text: string): Contact | null {
  if (text.includes('@')) return EMAIL.test(text) ? { kind: 'email', value: text.toLowerCase() } : null
  const digits = text.replace(/[\s().-]/g, '')
  const match = digits.match(/^(?:\+?63|0)(9\d{9})$/)
  if (!match) return null
  const n = match[1]
  return { kind: 'mobile', value: `+63 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` }
}

/** The message to show for a first name that won't do, or null. */
export function validFirstName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Add your first name.'
  if ([...trimmed].length > FIRST_NAME_MAX) return `Keep your first name to ${FIRST_NAME_MAX} characters.`
  return null
}

export function demoCode(random: () => number = Math.random): string {
  return String(1000 + Math.floor(random() * 9000))
}

export function codeMatches(entered: string, code: string): boolean {
  return entered.replace(/\s/g, '') === code
}

export function loadSession(store: Storage | null = defaultStore()): Session | null {
  const value = read(store, SESSION_KEY)
  if (!isRecord(value) || typeof value.firstName !== 'string' || typeof value.contact !== 'string') return null
  if (validFirstName(value.firstName) !== null || !parseContact(value.contact)) return null
  return { firstName: value.firstName.trim(), contact: value.contact }
}

export function saveSession(session: Session, store: Storage | null = defaultStore()): void {
  write(store, SESSION_KEY, session)
}

export function clearSession(store: Storage | null = defaultStore()): void {
  remove(store, SESSION_KEY)
}
