import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

async function run() {
  const server = await createServer({
    root: process.cwd(),
    server: { port: 5210 },
  })
  await server.listen()

  try {
    await withChrome(async ({ call, sessionId, evaluate, until, navigate }) => {
      // ==========================================
      // 1. TABLET PORTRAIT (768px < 840px)
      // When < 840px: hamburger appears, default nav hidden, PolitikApp NEVER shortened
      // ==========================================
      await call(
        'Emulation.setDeviceMetricsOverride',
        { width: 768, height: 1024, deviceScaleFactor: 2, mobile: false },
        sessionId
      )
      await navigate('http://localhost:5210')
      await until("document.querySelector('.topNavShell')")

      const tablet768Metrics = await evaluate(`
        (() => {
          const hamburger = document.querySelector('.topNavHamburgerBtn');
          const hoverNav = document.querySelector('.topNavHorizontalNav');
          const titleEl = document.querySelector('.topNavRow .ty-nav.whitespace-nowrap') || document.querySelector('.topNavRow .ty-nav');
          const titleText = titleEl ? titleEl.textContent.trim() : '';
          return {
            isHamburgerVisible: hamburger ? (window.getComputedStyle(hamburger).display !== 'none' && hamburger.offsetParent !== null) : false,
            isHoverNavVisible: hoverNav ? (window.getComputedStyle(hoverNav).display !== 'none' && hoverNav.getBoundingClientRect().width > 0) : false,
            titleText
          };
        })()
      `)
      console.log('[Tablet 768px < 840px] isHamburgerVisible:', tablet768Metrics.isHamburgerVisible)
      console.log('[Tablet 768px < 840px] isHoverNavVisible:', tablet768Metrics.isHoverNavVisible)
      console.log('[Tablet 768px < 840px] titleText:', tablet768Metrics.titleText)

      if (!tablet768Metrics.isHamburgerVisible) {
        throw new Error('Hamburger should be VISIBLE at 768px (< 840px)!')
      }
      if (tablet768Metrics.isHoverNavVisible) {
        throw new Error('Default horizontal nav should be HIDDEN at 768px (< 840px)!')
      }
      if (tablet768Metrics.titleText !== 'PolitikApp') {
        throw new Error(`Expected full app title 'PolitikApp', but got '${tablet768Metrics.titleText}'!`)
      }

      // ==========================================
      // 2. PHONE SCREEN (390px < 840px)
      // PolitikApp title must remain fully visible and NOT shortened
      // ==========================================
      await call(
        'Emulation.setDeviceMetricsOverride',
        { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
        sessionId
      )
      await evaluate('window.dispatchEvent(new Event("resize"))')
      await new Promise(r => setTimeout(r, 200))

      const phoneMetrics = await evaluate(`
        (() => {
          const hamburger = document.querySelector('.topNavHamburgerBtn');
          const svg = hamburger?.querySelector('svg');
          const hoverNav = document.querySelector('.topNavHorizontalNav');
          const titleEl = document.querySelector('.topNavRow .ty-nav.whitespace-nowrap') || document.querySelector('.topNavRow .ty-nav');
          const titleText = titleEl ? titleEl.textContent.trim() : '';
          return {
            isHamburgerVisible: hamburger ? (window.getComputedStyle(hamburger).display !== 'none' && hamburger.offsetParent !== null) : false,
            isHoverNavVisible: hoverNav ? (window.getComputedStyle(hoverNav).display !== 'none' && hoverNav.getBoundingClientRect().width > 0) : false,
            svgWidth: svg ? window.getComputedStyle(svg).width : null,
            svgHeight: svg ? window.getComputedStyle(svg).height : null,
            titleText
          };
        })()
      `)
      console.log('[Phone 390px] isHamburgerVisible:', phoneMetrics.isHamburgerVisible)
      console.log('[Phone 390px] isHoverNavVisible:', phoneMetrics.isHoverNavVisible)
      console.log('[Phone 390px] titleText:', phoneMetrics.titleText)
      console.log('[Phone 390px] SVG dimensions:', phoneMetrics.svgWidth, 'x', phoneMetrics.svgHeight)

      if (!phoneMetrics.isHamburgerVisible) {
        throw new Error('Hamburger must be visible on phone (390px)!')
      }
      if (phoneMetrics.isHoverNavVisible) {
        throw new Error('Default horizontal nav must be hidden on phone (390px)!')
      }
      if (phoneMetrics.titleText !== 'PolitikApp') {
        throw new Error(`Expected full title 'PolitikApp' on phone, but got '${phoneMetrics.titleText}'!`)
      }
      if (phoneMetrics.svgWidth !== '24px' || phoneMetrics.svgHeight !== '24px') {
        throw new Error(`SVG width/height expected 24px, got ${phoneMetrics.svgWidth} x ${phoneMetrics.svgHeight}`)
      }

      // ==========================================
      // 3. WIDE SCREEN (840px and 1280px >= 840px)
      // When >= 840px: default nav visible, hamburger hidden, title 'PolitikApp'
      // ==========================================
      await call(
        'Emulation.setDeviceMetricsOverride',
        { width: 840, height: 900, deviceScaleFactor: 1, mobile: false },
        sessionId
      )
      await evaluate('window.dispatchEvent(new Event("resize"))')
      await until("document.querySelector('.topNavShell')")
      await new Promise(r => setTimeout(r, 400))

      const wide840Metrics = await evaluate(`
        (() => {
          const hamburger = document.querySelector('.topNavHamburgerBtn');
          const hoverNav = document.querySelector('.topNavHorizontalNav');
          const actions = document.querySelector('.topNavHorizontalActions');
          const titleEl = document.querySelector('.topNavRow .ty-nav.whitespace-nowrap') || document.querySelector('.topNavRow .ty-nav');
          const titleText = titleEl ? titleEl.textContent.trim() : '';
          return {
            isHamburgerVisible: hamburger ? (window.getComputedStyle(hamburger).display !== 'none' && hamburger.offsetParent !== null) : false,
            isHoverNavVisible: hoverNav ? (window.getComputedStyle(hoverNav).display !== 'none' && hoverNav.getBoundingClientRect().width > 0) : false,
            isActionsVisible: actions ? (window.getComputedStyle(actions).display !== 'none' && actions.getBoundingClientRect().width > 0) : false,
            titleText
          };
        })()
      `)
      console.log('[Wide 840px] isHamburgerVisible:', wide840Metrics.isHamburgerVisible)
      console.log('[Wide 840px] isHoverNavVisible:', wide840Metrics.isHoverNavVisible)
      console.log('[Wide 840px] isActionsVisible:', wide840Metrics.isActionsVisible)
      console.log('[Wide 840px] titleText:', wide840Metrics.titleText)

      if (wide840Metrics.isHamburgerVisible) {
        throw new Error('Hamburger should be HIDDEN at 840px (>= 840px)!')
      }
      if (!wide840Metrics.isHoverNavVisible || !wide840Metrics.isActionsVisible) {
        throw new Error('Default horizontal nav and actions should be VISIBLE at 840px (>= 840px)!')
      }
      if (wide840Metrics.titleText !== 'PolitikApp') {
        throw new Error(`Expected full title 'PolitikApp' at 840px, but got '${wide840Metrics.titleText}'!`)
      }

      console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!')
    })
  } finally {
    await server.close()
  }
}

run().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
