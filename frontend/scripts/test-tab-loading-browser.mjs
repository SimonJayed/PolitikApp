import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '/src/App.jsx';
import {AuthProvider} from '/src/auth/AuthContext.jsx';
import '/src/index.css';
localStorage.removeItem('politikapp_auth');
const politicians=Array.from({length:12},(_,i)=>({politicianId:'member-'+i,fullName:i===0?'President Fixture':'Senator '+String(i).padStart(2,'0'),position:i===0?'PRESIDENT':'SENATOR',jurisdiction:'NATIONAL',termStart:'2025-01-01',termEnd:'2031-01-01',status:'ACTIVE'}));
const post={id:'news-one',headline:'Cached government update',summary:'Published news fixture.',sourceName:'Official Source',category:'Legislation',publishedAt:'2026-11-12T00:00:00Z',keyPoints:[],commentCount:0};
window.requests=[];
window.fetch=async(input)=>{
 const url=new URL(input,location.href);window.requests.push(url.pathname+url.search);
 await new Promise(resolve=>setTimeout(resolve,400));
 let data={};
 if(url.pathname==='/api/politicians')data=politicians;
 else if(url.pathname.endsWith('/directory-memberships'))data={people:[],currentCongress:20,asOfDate:'2026-11-12'};
 else if(url.pathname.endsWith('/leaderboard'))data={entries:[{...politicians[3],rank:1,wgiCompositeScore:25}],totalRanked:1,unrankedCount:11,hasMore:false,calculatedAt:'2026-11-12T00:00:00Z'};
 else if(url.pathname==='/api/news')data={content:[post],totalPages:1,totalElements:1};
 else if(url.pathname.endsWith('/comments'))data=[];
 return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
};
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(App)));
`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'tab-loading-fixture',
    resolveId(id) { if (id === '/__tab_fixture.jsx') return '\0tab-fixture.jsx' },
    load(id) { if (id === '\0tab-fixture.jsx') return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__tab_browser')) return next()
        const html = await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__tab_fixture.jsx"></script></body></html>')
        res.setHeader('Content-Type', 'text/html'); res.end(html)
      })
    },
  }],
})
try {
  await server.listen()
  const port = server.httpServer.address().port
  await withChrome(async ({ evaluate, until, navigate }) => {
    await navigate(`http://127.0.0.1:${port}/__tab_browser?view=dashboard`)
    await until(`document.querySelector('.newsPost')?.innerText.includes('Cached government update')`)
    const switchTo = async label => evaluate(`new Promise(resolve=>{const start=performance.now();document.querySelector('nav[aria-label="Primary"] button[aria-label="${label}"]').click();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-start)))})`)
    await switchTo('Politicians')
    assert.equal(await evaluate(`document.querySelectorAll('.polName').length`), 9)
    assert.equal(await evaluate(`document.querySelectorAll('.polSkeletonCard').length`), 0)
    await until(`document.querySelector('.wgiFeatured')?.innerText.includes('Senator 03')`)
    const newsRequests = await evaluate(`requests.filter(url=>url.startsWith('/api/news')).length`)
    const dashboardMs = await switchTo('Dashboard')
    assert.ok(await evaluate(`document.querySelector('.newsPost')?.innerText.includes('Cached government update')`))
    assert.equal(await evaluate(`requests.filter(url=>url.startsWith('/api/news')).length`), newsRequests)
    const politiciansMs = await switchTo('Politicians')
    assert.equal(await evaluate(`document.querySelectorAll('.polName').length`), 9)
    assert.ok(await evaluate(`document.querySelector('.wgiFeatured')?.innerText.includes('Senator 03')`))
    assert.ok(await evaluate(`!document.querySelector('.wgiLeaderboard').innerText.includes('Loading')`))
    await switchTo('Compare')
    assert.equal(await evaluate(`document.querySelectorAll('.cmpCard').length`), 10)
    assert.ok(await evaluate(`document.querySelector('.cmpCard')?.innerText.includes('President Fixture')`))
    assert.equal(await evaluate(`requests.filter(url=>url==='/api/politicians/directory-memberships').length`), 1)
    assert.equal(await evaluate(`requests.filter(url=>url==='/api/politicians').length`), 1)
    console.log(`PASS: actual App navigation with 400ms simulated requests; cached Dashboard ${Math.round(dashboardMs)}ms, Politicians ${Math.round(politiciansMs)}ms; no repeat feed/profile/membership requests, immediate cards and WGI snapshot, shared Compare order.`)
  })
} finally { await server.close() }
