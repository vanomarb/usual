import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { includePartials, pageKey } from './build/includes.ts'

const ICON_DIR = fileURLToPath(new URL('./node_modules/@phosphor-icons/core/assets/', import.meta.url))
const WEIGHTS = new Set(['regular', 'thin', 'light', 'bold', 'fill', 'duotone'])

/**
 * <i data-icon="clock" class="size-4"></i> becomes Phosphor's clock.svg inline with class="icon size-4", so nothing
 * shifts when icons load; data-weight picks another weight, and an unknown name fails the build.
 */
function phosphorIcons(): Plugin {
  const cache = new Map<string, string>()
  const read = (weight: string, name: string): string => {
    const key = `${weight}/${name}`
    let svg = cache.get(key)
    if (!svg) {
      const file = weight === 'regular' ? name : `${name}-${weight}`
      svg = readFileSync(`${ICON_DIR}${weight}/${file}.svg`, 'utf8').trim().replace(' xmlns="http://www.w3.org/2000/svg"', '')
      cache.set(key, svg)
    }
    return svg
  }
  return {
    name: 'usual:phosphor-icons',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/<i\s+([^>]*\bdata-icon="[^"]+"[^>]*)><\/i>/g, (_match, attributes: string) => {
          const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
          const name = attrs['data-icon']
          const weight = attrs['data-weight'] ?? 'regular'
          if (!/^[a-z0-9-]+$/.test(name) || !WEIGHTS.has(weight)) throw new Error(`Bad icon: ${name} (${weight})`)
          const classes = ['icon', attrs.class].filter(Boolean).join(' ')
          return read(weight, name).replace('<svg ', `<svg class="${classes}" aria-hidden="true" focusable="false" `)
        })
      },
    },
  }
}

/** Where the site is published; canonical and Open Graph addresses start with it. The Pages workflow sets it from the repository. */
const SITE_URL = process.env.VITE_SITE_URL || 'http://localhost:4173/usual/'

/** Every folder of app/ with an index.html, each served at /usual/<name>/. */
const APP = fileURLToPath(new URL('./app/', import.meta.url))
const PAGES = readdirSync(APP, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(resolve(APP, entry.name, 'index.html')))
  .map((entry) => entry.name)

/** <!-- include components/x.html --> reads app/components/x.html; runs before the icon step, so partials can use icons. */
function partials(): Plugin {
  let root = process.cwd()
  let base = '/'
  return {
    name: 'usual:partials',
    configResolved(config) {
      root = config.root
      base = config.base
    },
    configureServer(server) {
      const dir = resolve(root, 'components')
      server.watcher.add(dir)
      server.watcher.on('change', (file) => {
        if (file.startsWith(dir)) server.ws.send({ type: 'full-reload' })
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const found = [...html.matchAll(/<!-- include (components\/([\w-]+\.html)) -->/g)].map((match) => [match[1], resolve(root, 'components', match[2])])
        const files = Object.fromEntries(found.filter(([, file]) => existsSync(file)).map(([name, file]) => [name, readFileSync(file, 'utf8')]))
        return includePartials(html, pageKey(relative(root, ctx.filename)), files, { base, site: SITE_URL })
      },
    },
  }
}

/** A %NAME% placeholder left in a built page would ship as literal text in canonical and og:url, so it fails the build. */
function noLeftoverPlaceholders(): Plugin {
  return {
    name: 'usual:no-leftover-placeholders',
    apply: 'build',
    // After Vite's own HTML step, which is what adds the pages to the bundle.
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [name, file] of Object.entries(bundle)) {
        if (!name.endsWith('.html') || file.type !== 'asset') continue
        const left = String(file.source).match(/%[A-Z][A-Z_]*%/)
        if (left) throw new Error(`${name} still contains ${left[0]}. Fill it in (VITE_SITE_URL, or the partial step) before building.`)
      }
    },
  }
}

/* The heads preload fonts from /node_modules/, which sits outside the Vite root (app/): point those URLs at the real folder. */
function nodeModulesUrls(): Plugin {
  const dir = fileURLToPath(new URL('./node_modules/', import.meta.url))
  return {
    name: 'node-modules-urls',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, { filename, server }) => html.replaceAll('"/node_modules/', `"${server ? `/@fs${dir}` : `${relative(dirname(filename), dir)}/`}`),
    },
  }
}

const page = (path: string) => resolve(APP, path)

export default defineConfig({
  root: 'app',
  publicDir: '../public',
  envDir: '..',
  base: '/usual/',
  plugins: [partials(), phosphorIcons(), nodeModulesUrls(), tailwindcss(), noLeftoverPlaceholders()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    // Tailwind v4's browser floor; all of these read oklch(), so the minifier adds no hex fallbacks.
    cssTarget: ['chrome111', 'edge111', 'firefox128', 'safari16.4'],
    rolldownOptions: {
      input: {
        main: page('index.html'),
        ...Object.fromEntries(PAGES.map((name) => [name, page(`${name}/index.html`)])),
        notFound: page('404.html'),
      },
    },
  },
})
