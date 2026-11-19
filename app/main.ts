import './styles/main.css'
import { boot } from './boot.ts'

boot()

// Smooth scrolling only after load, so a deep link lands on its section first.
const smoothScroll = () => document.documentElement.setAttribute('data-smooth-scroll', '')
if (document.readyState === 'complete') smoothScroll()
else window.addEventListener('load', smoothScroll, { once: true })
