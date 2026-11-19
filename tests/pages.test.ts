import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { DRINKS, BITES } from '../app/lib/menu.ts'
import { BRANCHES } from '../app/lib/branches.ts'
import { includePartials, pageKey } from '../build/includes.ts'

// Every page as the build sees it, with the head, header and footer included (build/includes.ts).
const SITE = 'https://example.test/usual/'
const PAGES = [
  { key: 'home', file: 'index.html', path: '' },
  { key: 'menu', file: 'menu/index.html', path: 'menu/' },
  { key: 'order', file: 'order/index.html', path: 'order/' },
  { key: 'rewards', file: 'rewards/index.html', path: 'rewards/' },
  { key: 'branches', file: 'branches/index.html', path: 'branches/' },
  { key: 'account', file: 'account/index.html', path: 'account/' },
  { key: 'bag', file: 'bag/index.html', path: 'bag/' },
  { key: 'about', file: 'about/index.html', path: 'about/' },
  { key: 'contact', file: 'contact/index.html', path: 'contact/' },
  { key: 'terms', file: 'terms/index.html', path: 'terms/' },
  { key: 'privacy', file: 'privacy/index.html', path: 'privacy/' },
  { key: 'cookies', file: 'cookies/index.html', path: 'cookies/' },
  { key: 'accessibility', file: 'accessibility/index.html', path: 'accessibility/' },
] as const
type Key = (typeof PAGES)[number]['key']

// Spelled in pieces so a plain grep of the product sources finds nothing, not even this test.
const AUTHOR = new RegExp(['van' + ' omar', 'bena' + 'ires', 'designed' + ' and built', 'port' + 'folio', 'git' + 'hub'].join('|'), 'i')
const DISCLOSURE = 'Usual is a concept brand. This is a demonstration site: nothing you enter here is sent, and no payments are taken.'

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const PARTIALS = Object.fromEntries(['head', 'header', 'footer'].map((name) => [`components/${name}.html`, read(`app/components/${name}.html`)]))
const source = Object.fromEntries(PAGES.map((page) => [page.key, read(`app/${page.file}`)])) as Record<Key, string>
const built = Object.fromEntries(PAGES.map((page) => [page.key, includePartials(source[page.key], page.key, PARTIALS, { base: '/usual/', site: SITE })])) as Record<Key, string>
const header = PARTIALS['components/header.html']
const footer = PARTIALS['components/footer.html']
const meta = (html: string, attr: string, name: string) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`))?.[1]

// Every source file but the tests: app/, build/ and the harness.
const srcFiles = (dir: string): string[] => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? srcFiles(`${dir}/${entry.name}`) : /\.(ts|css|html)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [`${dir}/${entry.name}`] : [])
const PRODUCT = [...srcFiles('app'), ...srcFiles('build'), ...srcFiles('tests')]

test('every page has its own title, description, canonical URL, Open Graph tags and noindex', () => {
  const titles = new Set<string>()
  for (const page of PAGES) {
    const html = built[page.key]
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
    assert.ok(title, `${page.file} has a title`)
    assert.ok(!titles.has(title), `${page.file} title is unique`)
    titles.add(title)
    const description = meta(html, 'name', 'description')
    assert.ok(description, `${page.file} has a description`)
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${page.path}" />`), `${page.file} canonical`)
    assert.equal(meta(html, 'property', 'og:url'), `${SITE}${page.path}`, `${page.file} og:url`)
    assert.equal(meta(html, 'property', 'og:title'), title, `${page.file} og:title`)
    assert.equal(meta(html, 'property', 'og:description'), description, `${page.file} og:description`)
    assert.equal(meta(html, 'property', 'og:image'), `${SITE}og.png`, `${page.file} og:image`)
    assert.equal(meta(html, 'name', 'robots'), 'noindex', `${page.file} noindex`)
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${page.file} has one h1`)
    assert.match(html, /<main id="main"/, `${page.file} main landmark for the skip link`)
    for (const part of ['head', 'header', 'footer']) assert.match(source[page.key], new RegExp(`<!-- include components/${part}\\.html -->`), `${page.file} includes ${part}`)
  }
})

test('the header reaches every page, signs in and shows the bag', () => {
  for (const key of ['menu', 'order', 'rewards', 'branches', 'account']) {
    assert.ok((header.match(new RegExp(`data-page="${key}"`, 'g')) ?? []).length >= 2, `header links to ${key} on desktop and phones`)
  }
  assert.match(header, /href="%BASE_URL%account\/"[^>]*>[\s\S]*?Sign in/)
  assert.match(header, /href="%BASE_URL%bag\/"[^>]*data-bag-link/)
  assert.match(header, /href="#main"/)
})

test('the footer is a company footer with an About this site link and no disclosure line', () => {
  assert.ok(!footer.includes(DISCLOSURE), 'no disclosure line in the footer')
  assert.match(footer, /<button [^>]*data-concept[^>]*>About this site<\/button>/, 'About this site opens the dialog')
  assert.match(footer, /<dialog [^>]*id="concept-dialog"[\s\S]*?About this site/)
  for (const [path, name] of [['menu/', 'Menu'], ['order/', 'Order ahead'], ['rewards/', 'Rewards'], ['branches/', 'Branches'], ['about/', 'About'], ['contact/', 'Contact'], ['accessibility/', 'Accessibility'], ['terms/', 'Terms of Service'], ['privacy/', 'Privacy Policy'], ['cookies/', 'Cookie Policy']]) {
    assert.match(footer, new RegExp(`href="%BASE_URL%${path}"[^>]*>${name}<`), `footer links to ${name}`)
  }
  assert.match(footer, /href="%BASE_URL%contact\/#faq"[^>]*>FAQ</)
  assert.match(footer, /© 2026 Usual/)
  assert.ok(source.terms.includes(DISCLOSURE), 'the demonstration statement is on Terms')
})

test('the footer leads with the three branches and today’s status, then inline link groups, then the © line', () => {
  const foot = footer.match(/<footer[\s\S]*?<\/footer>/)![0]
  assert.match(foot, /^<footer class="[^"]*\bbg-accent-wash\b/, 'Usual’s own pale stamp-blue band, not a dark one')
  assert.doesNotMatch(foot, /\bbg-ink\b|text-on-ink/, 'no dark footer')
  const firstBranch = foot.indexOf('data-branch-status=')
  assert.ok(firstBranch > 0 && firstBranch < foot.indexOf('footer-link'), 'the branches come before every link')
  for (const branch of BRANCHES) {
    assert.match(foot, new RegExp(`>${branch.name}<`), `${branch.name} is named`)
    assert.match(foot, new RegExp(`data-branch-status="${branch.id}"`), `${branch.name} shows today’s status`)
  }
  assert.equal((foot.match(/Open 24 hours/g) ?? []).length, 1, 'IT Park’s hours')
  assert.equal((foot.match(/7:00 AM to 10:00 PM/g) ?? []).length, 2, 'Banilad’s and Capitol Site’s hours')
  assert.doesNotMatch(foot, /lg:col-span-2/, 'links sit in inline groups, not four columns')
  assert.doesNotMatch(foot, /<form|type="email"|Subscribe/, 'no newsletter')
  const copyright = foot.indexOf('© 2026 Usual')
  assert.ok(copyright > foot.lastIndexOf('footer-link" href'), 'the © line comes last')
  assert.ok(foot.search(/data-concept[^>]*>About this site</) > copyright, 'About this site follows the © line')
})

test('the newsletter is gone: no form, no script, no copy left in the product', () => {
  for (const file of PRODUCT) assert.doesNotMatch(read(file), /newsletter/i, file)
  assert.doesNotMatch(read('app/contact/forms.ts'), /initNewsletter/)
})

test('the product never names its author, and no page asks if it is a real business', () => {
  for (const file of PRODUCT) {
    const text = read(file)
    assert.doesNotMatch(text, AUTHOR, file)
    assert.doesNotMatch(text, /real business/i, file)
  }
})

test('no password field, no card or account number field, no phone or email to contact', () => {
  for (const file of PRODUCT) {
    const text = read(file)
    assert.doesNotMatch(text, /type="password"|type = 'password'|\.type = ['"]password['"]/, `${file}: no password input`)
    assert.doesNotMatch(text, /<input[^>]*(name|id|autocomplete)="[^"]*(cc-|card|cvv|cvc|account-?number|expiry)/i, `${file}: no card or account number input`)
    assert.doesNotMatch(text, /<label[^>]*>[^<]*(card number|cvv|cvc|account number|expiry)/i, `${file}: no card or account number label`)
    assert.doesNotMatch(text, /href="(mailto|tel):/, `${file}: no email or phone link`)
  }
})

const sectionsOf = (html: string) => [...html.matchAll(/<section[\s\S]*?<\/section>/g)].map((m) => m[0])

test('Home opens with the headline, the two actions, the concept note and the visitor’s own stamp card', () => {
  const [hero] = sectionsOf(source.home)
  assert.match(hero, /aria-labelledby="hero-title"/)
  assert.match(hero, /<h1 id="hero-title"/)
  assert.match(hero, /class="btn btn-primary[^"]*" href="%BASE_URL%order\/">Order ahead</)
  assert.match(hero, /href="%BASE_URL%menu\/">See the menu</)
  assert.match(hero, /pretend café[\s\S]*?<button [^>]*data-concept[^>]*>About this site</, 'the concept note, in Usual’s words, beside the main action')
  assert.match(hero, /data-stamp-card/, 'the real stamp card, painted from the saved card')
  assert.equal((hero.match(/class="stamp-slot[ "]/g) ?? []).length, 10, 'nine stamps and the free tenth')
  assert.match(hero, /data-stamp-progress/)
  assert.match(hero, /data-stamp-note/)
  assert.match(hero, /tenth drink is on us/, 'a first-time visitor sees what the tenth stamp gets them')
  assert.doesNotMatch(hero, /<img /, 'no scene photo competing with the card')
})

test('the menu comes straight after the opening: favourites and bites that open the item sheet', () => {
  const [, menu] = sectionsOf(source.home)
  assert.match(menu, /id="menu"/)
  assert.match(menu, /href="%BASE_URL%menu\/"[^>]*>See the full menu</)
  for (const id of ['spanish-latte', 'ube-latte', 'matcha-latte']) assert.match(menu, new RegExp(`class="fav-card" data-sheet-drink="${id}"`), `${id} card`)
  for (const bite of BITES) {
    assert.match(menu, new RegExp(`class="menu-item" data-sheet-bite="${bite.id}"`), `${bite.name} row`)
    assert.match(menu, new RegExp(`>₱${bite.price}<`), `${bite.name} price`)
  }
  assert.doesNotMatch(menu, /role="tablist"|data-add-drink|data-add-bite/, 'no tabs and no plus buttons: the rows and cards open the sheet')
})

test('Home has a slim seasonal band, branches with today’s status, and the app, and none of the old template', () => {
  const home = source.home
  const sections = sectionsOf(home)
  assert.match(sections[2], /data-promo/, 'the Tablea band follows the menu')
  assert.match(sections[2], /₱\d+/, 'the promo is in Usual’s own prices')
  assert.match(sections[2], /<button [^>]*data-sheet-drink="tablea"/, 'the Tablea opens the item sheet like every other drink')
  assert.doesNotMatch(sections[2], /text-h2/, 'a slim band, not a full section')
  const branches = sections.find((s) => /id="branches"/.test(s))
  assert.ok(branches, 'a branches section')
  for (const branch of BRANCHES) {
    assert.match(branches, new RegExp(`data-branch-status="${branch.id}"`), `${branch.name}: open or closed now`)
    assert.match(branches, new RegExp(`data-branch-pickup="${branch.id}"`), `${branch.name}: earliest pickup`)
  }
  assert.match(branches, /Open 24 hours/)
  for (const id of ['benefits', 'how', 'get-started']) assert.doesNotMatch(home, new RegExp(`id="${id}"`), `no #${id}`)
  assert.doesNotMatch(home, /Why people order ahead|How ordering ahead works|ten minutes away|Step 1/, 'no benefits row, numbered steps or closing call')
  for (const [, heading] of home.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g)) assert.doesNotMatch(heading, /in one place|in your pocket/i, `headline formula: ${heading}`)
  assert.doesNotMatch(home, /★|\b\d[\d,.]*\+?\s*(stars?|reviews?|ratings?|customers|downloads)\b/i, 'no invented proof')
  assert.ok(!home.includes('data-order-builder'), 'no order builder on Home')
  assert.match(source.order, /demonstration site[\s\S]*?<button [^>]*data-concept/, 'the concept note beside the order builder')
  for (const page of ['menu/', 'order/', 'rewards/', 'branches/']) assert.match(home, new RegExp(`href="%BASE_URL%${page}"`), `Home links to ${page}`)
})

test('the app on Home is one phone that shows the saved usual, not a second stamp card', () => {
  const app = sectionsOf(source.home).find((s) => /id="app"/.test(s))!
  assert.ok(app, 'an app section')
  const stores = [...app.matchAll(/<button[^>]*data-concept[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0])
  assert.equal(stores.length, 2, 'two store buttons open the About this site dialog')
  const devices = app.split(/class="device[ "]/).slice(1)
  assert.equal(devices.length, 1, 'one phone')
  for (const part of ['device__island', 'device__status', 'device__tabbar', 'device__home']) assert.ok(devices[0].includes(part), part)
  assert.match(devices[0], /<img [^>]*src="\/photos\//, 'real drink photos on the screen')
  assert.match(devices[0], /₱\d+/, 'real prices on the screen')
  assert.match(devices[0], /Your usual/)
  assert.doesNotMatch(app, /stamp-slot|mini-card/, 'the stamp card is already the opening; the app does not repeat it')
})

test('each feature lives on its own page', () => {
  assert.match(source.order, /data-order-builder/)
  for (const pay of ['gcash', 'maya', 'card']) {
    assert.match(source.order, new RegExp(`name="payment" value="${pay}"`), `Order offers ${pay}`)
    assert.match(source.bag, new RegExp(`name="payment" value="${pay}"`), `checkout offers ${pay}`)
  }
  assert.match(source.order, /data-add-to-bag/)
  assert.match(source.rewards, /data-stamp-card/)
  assert.equal((source.branches.match(/data-branch="/g) ?? []).length, 3)
  for (const drink of DRINKS) {
    assert.ok(source.menu.includes(`>${drink.name}<`), `Menu lists ${drink.name}`)
    assert.match(source.menu, new RegExp(`data-sheet-drink="${drink.id}"`), `Menu opens ${drink.name} in the item sheet`)
  }
  for (const bite of BITES) assert.match(source.menu, new RegExp(`data-sheet-bite="${bite.id}"`), `Menu opens ${bite.name} in the item sheet`)
  assert.match(source.account, /data-signin/)
  assert.match(source.account, /autocomplete="one-time-code"/)
  assert.match(source.account, /data-stamp-card/)
  assert.match(source.bag, /data-bag/)
  assert.match(source.contact, /<form [^>]*data-contact-form/)
  assert.match(source.contact, /id="faq"/)
  assert.doesNotMatch(source.contact, /reply within/, 'no promise of a reply beside a form that sends nothing')
})

test('every drink and bite on the Menu has its own photo, lazy, sized, described, from files that exist', () => {
  const rows = [...source.menu.matchAll(/<li[^>]*>\s*<button type="button" class="menu-item"[\s\S]*?<\/li>/g)].map(([row]) => row)
  for (const item of [...DRINKS, ...BITES]) {
    const row = rows.find((r) => r.includes(`data-desc-for="${item.id}"`))
    assert.ok(row, `${item.name}: has a row`)
    const img = row.match(/<img [^>]*>/)?.[0]
    assert.ok(img, `${item.name}: the row shows a photo`)
    assert.ok(img.includes(`src="/photos/menu-${item.id}-160.webp"`) && img.includes(`/photos/menu-${item.id}-320.webp 320w`), `${item.name}: 160 and 320 px files`)
    assert.ok(img.includes('width="160"') && img.includes('height="160"') && img.includes('loading="lazy"'), `${item.name}: sized and lazy`)
    assert.match(img, /alt="[^"]{12,}"/, `${item.name}: describes the photo`)
    for (const px of [160, 320]) assert.ok(existsSync(new URL(`../public/photos/menu-${item.id}-${px}.webp`, import.meta.url)), `${item.name}: ${px} px file exists`)
  }
})

test('each menu item is one tappable row with one price, like a delivery app: no plus buttons, no per-size buttons', () => {
  const rows = [...source.menu.matchAll(/<li[^>]*>\s*<button type="button" class="menu-item"[\s\S]*?<\/li>/g)].map(([row]) => row)
  assert.equal(rows.length, DRINKS.length + BITES.length, 'a row for every drink and bite')
  for (const drink of DRINKS) {
    const row = rows.find((r) => r.includes(`data-sheet-drink="${drink.id}"`))
    assert.ok(row, `${drink.name}: a row that opens the item sheet`)
    assert.match(row, /aria-haspopup="dialog"/)
    assert.match(row, new RegExp(`aria-labelledby="item-${drink.id}-name item-${drink.id}-price"`), `${drink.name}: read out as its name and price`)
    const prices = Object.values(drink.prices)
    if (prices.length > 1) assert.match(row, new RegExp(`>From</span> ₱${Math.min(...prices)}<`), `${drink.name}: its starting price`)
    else assert.match(row, new RegExp(`id="item-${drink.id}-price">₱${prices[0]}<`), `${drink.name}: its one price`)
    assert.equal((row.match(/<button /g) ?? []).length, 1, `${drink.name}: the row is the only button`)
  }
  for (const bite of BITES) {
    const row = rows.find((r) => r.includes(`data-sheet-bite="${bite.id}"`))
    assert.ok(row && row.includes(`>₱${bite.price}<`), `${bite.name}: a row with its price that opens the item sheet`)
  }
  for (const key of ['home', 'menu'] as const) {
    assert.doesNotMatch(source[key], /class="(?:price-add|size-add|add-btn)|data-choose-size/, `${key}: no plus or per-size buttons are left`)
    const favourites = source[key].match(/aria-label="House favourites"[\s\S]*?<\/ul>/)?.[0] ?? ''
    for (const id of ['spanish-latte', 'ube-latte', 'matcha-latte']) {
      const drink = DRINKS.find((d) => d.id === id)!
      assert.ok(favourites.includes(`class="fav-card" data-sheet-drink="${id}"`) && favourites.includes(`>From</span> ₱${drink.prices['12oz']}<`), `${key}: the ${drink.name} card opens the item sheet and shows its starting price`)
    }
  }
  assert.doesNotMatch(source.menu, /<span class="w-19 text-right">12 oz<\/span>|>one size</, 'no size column headers or loose size notes')
})

test('the item sheet is on every page: the item, its choices as rows, a note for the barista, the quantity and Add to bag', () => {
  const sheet = footer.match(/<dialog [^>]*id="item-sheet"[\s\S]*?<\/dialog>/)?.[0]
  assert.ok(sheet, 'the footer carries the item sheet')
  assert.match(sheet, /aria-labelledby="sheet-title"/)
  for (const hook of ['data-sheet-photo', 'data-sheet-name', 'data-sheet-desc', 'data-sheet-price', 'data-sheet-groups', 'data-sheet-close', 'data-sheet-less', 'data-sheet-qty', 'data-sheet-more'])
    assert.ok(sheet.includes(hook), `the sheet has ${hook}`)
  assert.match(sheet, /<label [^>]*for="sheet-note">Note for the barista<\/label>/, 'the note is labelled')
  assert.match(sheet, /data-sheet-photo/)
  assert.match(sheet, /srcset="[^"]*item-[a-z-]+-640\.webp 640w, [^"]*item-[a-z-]+-896\.webp 896w"/, 'the sheet photo is the large 4:5 crop')
  for (const item of [...DRINKS, ...BITES]) for (const px of [640, 896]) assert.ok(existsSync(new URL(`../public/photos/item-${item.id}-${px}.webp`, import.meta.url)), `${item.name}: ${px} px sheet photo exists`)
  assert.match(sheet, /<textarea [^>]*id="sheet-note" name="note"[^>]*maxlength="140"/, 'the note is capped at 140 characters')
  assert.match(sheet, /<button type="submit" class="btn btn-primary[^"]*" data-sheet-add>/, 'Add to bag is the one primary action')
  assert.doesNotMatch(sheet, /class="chips|grid-cols-2/, 'choices are rows, not a grid of chips')
  assert.match(source.bag, /data-line-note/, 'the bag shows each line\u2019s note')
})

test('email-or-mobile fields let people pick, so phones get the right keyboard', () => {
  for (const key of ['account', 'contact'] as const) {
    assert.match(source[key], /name="via" value="email" checked/, `${key} offers email`)
    assert.match(source[key], /name="via" value="mobile"/, `${key} offers a mobile number`)
    assert.doesNotMatch(source[key], /<input[^>]*name="contact"[^>]*inputmode="email"/, `${key}: no email keyboard forced on a mobile number`)
  }
})

test('the 404 page has the shared header and footer, its own tags and no canonical', () => {
  const page = read('app/404.html')
  const html = includePartials(page, pageKey('404.html'), PARTIALS, { base: '/usual/', site: SITE })
  assert.match(page, /<!-- include components\/header\.html -->/)
  assert.match(page, /<!-- include components\/footer\.html -->/)
  assert.match(html, />About this site<\/button>/, 'the About this site link')
  assert.match(html, /id="concept-dialog"/)
  assert.match(page, /<script type="module" src="\/main\.ts"><\/script>/)
  assert.doesNotMatch(page, /rel="canonical"/)
  for (const [attr, name] of [['name', 'robots'], ['property', 'og:title'], ['property', 'og:description'], ['property', 'og:image'], ['property', 'og:image:alt'], ['name', 'twitter:card'], ['name', 'twitter:title'], ['name', 'twitter:description'], ['name', 'twitter:image']]) {
    assert.ok(meta(html, attr, name), `404 has ${name}`)
  }
  for (const path of ['menu/', 'order/', 'rewards/', 'branches/']) assert.match(page, new RegExp(`<main[\\s\\S]*href="%BASE_URL%${path}"[\\s\\S]*</main>`), `404 links to ${path}`)
  assert.equal((page.match(/<h1[\s>]/g) ?? []).length, 1)
})

test('the legal pages read like a Philippine small business’s', () => {
  assert.match(source.privacy, /Data Privacy Act of 2012/)
  assert.match(source.privacy, /10173/)
  assert.match(source.privacy, /National Privacy Commission/)
  assert.match(source.cookies, /doesn’t use cookies/)
  for (const key of ['usual:card', 'usual:usual', 'usual:account', 'usual:bag']) {
    assert.ok(source.cookies.includes(key), `Cookie Policy lists ${key}`)
    assert.ok(source.privacy.includes(key), `Privacy Policy lists ${key}`)
  }
  const keys = (html: string) => [...html.matchAll(/<code>(usual:[a-z]+)<\/code>/g)].map((m) => m[1]).filter((k, i, all) => all.indexOf(k) === i).sort()
  assert.deepEqual(keys(source.privacy), keys(source.cookies), 'Privacy and Cookies list the same storage')
  for (const key of ['terms', 'privacy', 'cookies', 'accessibility'] as const) assert.match(source[key], /demonstration site/, `${key} says it is a demonstration site`)
})

test('the include step fills in the page’s address, title and description and marks the current page', () => {
  assert.equal(pageKey('index.html'), 'home')
  assert.equal(pageKey('menu/index.html'), 'menu')
  assert.equal(pageKey('order/index.html'), 'order')
  const html = includePartials(
    '<head><title>Menu at Usual</title><meta name="description" content="Drinks &amp; bites" /><!-- include components/head.html --></head><body><!-- include components/header.html --></body>',
    'menu',
    {
      'components/head.html': '<link rel="canonical" href="%PAGE_URL%" /><meta property="og:title" content="%TITLE%" /><meta property="og:description" content="%DESCRIPTION%" /><meta property="og:image" content="%SITE_URL%og.png" />',
      'components/header.html': '<a href="%BASE_URL%menu/" data-page="menu">Menu</a><a href="%BASE_URL%rewards/" data-page="rewards">Rewards</a>',
    },
    { base: '/usual/', site: 'https://example.test/usual/' },
  )
  assert.equal(html, '<head><title>Menu at Usual</title><meta name="description" content="Drinks &amp; bites" /><link rel="canonical" href="https://example.test/usual/menu/" /><meta property="og:title" content="Menu at Usual" /><meta property="og:description" content="Drinks &amp; bites" /><meta property="og:image" content="https://example.test/usual/og.png" /></head><body><a href="/usual/menu/" data-page="menu" aria-current="page">Menu</a><a href="/usual/rewards/" data-page="rewards">Rewards</a></body>')
  assert.throws(() => includePartials('<!-- include components/nope.html -->', 'home', {}, { base: '/usual/', site: SITE }), /nope/)
  assert.throws(() => includePartials('<a href="%SITE_URL%x">', 'home', {}, { base: '/usual/', site: '' }), /full URL/, 'an unset site address stops the build')
})

test('sections reveal on scroll only once the script has marked the page, and never under reduced motion', () => {
  const css = read('app/styles/main.css')
  assert.match(read('app/main.ts'), /\bboot\(\)/, 'every page runs the shared start-up')
  assert.match(read('app/boot.ts'), /initReveal\(\)/, 'which starts the reveal module')
  assert.match(css, /\.js \[data-reveal\]:not\(\[data-revealed\]\)/, 'the hidden start state needs the js class')
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.js \[data-reveal\],\s*\.js \[data-reveal\]:not\(\[data-revealed\]\),\s*\.js \[data-reveal\] \[data-stagger\] > \*,\s*\.js \[data-reveal\]:not\(\[data-revealed\]\) \[data-stagger\] > \*/, 'the reduced-motion override matches the hidden selectors, so it wins on specificity')
  assert.doesNotMatch(css, /\[data-reveal\][^{]*\{[^}]*\b(top|margin|height|padding)\s*:/, 'reveal uses transform and opacity only')
})

test('the phone menu is a bottom sheet dialog: page rows, the account, and Order ahead at the bottom', () => {
  assert.doesNotMatch(header, /<details/, 'no drop-down disclosure any more')
  const button = header.match(/<button [^>]*aria-controls="site-menu"[^>]*>/)?.[0]
  assert.ok(button, 'a menu button that names the sheet it controls')
  assert.match(button, /aria-label="Menu"/)
  assert.match(button, /aria-expanded="false"/)
  assert.match(button, /\blg:hidden\b/, 'only below the desktop layout, as before')
  assert.match(button, /commandfor="site-menu" command="show-modal"/, 'opens without the script where the browser supports invoker commands')
  const sheet = header.match(/<dialog [^>]*id="site-menu"[\s\S]*?<\/dialog>/)?.[0]
  assert.ok(sheet, 'the sheet is a dialog')
  assert.match(sheet, /^<dialog class="sheet sheet--nav"/, 'the item sheet’s own styles, with a modifier')
  assert.match(sheet, /^<dialog [^>]*aria-label="Menu"/)
  assert.match(sheet, /<button [^>]*aria-label="Close"[^>]*data-menu-close/, 'a labelled close button')
  const keys = [...sheet.matchAll(/data-page="([a-z]+)"/g)].map((m) => m[1])
  assert.deepEqual(keys, ['home', 'menu', 'rewards', 'branches', 'about', 'contact', 'account', 'order'], 'every page, then the account, then Order ahead')
  assert.match(sheet, /<a class="btn btn-primary[^"]*" href="%BASE_URL%order\/" data-page="order">Order ahead</, 'Order ahead is the primary button at the bottom')
  const nav = read('app/shared/nav.ts')
  assert.match(nav, /\.showModal\(\)/, 'opened as a modal: focus moves in and stays, Escape closes')
  assert.match(nav, /aria-expanded/)
  assert.match(nav, /pointerdown/, 'a tap on the scrim closes it')
  const css = read('app/styles/main.css')
  assert.equal((css.match(/@keyframes sheet-up/g) ?? []).length, 1, 'one slide-up, shared with the item sheet')
  assert.match(css, /\.sheet--nav\b/)
  assert.match(css, /html:has\(dialog\[open\]\)\s*\{\s*overflow: hidden/, 'the page behind stays put')
})

test('sign-in speaks like the barista, keeps the With an account pairing, and signs out last on phones', () => {
  const page = source.account
  const script = read('app/shared/account.ts')
  for (const text of [page, script]) {
    assert.doesNotMatch(text, /Use a different email or number/)
    assert.doesNotMatch(text, /in one place/i)
  }
  assert.match(page, /What name goes on the cup\?/)
  assert.match(page, />With an account</)
  assert.match(page, /data-code-back>Change my details</)
  assert.match(page, /data-signin-cup/, 'the cup that writes the name as it is typed')
  assert.equal((page.match(/data-sign-out/g) ?? []).length, 2, 'Sign out under the usual on desktop, and after the stamp card on phones')
  assert.ok(page.lastIndexOf('data-sign-out') > page.indexOf('data-stamp-card'), 'the phone’s Sign out comes after the stamp card')
  assert.match(script, /The usual\?/, 'a regular is greeted the way a barista would')
})

test('the 404 page has no arrows, and the order page puts hot or iced in its own step', () => {
  assert.doesNotMatch(read('app/404.html'), /arrow/)
  assert.match(source.order, /data-step="temp"/)
})

test('the order ticket\'s ten small stamps fit their grid columns instead of keeping the 40 px card size', () => {
  const order = readFileSync('app/order/index.html', 'utf8')
  assert.match(order, /<ol class="mini-card grid [^"]*grid-cols-10[^"]*"/)
  const css = readFileSync('app/styles/main.css', 'utf8')
  const rule = css.match(/\.mini-card \.stamp-slot \{([^}]*)\}/)
  assert.ok(rule, '.mini-card .stamp-slot rule exists')
  assert.match(rule[1], /width: 100%/)
  assert.match(rule[1], /aspect-ratio: 1/)
})
