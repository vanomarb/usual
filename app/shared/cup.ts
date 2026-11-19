// Layers carry a kind (data-layer="milk"); the stylesheet maps each kind to its colour token.

import { drinkById } from '../lib/menu.ts'
import type { LayerKind } from '../lib/menu.ts'
import { NAME_MAX } from '../lib/order.ts'
import type { OrderChoice } from '../lib/order.ts'

// Cup geometry in the SVG's own units (viewBox 0 0 200 280).
const CUP_TOP = 54
const CUP_BOTTOM = 264
const FILL_HOT = 0.84
const FILL_ICED = 0.9
const SLEEVE_TEXT_WIDTH = 104

interface Layer {
  kind: LayerKind
  share: number
}

export function cupLayers(choice: OrderChoice): Layer[] {
  const drink = drinkById(choice.drinkId)
  if (!drink) return []
  const milk: LayerKind = choice.milk === 'oat' ? 'oat-milk' : choice.milk === 'soy' ? 'soy-milk' : 'milk'
  let layers: Layer[] = drink.layers.map((layer) => ({ kind: layer.kind === 'milk' ? milk : layer.kind, share: layer.share }))

  // Milk in a black coffee settles on top and hides the crema.
  if (drink.defaultMilk === 'none' && choice.milk !== 'none') {
    layers = layers.filter((layer) => layer.kind !== 'crema')
    layers.push({ kind: milk, share: 0.22 })
  }
  if (choice.iced) layers = layers.filter((layer) => layer.kind !== 'foam' && layer.kind !== 'froth')
  if (choice.extraShot) {
    const foam = layers.findIndex((layer) => layer.kind === 'foam' || layer.kind === 'froth')
    layers.splice(foam === -1 ? layers.length : foam, 0, { kind: 'espresso', share: 0.12 })
  }
  if (choice.syrup) layers.unshift({ kind: 'syrup', share: 0.06 })

  const total = layers.reduce((sum, layer) => sum + layer.share, 0)
  return layers.map((layer) => ({ kind: layer.kind, share: layer.share / total }))
}

export function drawCup(svg: SVGSVGElement, choice: OrderChoice): void {
  // The last rect paints on top, so it holds the bottom layer; each layer covers everything below its top edge.
  const rects = [...svg.querySelectorAll<SVGRectElement>('.cup__layer')]
  const layers = cupLayers(choice)
  const height = (choice.iced ? FILL_ICED : FILL_HOT) * (CUP_BOTTOM - CUP_TOP)
  let top = CUP_BOTTOM
  const tops = layers.map((layer) => (top -= layer.share * height))

  rects.forEach((rect, index) => {
    const layerIndex = rects.length - 1 - index
    const layer = layers[layerIndex]
    // An unused rect keeps its last kind while it drains to the bottom.
    if (layer) rect.dataset.layer = layer.kind
    rect.style.transform = `translateY(${(layer ? tops[layerIndex] : CUP_BOTTOM).toFixed(2)}px)`
  })
  svg.toggleAttribute('data-iced', choice.iced)
  svg.dataset.size = choice.size
}

export function writeName(svg: SVGSVGElement, name: string, placeholder: string): void {
  const text = svg.querySelector<SVGTextElement>('.cup__name')
  if (!text) return
  const letters = [...name.trim()]
  text.textContent = letters.length ? letters.slice(0, NAME_MAX).join('') + (letters.length > NAME_MAX ? '…' : '') : placeholder
  text.toggleAttribute('data-empty', letters.length === 0)
  text.removeAttribute('textLength')
  text.removeAttribute('lengthAdjust')
  if (text.getComputedTextLength() > SLEEVE_TEXT_WIDTH) {
    text.setAttribute('textLength', String(SLEEVE_TEXT_WIDTH))
    text.setAttribute('lengthAdjust', 'spacingAndGlyphs')
  }
}
