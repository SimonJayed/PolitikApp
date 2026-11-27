import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Profile from '/src/pages/Profile/Profile.jsx';
import MobileProfile from '/src/mobile/pages/MobileProfile.jsx';
import '/src/index.css';
import '/src/App.css';

const profile = {politicianId:'test-legislator',fullName:'Legislative Browser Fixture',position:'SENATOR',status:'ACTIVE'};
const common = {congress:20,chamber:'SENATE',verificationStatus:'VERIFIED',
  sourceOrganization:'Senate of the Philippines',sourceUrl:'https://legacy.senate.gov.ph/lisdata/fixture.pdf'};
let rows = [
  {record:{...common,recordId:'a',kind:'ATTENDANCE',reference:'Journal 1',decision:'PRESENT',eventDate:'2025-08-01'},revision:0},
  {record:{...common,recordId:'v',kind:'VOTE',title:'Fixture measure',reference:'HB 1, vote 1',decision:'ABSTAINED',eventDate:'2025-08-01'},revision:0},
  {record:{...common,recordId:'c',kind:'COMMITTEE',title:'Fixture committee',decision:'VICE_CHAIR'},revision:0},
];
const params = new URLSearchParams(location.search);
const isAdmin = params.has('admin');
window.confirm = () => true;
window.fixtureRequests = [];
const originalFetch = window.fetch;
window.fetch = async (request,options={}) => {
  const url = new URL(request,location.href);
  if (!url.pathname.startsWith('/api/')) return originalFetch(request,options);
  if (url.pathname.endsWith('/congress-records')) return Response.json({records:[],memberships:[],total:0});
  if (!url.pathname.includes('/legislative-accountability')) return Response.json([]);
  const admin = url.pathname.startsWith('/api/admin/');
  const method = options.method || 'GET';
  window.fixtureRequests.push({method,path:url.pathname,query:url.search});
  if (admin && options.headers.Authorization !== 'Bearer fixture-token') return Response.json({message:'Forbidden'},{status:403});
  if (method === 'POST' || method === 'PUT') {
    const input = JSON.parse(options.body);
    const id = method === 'POST' ? 'added' : url.pathname.split('/').at(-1);
    const {verificationNotes,revision,...record} = input;
    const item = {record:{...record,recordId:id},verificationNotes,revision:(revision ?? -1)+1};
    rows = [item,...rows.filter(row=>row.record.recordId!==id)];
    return Response.json(item,{status:method==='POST'?201:200});
  }
  if (method === 'DELETE') {
    const id = url.pathname.split('/').at(-1);
    rows = rows.map(row=>row.record.recordId===id?{...row,withdrawnAt:'2025-08-02',revision:row.revision+1}:row);
    return new Response(null,{status:204});
  }
  const kind=url.searchParams.get('kind'), congress=url.searchParams.get('congress'), chamber=url.searchParams.get('chamber');
  const results = rows.filter(({record,withdrawnAt}) => (!kind || record.kind===kind)
    && (!congress || String(record.congress)===congress) && (!chamber || record.chamber===chamber)
    && (admin || (!withdrawnAt && record.verificationStatus==='VERIFIED')));
  const offset = Number(url.searchParams.get('offset') || 0);
  const attendance = !admin && kind==='ATTENDANCE' && results.length ? [{chamber:'SENATE',congress:20,present:1,absent:1,excused:0,unavailable:0,percentage:50}] : [];
  return Response.json({available:true,records:admin?results:results.map(item=>item.record),attendance,hasMore:false,offset});
};
const props={politicianId:profile.politicianId,politicians:[profile],dbUser:isAdmin?{role:'ADMIN'}:null,token:isAdmin?'fixture-token':null};
const page = params.has('mobile') ? React.createElement(MobileProfile,props) : React.createElement(Profile,{
  ...props,state:{status:'success',data:profile},section:'legislative-records',profileHref:section=>section,onSectionChange:()=>{},
});
createRoot(document.getElementById('root')).render(page);
`

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'legislative-accountability-fixture',
    resolveId(id) { if (id === '/__legislative_fixture.js') return '\0legislative-fixture.js' },
    load(id) { if (id === '\0legislative-fixture.js') return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__legislative_browser')) return next()
        const html = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__legislative_fixture.js"></script></body></html>'
        res.setHeader('Content-Type', 'text/html')
        res.end(await vite.transformIndexHtml(req.url, html))
      })
    },
  }],
})

try {
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}/__legislative_browser`
  await withChrome(async ({ evaluate, until, navigate, call, sessionId }) => {
    const has = text => `document.querySelector('.legAccountability')?.innerText.includes(${JSON.stringify(text)})`
    const selectKind = kind => evaluate(`(() => {
      const control = document.querySelector('.legAccountabilityFilters select');
      control.value = ${JSON.stringify(kind)};
      control.dispatchEvent(new Event('change',{bubbles:true}));
    })()`)
    for (const mobile of [false, true]) {
      await call('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1280, height: 900, deviceScaleFactor: 1, mobile }, sessionId)
      await navigate(`${base}?${mobile ? 'mobile' : 'desktop'}`)
      if (mobile) {
        await until('document.getElementById("tab-legislation")')
        await evaluate('document.getElementById("tab-legislation").click()')
      }
      await until(has('50% attendance in recorded sessions'))
      assert.ok(await evaluate(has('Journal 1')))
      assert.ok(await evaluate('document.querySelector(".legAccountabilityRecords a").href.includes("legacy.senate.gov.ph")'))
      assert.ok(!await evaluate(has('Manage records')))
      await selectKind('VOTE')
      await until(has('Abstained'))
      await selectKind('COMMITTEE')
      await until(has('Vice-chairperson'))
      await evaluate(`(() => {
        const control = document.querySelector('.legAccountabilityFilters input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(control,'19');
        control.dispatchEvent(new Event('input',{bubbles:true}));
      })()`)
      await until(has('No verified committee assignments'))
    }

    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false},sessionId)
    await navigate(`${base}?admin`)
    const button = (label, scope = '.legAccountability') => evaluate(`
      [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(element=>element.textContent.trim()===${JSON.stringify(label)}).click()
    `)
    const field = (name, value) => evaluate(`(() => {
      const control = document.querySelector(${JSON.stringify(`[role=dialog] [name="${name}"]`)});
      const prototype = Object.getPrototypeOf(control);
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(control,${JSON.stringify(value)});
      control.dispatchEvent(new Event(control.tagName==='SELECT'?'change':'input',{bubbles:true}));
    })()`)
    await until(has('50% attendance'))
    await button('Manage records')
    await selectKind('VOTE')
    await until(has('Add record'))
    await button('Add record')
    await until('document.querySelector("form.legAccountabilityForm")')
    await field('congress','20')
    await field('title','Draft browser measure')
    await field('reference','HB 2, vote 1')
    await field('eventDate','2025-08-02')
    await field('decision','NO')
    await button('Save record','[role=dialog]')
    await until(has('Draft browser measure'))
    assert.ok(await evaluate(has('Pending verification')))
    await button('Edit record')
    await field('verificationStatus','VERIFIED')
    await field('sourceUrl','https://legacy.senate.gov.ph/lisdata/fixture.pdf')
    await field('verificationNotes','Test-only evidence note')
    await button('Save record','[role=dialog]')
    await until(has('Test-only evidence note'))
    await button('Withdraw record')
    await until(has('Withdrawn'))
    await button('View public records')
    await until(has('Fixture measure'))
    assert.ok(!await evaluate(has('Draft browser measure')))
    assert.deepEqual(await evaluate('fixtureRequests.filter(r=>r.method!=="GET").map(r=>r.method)'), ['POST','PUT','DELETE'])
    console.log('Desktop and mobile public views, filters, and administrator create, edit and withdrawal passed.')
  })
} finally {
  await server.close()
}
