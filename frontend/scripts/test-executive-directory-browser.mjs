import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'
import { formatDisplayName } from '../src/features/congress/displayName.js'

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Directory from '/src/pages/Politicians/Politicians.jsx';
import MobileDirectory from '/src/mobile/pages/MobilePoliticians.jsx';
import Profile from '/src/pages/Profile/Profile.jsx';
import MobileProfile from '/src/mobile/pages/MobileProfile.jsx';
import '/src/index.css';
import '/src/App.css';
const {politicians,directory,leaderboard,profiles,histories} = ${JSON.stringify(data)};
const mobile = location.search.includes('mobile');
const nativeFetch = window.fetch;
window.fetch = async (resource, options) => {
  const url = new URL(resource, location.href);
  if (!url.pathname.startsWith('/api/')) return nativeFetch(resource, options);
  const id = url.pathname.split('/')[3];
  const payload = url.pathname.endsWith('/directory-memberships') ? directory
    : url.pathname.endsWith('/leaderboard') ? leaderboard
    : url.pathname.endsWith('/congress-records') ? histories[id] || {memberships: [], records: [], total: 0}
    : url.pathname.endsWith('/citation-reviews') ? {records: []} : profiles[id] || [];
  return Response.json(payload);
};
function App() {
  const [id,setId] = useState(null);
  window.openProfile = setId;
  if (id) return mobile
    ? React.createElement(MobileProfile,{key:id,politicians,politicianId:id})
    : React.createElement(Profile,{key:id,politicians,politicianId:id,state:{status:'success',data:profiles[id]},
        section:'legislative-records',profileHref:section=>section,onSectionChange:()=>{}});
  const Page = mobile ? MobileDirectory : Directory;
  return React.createElement(Page,{politicians,politiciansState:{status:'success'},state:{},onViewProfile:setId});
}
createRoot(document.getElementById('root')).render(React.createElement(App));
`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'executive-directory-fixture',
    resolveId(id) { if (id === '/__executive.jsx') return '\0executive.jsx' },
    load(id) { if (id === '\0executive.jsx') return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__executive?')) return next()
        const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__executive.jsx"></script></body></html>'
        res.setHeader('Content-Type','text/html')
        res.end(await vite.transformIndexHtml(req.url, html))
      })
    },
  }],
})
try {
  await server.listen()
  const port = server.httpServer.address().port
  await withChrome(async ({ evaluate, until, click, input, navigate, call, sessionId }) => {
    for (const mobile of [false,true]) {
      await call('Emulation.setDeviceMetricsOverride',{width:mobile?390:1280,height:900,deviceScaleFactor:1,mobile},sessionId)
      await navigate(`http://127.0.0.1:${port}/__executive?${mobile ? 'mobile' : 'desktop'}`)
      const names = mobile ? '.mobileCard h3' : '.polName'
      await until(`typeof openProfile==='function' && document.querySelector('${names}')`)
      const setBranch = async value => {
        if (mobile) await evaluate('document.querySelector(\'[aria-label="Filter politicians"]\').click()')
        await input('Branch',value)
        if (mobile) await click('Apply Filters')
      }
      const listed = () => evaluate(`Array.from(document.querySelectorAll('${names}'),node=>node.textContent.trim())`)
      const setPosition = async value => {
        if (!mobile) return input('Position', value)
        await evaluate('document.querySelector(\'[aria-label="Filter politicians"]\').click()')
        await evaluate(`(() => {
          const label = [...document.querySelectorAll('label')].find(node => node.textContent.trim() === 'Position / Office');
          label.control.value = ${JSON.stringify(value)};
          label.control.dispatchEvent(new Event('change', { bubbles: true }));
        })()`)
        await click('Apply Filters')
      }
      const allCabinetNames = data.cabinet.map(id => formatDisplayName(data.profiles[id].fullName).name)
      await setBranch('LEGISLATIVE')
      assert.ok((await listed()).every(name => !allCabinetNames.includes(name)))
      await setBranch('EXECUTIVE')
      const executivePages = new Set()
      for (;;) {
        for (const name of await listed()) executivePages.add(name)
        if (!await evaluate('Boolean(document.querySelector(\'[aria-label="Next page"]:not(:disabled)\'))')) break
        await evaluate('document.querySelector(\'[aria-label="Next page"]\').click()')
      }
      assert.ok(allCabinetNames.every(name=>executivePages.has(name)), 'executive pagination exposes all 18')
      for (const id of data.cabinet) {
        const profile = data.profiles[id]
        await setPosition(profile.position)
        assert.deepEqual(await listed(),[formatDisplayName(profile.fullName).name],profile.position)
      }
      await setPosition('ALL')
      const search = mobile ? 'input[aria-label="Search politicians"]' : 'input[name="dashboardSearch"]'
      await evaluate(`(() => { const input = document.querySelector('${search}'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Balisacan'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`)
      await until(`document.querySelectorAll('${names}').length===1 && document.querySelector('${names}').textContent.includes('Balisacan')`)
      await evaluate(`document.querySelector('${names}').click()`)
      await until('document.querySelector(\'[aria-label="Sources listed in biography"] a\')')
      for (const id of data.cabinet) {
        await evaluate(`openProfile(${JSON.stringify(id)})`)
        const links = await evaluate('Array.from(document.querySelectorAll(\'[aria-label="Sources listed in biography"] a\'),a=>a.href)')
        assert.ok(links.length>0,id)
        for (const link of links) assert.ok(data.profiles[id].biography.includes(link),link)
        const profileText = await evaluate('document.body.innerText')
        assert.ok(profileText.includes('Unverified') && !profileText.includes(mobile ? '\nLegislation\n' : 'Legislative Records'),profileText.slice(0,200))
        const visibleLegislation = await evaluate(`Array.from(document.querySelectorAll('[role=tab],.prTabs a')).some(el=>/Legislat/.test(el.textContent))`)
        assert.equal(visibleLegislation,false,id)
      }
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: 18 profiles, position filters, executive paging, name search, citation links and legislative tab visibility passed`)
    }
  })
} finally {
  await server.close()
}
