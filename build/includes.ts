// <!-- include components/x.html --> becomes app/components/x.html with %BASE_URL%, %SITE_URL%, %PAGE_URL%,
// %TITLE% and %DESCRIPTION% filled in and the current page's links marked aria-current="page".

export interface IncludeOptions {
  base: string
  site: string
}

/** 'index.html' is 'home', 'menu/index.html' is 'menu'. */
export function pageKey(file: string): string {
  const dir = file.replace(/\\/g, '/').replace(/^\/+/, '').replace(/index\.html$/, '').replace(/\/+$/, '')
  return dir === '' ? 'home' : dir
}

const attr = (text: string) => text.replaceAll('"', '&quot;')

/** `partials` maps 'components/x.html' to its text; an unknown partial or a site that isn't a full URL throws. */
export function includePartials(html: string, page: string, partials: Record<string, string>, { base, site }: IncludeOptions): string {
  if (!/^https?:\/\/\S+\/$/.test(site)) throw new Error(`The site address must be a full URL ending in a slash, not "${site}". Set VITE_SITE_URL.`)
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
  const pageUrl = page === 'home' || page.endsWith('.html') ? site : `${site}${page}/`
  return html
    .replace(/<!-- include (components\/[\w-]+\.html) -->/g, (_marker, name: string) => {
      const partial = partials[name]
      if (partial === undefined) throw new Error(`Unknown partial: ${name}`)
      return partial
        .trim()
        .replaceAll('%BASE_URL%', base)
        .replaceAll('%PAGE_URL%', pageUrl)
        .replaceAll('%TITLE%', attr(title))
        .replaceAll('%DESCRIPTION%', description)
        .replaceAll(`data-page="${page}"`, `data-page="${page}" aria-current="page"`)
    })
    .replaceAll('%SITE_URL%', site)
}
