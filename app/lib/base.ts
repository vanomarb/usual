/** The jsdom tests run under Node, where import.meta.env doesn't exist, so they get /usual/. */
export const BASE_URL: string = import.meta.env?.BASE_URL ?? '/usual/'
