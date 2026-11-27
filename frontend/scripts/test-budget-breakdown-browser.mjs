import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Profile from '/src/pages/Profile/Profile.jsx';
import MobileProfile from '/src/mobile/pages/MobileProfile.jsx';
import '/src/index.css';
import '/src/App.css';
const params = new URLSearchParams(location.search);
const profile = { politicianId: 'fixture', fullName: 'Budget Fixture', position: 'SENATOR', status: 'ACTIVE', trackedBudgetAllocated: 1000 };
const total = '2175024000.12345';
const allocations = [
  { recordId: 'largest', title: 'Classroom infrastructure', exactAmount: '2175000000.12345', fiscalYear: 2026,
    contributionPercentage: 99.9989, sourceOrganization: 'Department of Budget and Management',
    sourceUrl: 'https://dbm.gov.ph/fixture.pdf#page=1', verificationStatus: 'VERIFIED' },
  ...Array.from({length:24},(_,i)=>({ recordId:'other-'+i,title:'Local allocation '+i,exactAmount:'1000',
    contributionPercentage:0.0000459,sourceUrl:i===0?'javascript:alert(1)':null,verificationStatus:'UNVERIFIED' })),
];
const nativeFetch = window.fetch;
window.fetch = async (resource, options) => {
  const url = new URL(resource, location.href);
  if (!url.pathname.startsWith('/api/')) return nativeFetch(resource, options);
  if (url.pathname.endsWith('/budget-breakdown')) {
    if (params.has('empty')) return Response.json({exactTotal:'0',recordCount:0,allocations:[]});
    return Response.json({exactTotal:total,recordCount:allocations.length,allocations});
  }
  if (url.pathname.endsWith('/congress-records')) return Response.json({ records: [], memberships: [], total: 0 });
  return Response.json([]);
};
const props = { politicianId: profile.politicianId, politicians: [profile] };
const page = params.has('mobile') ? React.createElement(MobileProfile, props) : React.createElement(Profile, {
  ...props, state: { status: 'success', data: profile }, section: 'accountability',
  profileHref: section => section, onSectionChange: () => {},
});
createRoot(document.getElementById('root')).render(page);
`

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'budget-breakdown-fixture',
    resolveId(id) { if (id === '/__budget_fixture.js') return '\0budget-fixture.js' },
    load(id) { if (id === '\0budget-fixture.js') return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__budget_browser')) return next()
        const html = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__budget_fixture.js"></script></body></html>'
        res.setHeader('Content-Type', 'text/html')
        res.end(await vite.transformIndexHtml(req.url, html))
      })
    },
  }],
})

try {
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}/__budget_browser`
  await withChrome(async ({ call, sessionId, evaluate, until, navigate }) => {
    const card = 'document.querySelector(\'[data-indicator="trackedBudgetAllocated"]\')'
    for (const mobile of [false, true]) {
      await call('Emulation.setDeviceMetricsOverride', { width: mobile ? 320 : 1280, height: 640, deviceScaleFactor: 1, mobile }, sessionId)
      await navigate(`${base}?${mobile ? 'mobile' : 'desktop'}`)
      await until(`${card}?.innerText.includes('₱1K')`)
      const trigger = mobile ? '.budgetBreakdownAction' : 'button[aria-label="About Budget Tracked"]'
      await evaluate(`${card}.querySelector(${JSON.stringify(trigger)}).click()`)
      await until('document.querySelector(".budgetBreakdownSummary")?.innerText.includes("₱2,175,024,000.12345")')
      assert.ok(await evaluate(`${card}.innerText.includes('₱2.175B')`))
      assert.equal(await evaluate(`getComputedStyle(${card}.querySelector('.metricCurrency')).whiteSpace`), 'nowrap')
      assert.equal(await evaluate('document.querySelectorAll(".budgetBreakdownAllocations li").length'), 25)
      assert.ok(await evaluate('document.querySelector(".budgetBreakdownSummary").innerText.includes("25 contributing records")'))
      assert.ok(await evaluate(`document.querySelector(".budgetBreakdownAllocations li").innerText.includes('FY 2026')`))
      assert.equal(await evaluate('document.querySelector(".budgetAllocationBar span").style.width'), '99.9989%')
      assert.equal(await evaluate('document.querySelector(".budgetBreakdownAllocations a").href'), 'https://dbm.gov.ph/fixture.pdf#page=1')
      assert.equal(await evaluate('document.querySelectorAll(".budgetBreakdownAllocations a").length'), 1)
      assert.ok(await evaluate(`(() => {
        const modal = document.querySelector('.budgetBreakdownDialog');
        const body = modal.querySelector('.sharedModalBody');
        const edges = modal.getBoundingClientRect();
        return edges.left >= 0 && edges.right <= innerWidth && body.clientHeight < body.scrollHeight
          && body.clientWidth >= body.scrollWidth && getComputedStyle(body).overflowY === 'auto';
      })()`))
      await evaluate('document.querySelector(".budgetBreakdownDialog header button").click()')
      await until('!document.querySelector(".budgetBreakdownDialog")')
    }
    await navigate(`${base}?mobile&empty`)
    await until(`${card}?.querySelector('.budgetBreakdownAction')`)
    await evaluate(`${card}.querySelector('.budgetBreakdownAction').click()`)
    await until('document.querySelector(".budgetBreakdownDialog")?.innerText.includes("No eligible budget allocation records")')
    assert.ok(await evaluate('document.querySelector(".budgetBreakdownSummary").innerText.includes("₱0.00")'))
    console.log('Budget breakdown passed desktop and mobile discovery, exact values, source links, scrolling, and empty-state checks.')
  })
} finally {
  await server.close()
}
