// Generates the SVG favicon and ICO-compatible PNG via canvas (node)
// We'll just write the SVG directly since Vercel serves SVG favicons fine
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF6B35"/>
      <stop offset="100%" stop-color="#F04E37"/>
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="16" cy="16" r="15" fill="url(#g1)"/>
  <!-- DNA left strand -->
  <path d="M10 4 C10 8 22 10 22 16 C22 22 10 24 10 28" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- DNA right strand -->
  <path d="M22 4 C22 8 10 10 10 16 C10 22 22 24 22 28" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- Rungs -->
  <line x1="10.5" y1="8.5"  x2="21.5" y2="8.5"  stroke="white" stroke-width="1.5" opacity="0.85"/>
  <line x1="13"   y1="12.5" x2="19"   y2="12.5" stroke="white" stroke-width="1.5" opacity="0.85"/>
  <line x1="16"   y1="16"   x2="16"   y2="16"   stroke="white" stroke-width="1.5" opacity="0.85"/>
  <line x1="13"   y1="19.5" x2="19"   y2="19.5" stroke="white" stroke-width="1.5" opacity="0.85"/>
  <line x1="10.5" y1="23.5" x2="21.5" y2="23.5" stroke="white" stroke-width="1.5" opacity="0.85"/>
</svg>`
import { writeFileSync } from 'fs'
writeFileSync('./public/favicon.svg', svg)
console.log('favicon.svg written')
