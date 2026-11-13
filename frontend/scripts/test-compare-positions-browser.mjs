import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Compare from '/src/pages/Compare/Compare.jsx';import '/src/index.css';
const people=[['p1','President One','PRESIDENT'],['p2','President Two','PRESIDENT'],['s1','Senator One','SENATOR'],['s2','Senator Two','SENATOR'],['s3','Senator Three','SENATE'],['h1','House One','HOUSE_REPRESENTATIVE'],['h2','House Two','REPRESENTATIVE'],['v1','Vice President','VICE_PRESIDENT']].map(([politicianId,fullName,position])=>({politicianId,fullName,position,jurisdiction:'NATIONAL',status:'ACTIVE'}));
window.fetch=async()=>new Response(JSON.stringify({people:[],currentCongress:20,asOfDate:'2026-11-13'}),{headers:{'content-type':'application/json'}});
function Fixture(){const[ids,setIds]=useState({idA:'',idB:''});window.ids=ids;window.forceIds=setIds;window.submits=window.submits||0;return React.createElement(Compare,{compareIds:ids,onChange:setIds,onSubmit:async event=>{event.preventDefault();window.submits++;return {ok:false}},politicians:people,politiciansState:{status:'success'},state:{status:'idle'}})}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'compare-position-fixture', resolveId(id) { if (id === '/__compare_positions.jsx') return '\0compare-positions.jsx' },
    load(id) { if (id === '\0compare-positions.jsx') return fixture }, configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__compare_positions_browser')) return next()
        res.setHeader('content-type', 'text/html')
        res.end(await vite.transformIndexHtml(req.url, '<html><body><div id="root"></div><script type="module" src="/__compare_positions.jsx"></script></body></html>'))
      })
    } }],
})
try {
  await server.listen()
  await withChrome(async ({ navigate, evaluate, until, click }) => {
    await navigate(`http://127.0.0.1:${server.httpServer.address().port}/__compare_positions_browser`)
    await until(`document.querySelectorAll('.cmpCard').length>0`)
    const choose = async (side, name) => evaluate(`Array.from(document.querySelectorAll('.cmpColumn.${side} .cmpCard')).find(el=>el.querySelector('strong').textContent===${JSON.stringify(name)}).click()`)
    // Select B first: either column can establish the allowed office.
    await choose('right', 'President One')
    await until(`ids.idB==='p1'&&document.querySelectorAll('.cmpColumn.left .cmpCard').length===2`)
    assert.equal(await evaluate(`document.querySelectorAll('.cmpColumn.left .cmpCard:disabled').length`), 1)
    await choose('left', 'President Two')
    await until(`!document.querySelector('.cmpSubmit').disabled`)
    await click('Compare selected')
    assert.equal(await evaluate('submits'), 1)
    await click('Clear selections')
    await until(`!ids.idA&&!ids.idB`)
    await choose('left', 'Senator One')
    await until(`document.querySelectorAll('.cmpColumn.right .cmpCard').length===3`)
    assert.ok(await evaluate(`!document.querySelector('.cmpColumn.right').innerText.includes('House One')&&!document.querySelector('.cmpColumn.right').innerText.includes('President One')`))
    await choose('right', 'Senator Two')
    await evaluate(`document.querySelector('[aria-label="Clear candidate A"]').click()`)
    assert.equal(await evaluate(`document.querySelectorAll('.cmpColumn.left .cmpCard').length`), 3)
    await click('Clear selections')
    await until(`!ids.idA&&!ids.idB`)
    // Search keeps House candidates reachable regardless of initial pagination.
    await evaluate(`(()=>{const el=document.querySelector('input[name=candidateSearch]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'House');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await until(`document.querySelectorAll('.cmpColumn.left .cmpCard').length===2`)
    await choose('left', 'House One')
    await choose('right', 'House Two')
    await until(`!document.querySelector('.cmpSubmit').disabled`)
    // Restored/external mixed selections must not be submittable.
    await evaluate(`forceIds({idA:'s1',idB:'h1'})`)
    await until(`document.querySelector('.cmpSubmit').disabled`)
    await evaluate(`document.querySelector('form.cmpBar').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`)
    assert.equal(await evaluate('submits'), 1)
    console.log('PASS: first selection on either side locks the office; senator, House aliases and president pairs; duplicate prevention; clearing, search and stale mixed-position submission guard. Fixtures only.')
  })
} finally { await server.close() }
