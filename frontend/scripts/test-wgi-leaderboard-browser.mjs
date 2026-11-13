import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Politicians from '/src/pages/Politicians/Politicians.jsx';
import '/src/index.css';
import '/src/App.css';
const mode=new URLSearchParams(location.search).get('mode')||'data';
const politicians=Array.from({length:40},(_,i)=>({politicianId:'member-'+i,fullName:'Directory Member '+String(i).padStart(2,'0'),position:'SENATOR',jurisdiction:'NATIONAL',termStart:'2025-01-01',termEnd:'2031-01-01',status:'ACTIVE'}));
const rankings=politicians.slice(0,32).map((person,i)=>({...person,rank:i+1,wgiCompositeScore:i<2?90:90-i,sourceUpdatedAt:'2026-11-01T12:00:00Z'}));
window.activeRankings=mode==='empty'?[]:mode==='zero'?rankings.slice(0,1).map(p=>({...p,wgiCompositeScore:0})):mode==='fallback'?rankings.slice(10,11).map(p=>({...p,rank:1})):rankings;
const originalInterval=window.setInterval.bind(window);
window.setInterval=(callback,delay,...args)=>{if(delay===15000)window.pollLeaderboard=callback;return originalInterval(callback,delay,...args)};
window.leaderboardCalls=[];window.failLeaderboard=mode==='error';window.failMore=mode==='moreError';
window.releaseReads=[];window.readsReleased=false;
window.fetch=async(input,options={})=>{
 const url=new URL(input,location.href);
 if(mode==='slow'&&!window.readsReleased)await new Promise(resolve=>window.releaseReads.push(resolve));
 if(url.pathname.endsWith('/leaderboard')){
  window.leaderboardCalls.push(url.search);
  const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||6);
  await new Promise(resolve=>setTimeout(resolve,40));
  if(window.failLeaderboard||(window.failMore&&(offset>0||limit>6)))return new Response(JSON.stringify({message:'Fixture API unavailable'}),{status:503,headers:{'content-type':'application/json'}});
  const rows=window.activeRankings;
  return new Response(JSON.stringify({entries:rows.slice(offset,offset+limit),totalRanked:rows.length,unrankedCount:40-rows.length,offset,limit,hasMore:offset+limit<rows.length,calculatedAt:'2026-11-12T13:00:00Z'}),{headers:{'content-type':'application/json'}});
 }
 return new Response(JSON.stringify({people:[],currentCongress:20,asOfDate:'2026-11-12'}),{headers:{'content-type':'application/json'}});
};
createRoot(document.getElementById('root')).render(React.createElement(Politicians,{politicians,politiciansState:{status:'success'},state:{},onViewProfile:id=>{window.selectedPolitician=id}}));
`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'wgi-browser-fixture',
    resolveId(id) { if (id === '/__wgi_fixture.jsx') return '\0wgi-fixture.jsx' },
    load(id) { if (id === '\0wgi-fixture.jsx') return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__wgi_browser')) return next()
        const html = await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__wgi_fixture.jsx"></script></body></html>')
        res.setHeader('Content-Type', 'text/html'); res.end(html)
      })
    },
  }],
})
try {
  await server.listen()
  const port = server.httpServer.address().port
  await withChrome(async ({ evaluate, until, click, input, navigate, call, sessionId }) => {
    const open = async mode => {
      await navigate(`http://127.0.0.1:${port}/__wgi_browser?mode=${mode}`)
      await until(`document.querySelector('.wgiLeaderboard') && Array.from(document.querySelectorAll('.wgiFootnote')).some(el=>el.innerText.includes('scored profile')) && !document.querySelector('.polSkeletonCard')`)
    }
    await navigate(`http://127.0.0.1:${port}/__wgi_browser?mode=slow`)
    await until(`document.querySelectorAll('.polName').length===9&&document.querySelectorAll('.wgiFeatured').length===3`)
    assert.equal(await evaluate(`document.querySelectorAll('.polSkeletonCard').length`), 0)
    assert.ok(await evaluate(`!document.querySelector('.wgiLeaderboard').innerText.includes('Loading')&&document.querySelector('.wgiFeatured').innerText.includes('Not ranked')`))
    await until(`window.releaseReads.length===2`)
    await evaluate(`window.readsReleased=true;window.releaseReads.splice(0).forEach(resolve=>resolve())`)
    await until(`document.querySelector('.wgiFeatured').innerText.includes('Rank 1')`)
    await open('data')
    assert.equal(await evaluate(`document.querySelectorAll('.wgiFeatured').length`), 3)
    assert.equal(await evaluate(`document.querySelectorAll('.wgiListRow').length`), 3)
    assert.ok(await evaluate(`Boolean(document.querySelector('.wgiLeaderboard').compareDocumentPosition(document.querySelector('.polBrowseHeading')) & Node.DOCUMENT_POSITION_FOLLOWING)`))
    await evaluate(`document.querySelector('.wgiFeatured').click()`)
    assert.equal(await evaluate('window.selectedPolitician'), 'member-0')
    await input('Search', 'Directory Member 2')
    await input('Position', 'SENATOR')
    await evaluate(`document.querySelector('.polPagination [aria-label="Next page"]').click()`)
    await until(`document.querySelector('.polPagination .paginationText').textContent.includes('2 /')`)
    const snapshot = () => evaluate(`JSON.stringify({search:document.querySelector('input[name=dashboardSearch]').value,position:document.querySelector('select[name=dashboardPosition]').value,page:document.querySelector('.polPagination .paginationText').textContent,names:Array.from(document.querySelectorAll('.polName')).map(el=>el.textContent)})`)
    const directoryBefore = await snapshot()
    assert.equal(await evaluate('leaderboardCalls.length'), 1)
    await click('View Full Leaderboard')
    await until(`document.querySelectorAll('.wgiListRow').length===23`)
    assert.equal(await snapshot(), directoryBefore)
    await click('Show More')
    await until(`document.querySelectorAll('.wgiListRow').length===37`)
    await click('Collapse leaderboard')
    assert.equal(await evaluate(`document.querySelectorAll('.wgiListRow').length`), 3)
    assert.equal(await snapshot(), directoryBefore)
    await click('How are scores calculated?')
    await until(`document.querySelector('[role=dialog]')`)
    assert.ok(await evaluate(`document.querySelector('[role=dialog]').innerText.includes('not an official World Bank rating')`))
    assert.ok(await evaluate(`!document.querySelector('.wgiCalculationDetails').open&&document.querySelector('[role=dialog]').innerText.includes('lower attainable maximum')`))
    await click('Got it')
    await evaluate(`document.querySelector('[aria-label="About the score scale"]').focus()`)
    await until(`document.querySelector('[role=tooltip]')`)
    assert.ok(await evaluate(`document.querySelector('[role=tooltip]').innerText.includes('100')`))
    await evaluate(`document.querySelector('[aria-label="About the score scale"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
    await until(`!document.querySelector('[role=tooltip]')`)
    for (const width of [1280, 768, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 640 }, sessionId)
      assert.ok(await evaluate(`document.querySelector('.wgiLeaderboard').scrollWidth <= document.querySelector('.wgiLeaderboard').clientWidth+1`), `no horizontal overflow at ${width}px`)
      await evaluate(`document.querySelector('[aria-label="About zero and missing scores"]').focus()`)
      await until(`document.querySelector('[role=tooltip]')`)
      assert.ok(await evaluate(`(()=>{const r=document.querySelector('[role=tooltip]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`), `tooltip fits ${width}px`)
      await evaluate(`document.querySelector('[aria-label="About zero and missing scores"]').blur()`)
    }
    await open('empty')
    assert.equal(await evaluate(`document.querySelectorAll('.wgiFeatured').length`), 3)
    assert.ok(await evaluate(`document.querySelector('.wgiFeatured').innerText.includes('Not ranked')`))
    assert.ok(await evaluate(`document.querySelector('.wgiFeatured .wgiScore').innerText.includes('Not yet scored')`))
    await open('zero')
    assert.equal(await evaluate(`document.querySelector('.wgiFeatured .wgiScore strong').textContent`), '0.0')
    assert.ok(await evaluate(`document.querySelector('.wgiFeatured .wgiScore').innerText.includes('WGI Score')&&document.querySelectorAll('.wgiFeatured')[1].innerText.includes('Not yet scored')`))
    await open('fallback')
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId)
    if (process.env.WGI_SCREENSHOT) {
      const screenshot = await call('Page.captureScreenshot', { format: 'png' }, sessionId)
      await writeFile(process.env.WGI_SCREENSHOT, Buffer.from(screenshot.data, 'base64'))
    }
    assert.ok(await evaluate(`document.querySelector('.wgiFeatured').innerText.includes('Directory Member 10')`))
    assert.ok(await evaluate(`document.querySelectorAll('.wgiFeatured')[1].innerText.includes('Directory Member 00')`))
    const beforeLive = await snapshot()
    await evaluate(`window.activeRankings=[{...window.activeRankings[0],politicianId:'member-20',fullName:'Newly Scored Member',rank:1,wgiCompositeScore:99},{...window.activeRankings[0],rank:2}];window.pollLeaderboard()`)
    await until(`document.querySelector('.wgiFeatured').innerText.includes('Newly Scored Member')`)
    assert.ok(await evaluate(`document.querySelectorAll('.wgiFeatured')[1].innerText.includes('Directory Member 10')`))
    assert.equal(await snapshot(), beforeLive)
    await evaluate(`window.failLeaderboard=true;window.dispatchEvent(new Event('focus'))`)
    await until(`document.querySelector('.wgiLeaderboard [role=alert]')`)
    assert.ok(await evaluate(`document.querySelector('.wgiFeatured').innerText.includes('Newly Scored Member')`))
    await evaluate(`window.failLeaderboard=false;window.dispatchEvent(new Event('online'))`)
    await until(`!document.querySelector('.wgiLeaderboard [role=alert]')`)
    await open('error')
    assert.ok(await evaluate(`document.querySelector('.wgiLeaderboard [role=alert]') !== null`))
    assert.equal(await evaluate(`document.querySelectorAll('.polName').length`), 9)
    await evaluate('window.failLeaderboard=false')
    await click('Retry leaderboard')
    await until(`document.querySelectorAll('.wgiFeatured').length===3`)
    await open('moreError')
    await click('View Full Leaderboard')
    await until(`document.querySelector('.wgiLeaderboard [role=alert]')`)
    assert.equal(await evaluate(`document.querySelectorAll('.wgiFeatured').length`), 3)
    await evaluate('window.failMore=false')
    await click('Retry leaderboard')
    await until(`document.querySelectorAll('.wgiListRow').length===23`)
    console.log('PASS: compact layout, scored-first/default fallbacks, no invented scores, live polling reorders without reload, focus/reconnect updates, failed updates retain scores, expand/collapse, independent directory state, methodology, retries and responsive widths. API fixture only.')
  })
} finally { await server.close() }
