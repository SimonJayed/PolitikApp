import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';
import Dashboard from '/src/pages/Dashboard/Dashboard.jsx';import {AuthProvider} from '/src/auth/AuthContext.jsx';
import '/src/index.css';import '/src/App.css';
const token='fixture.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600}))+'.signature';
localStorage.setItem('politikapp_auth',JSON.stringify({token,user:{userId:'fixture-user',fullName:'Test User',role:'CONTRIBUTOR'}}));
const base={sourceName:'Government Agency · Test Fixture',sourceUrl:'https://www.da.gov.ph/fixture-article',category:'Public Spending',status:'PUBLISHED',adminVerified:true,aiProcessingStatus:'COMPLETED',sourceAuthor:'Test Press Office',originalPublishedAt:'2026-11-13T01:00:00Z',publishedAt:'2026-11-13T01:30:00Z',commentCount:1,saved:false,relatedPoliticians:[],extraction:{},originalContent:'Original source text remains available separately from the reviewed summary.'};
const summary='Author: DA Press Office | 25 October 2026 The program allocates PHP 50 million for local services. Applications open on November 1. Residents can review the application requirements on the agency website. The agency will publish the final schedule after reviewing applications.';
const image={url:'https://www.da.gov.ph/__news-fixture-valid.svg',alt:'API test fixture image',attribution:'Test fixture illustration — not an official article photograph',license:'Source website public-domain notice (test fixture)',sourceUrl:base.sourceUrl};
const posts=[{...base,id:'one',headline:'Agency announces support program for local communities',summary,keyPoints:['The program allocates PHP 50 million for local services.','Applications open on November 1.','Residents can review the application requirements on the agency website.','The text <img src=x onerror="window.injected=true"> is displayed safely.'],image},
{...base,id:'two',headline:'An image-free update with reviewed summary excerpts',summary:'The agency will publish the program requirements. Residents may submit applications through the official portal. The deadline will be announced after review.',keyPoints:[],image:null},
{...base,id:'three',headline:'An unavailable source photograph keeps its layout',summary,keyPoints:['The program allocates PHP 50 million for local services.','Applications open on November 1.'],image:{...image,url:'https://www.da.gov.ph/__news-fixture-broken.jpg'}}];
let comments=[{id:'comment-one',authorLabel:'Anonymous',content:'A fixture comment.',createdAt:'2026-11-13T01:00:00Z',upvotes:0,downvotes:0,voted:false,voteType:null}];window.actions=[];
const actualNow=Date.now.bind(Date);let clockOffset=0;Date.now=()=>actualNow()+clockOffset;
const actualInterval=window.setInterval.bind(window);window.setInterval=(callback,ms,...args)=>{if(ms===60000)window.tickComments=callback;return actualInterval(callback,ms,...args)};
window.advanceComments=()=>{clockOffset+=60000;window.tickComments()};window.holdActions=false;window.releases=[];window.holdReader=false;
window.holdComments=true;window.commentReleases=[];
window.fetch=async(input,options={})=>{const url=new URL(input,location.href);const method=options.method||'GET';let data={};window.actions.push({path:url.pathname,method,query:url.search});
if(window.holdComments&&method==='GET'&&url.pathname.endsWith('/comments'))await new Promise(resolve=>window.commentReleases.push(resolve));
if((window.holdActions&&method!=='GET')||(window.holdReader&&/^\\/api\\/news\\/[^/]+$/.test(url.pathname)))await new Promise(resolve=>window.releases.push(resolve));
if(url.pathname==='/api/news/summary')data={legislativeRecordsTracked:2,recentGovernmentUpdates:3,activeCitizenDiscussions:1};
else if(url.pathname==='/api/news'){const page=Number(url.searchParams.get('page')||0),q=url.searchParams.get('q')||'',category=url.searchParams.get('category');const rows=posts.filter(p=>(!q||p.headline.toLowerCase().includes(q.toLowerCase()))&&(!category||p.category===category));data={content:page?[{...posts[1],id:'page-two',headline:'Second page update'}]:rows,totalElements:4,totalPages:2};}
else if(url.pathname.endsWith('/comments')){if(method==='POST'){const comment={...comments[0],id:'comment-new',content:JSON.parse(options.body).content};comments=[comment,...comments];data=comment;}else data=comments;}
else if(url.pathname.includes('/api/comments/')){const id=url.pathname.split('/')[3],type=JSON.parse(options.body).voteType,current=comments.find(c=>c.id===id),removing=current.voteType===type;data={...current,voted:!removing,voteType:removing?null:type,upvotes:!removing&&type==='UP'?1:0,downvotes:!removing&&type==='DOWN'?1:0};comments=comments.map(c=>c.id===id?data:c);}
else if(url.pathname.endsWith('/save'))return new Response(null,{status:204});
else if(url.pathname.startsWith('/api/news/'))data=posts.find(p=>p.id===url.pathname.split('/').at(-1))||posts[0];
return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});};
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(Dashboard,{politicians:[],user:{role:'CONTRIBUTOR'}})));
`
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'news-cards-fixture', resolveId(id) { if (id === '/__news_cards.jsx') return '\0news-cards.jsx' },
    load(id) { if (id === '\0news-cards.jsx') return fixture }, configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__news_cards_browser')) return next()
        const html = await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__news_cards.jsx"></script></body></html>')
        res.setHeader('content-type', 'text/html'); res.end(html)
      })
    } }],
})
try {
  await server.listen()
  await withChrome(async ({ call, sessionId, onEvent, navigate, until, evaluate, click }) => {
    const errors = []
    onEvent('Fetch.requestPaused', async (event, eventSession) => {
      try {
        const broken = event.request.url.includes('broken')
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#dce9f7"/><rect x="80" y="80" width="1440" height="740" rx="30" fill="#14365c"/><text x="800" y="460" fill="white" text-anchor="middle" font-size="60" font-family="sans-serif">API TEST FIXTURE IMAGE</text></svg>'
        await call('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: broken ? 404 : 200,
          responseHeaders: [{ name: 'Content-Type', value: broken ? 'text/plain' : 'image/svg+xml' }], body: Buffer.from(broken ? '' : svg).toString('base64') }, eventSession)
      } catch (error) { errors.push(error.message) }
    })
    await call('Fetch.enable', { patterns: [{ urlPattern: 'https://www.da.gov.ph/__news-fixture-*' }] }, sessionId)
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId)
    await navigate(`http://127.0.0.1:${server.httpServer.address().port}/__news_cards_browser`)
    await until(`document.querySelectorAll('.newsPost:not(.skeleton)').length===3 && document.querySelector('.articleImage img')?.naturalWidth>0`)
    await until(`document.querySelectorAll('.articleImageFallback').length===1`)
    assert.equal(await evaluate(`document.querySelectorAll('.newsPost')[1].querySelectorAll('.articleImage').length`), 0)
    assert.ok(await evaluate(`document.querySelector('.newsPost').innerText.includes('Admin reviewed')`))
    assert.ok(await evaluate(`!document.querySelector('.newsPost .postBody').innerText.includes('Author:')`))
    assert.equal(await evaluate(`document.querySelectorAll('.newsTakeaways').length`), 0)
    assert.ok(await evaluate(`document.querySelector('.newsPost .newsPreview strong').textContent==='PHP 50 million'`))
    assert.ok(await evaluate(`document.querySelector('.newsPost .articleImage').compareDocumentPosition(document.querySelector('.newsPost h2')) & Node.DOCUMENT_POSITION_FOLLOWING`))
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('.newsPost h2')).fontSize==='29px'`))
    assert.ok(await evaluate(`getComputedStyle(document.querySelector('.newsPreview')).webkitLineClamp==='2'`))
    assert.ok(await evaluate(`(()=>{const cards=[...document.querySelectorAll('.newsPost')];const first=getComputedStyle(cards[0]);return cards.every(card=>{const style=getComputedStyle(card);return style.padding===first.padding&&style.gap===first.gap&&getComputedStyle(card.querySelector('.postBody')).padding===getComputedStyle(cards[0].querySelector('.postBody')).padding})})()`), 'featured and regular cards have the same spacing')
    const ratio = await evaluate(`(()=>{const r=document.querySelector('.articleImage img').getBoundingClientRect();return r.width/r.height})()`)
    assert.ok(Math.abs(ratio - 16 / 9) < .02)
    if (process.env.NEWS_SCREENSHOT) {
      const r = await evaluate(`(()=>{const r=document.querySelector('.newsPost').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`)
      const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: r }, sessionId)
      await writeFile(process.env.NEWS_SCREENSHOT, Buffer.from(shot.data, 'base64'))
    }
    await evaluate(`document.querySelector('.newsPost .readMore').click()`)
    await until(`document.querySelector('.newsReviewedSummary.open')`)
    assert.ok(await evaluate(`document.querySelector('.newsReviewedSummary .summaryText').textContent.includes('The agency will publish the final schedule')`))
    assert.ok(await evaluate(`!window.injected && document.querySelectorAll('.summaryText img').length===0`))
    await click('Show less')
    assert.equal(await evaluate(`document.querySelector('.newsReviewedSummary').getAttribute('aria-hidden')`), 'true')
    await evaluate(`window.holdReader=true;document.querySelector('.newsPost .postActions button').click()`)
    await until(`document.querySelector('.newsArticleReader .readerSummary')`)
    assert.equal(await evaluate(`document.querySelectorAll('.articleReaderSkeleton').length`), 0)
    await until(`window.releases.length===1`)
    await evaluate(`window.holdReader=false;window.releases.shift()()`)
    assert.equal(await evaluate(`document.querySelectorAll('.newsArticleReader .newsTakeaways').length`), 0)
    assert.ok(await evaluate(`!document.querySelector('.readerOriginal').open && document.querySelector('.readerSummary').textContent.includes('The agency will publish the final schedule')`))
    await click('Close article')
    const readerRequests = await evaluate(`actions.filter(action=>action.path==='/api/news/one').length`)
    await evaluate(`document.querySelector('.newsPost .postActions button').click()`)
    await until(`document.querySelector('.newsArticleReader .readerSummary')`)
    assert.equal(await evaluate(`actions.filter(action=>action.path==='/api/news/one').length`), readerRequests)
    await click('Close article')
    await evaluate(`window.holdActions=true;document.querySelector('.newsPost [aria-label="Save update"]').click()`)
    await until(`document.querySelector('.newsPost [aria-label="Unsave update"]')`)
    assert.ok(await evaluate(`!document.querySelector('.newsPost [aria-label="Unsave update"]').disabled&&getComputedStyle(document.querySelector('.saveIconButton.saved svg')).animationName==='newsActionPop'`))
    await until(`window.releases.length===1`)
    await evaluate(`window.holdActions=false;window.releases.shift()()`)
    await evaluate(`document.querySelector('.newsPost [aria-label="Unsave update"]').click()`)
    await until(`document.querySelector('.newsPost [aria-label="Save update"]')`)
    await evaluate(`Array.from(document.querySelector('.newsPost').querySelectorAll('button')).find(b=>b.innerText.includes('1 comment')).click()`)
    await until(`document.querySelector('.commentPanel input[aria-label="Write a comment"]')`)
    assert.equal(await evaluate(`document.querySelectorAll('.commentSkeleton').length`), 0)
    assert.equal(await evaluate(`document.querySelectorAll('.commentRow').length`), 0)
    await until(`commentReleases.length===3`)
    await evaluate(`holdComments=false;commentReleases.splice(0).forEach(resolve=>resolve())`)
    await until(`document.querySelector('.commentRow')`)
    const commentReads = await evaluate(`actions.filter(action=>action.method==='GET'&&action.path.endsWith('/comments')).length`)
    await evaluate(`document.querySelector('.newsPost .postActions [aria-expanded]').click()`)
    await until(`!document.querySelector('.commentPanel')`)
    await evaluate(`document.querySelector('.newsPost .postActions [aria-expanded]').click()`)
    await until(`document.querySelector('.commentRow')`)
    assert.equal(await evaluate(`actions.filter(action=>action.method==='GET'&&action.path.endsWith('/comments')).length`), commentReads)
    await evaluate(`(()=>{const el=document.querySelector('input[aria-label="Write a comment"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'A new fixture comment.');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await click('Post')
    await until(`document.querySelectorAll('.commentRow').length===2`)
    assert.equal(await evaluate(`document.querySelector('.commentRow time').textContent`), '0s')
    await evaluate(`window.advanceComments()`)
    await until(`document.querySelector('.commentRow time').textContent==='1m ago'`)
    await evaluate(`window.holdActions=true;document.querySelector('.commentRow [aria-label="Upvote"]').click()`)
    await until(`document.querySelector('.commentRow [aria-label="Upvote"]').innerText.includes('1')`)
    assert.ok(await evaluate(`document.querySelector('.commentRow .voteUp').getAttribute('aria-pressed')==='true'&&!document.querySelector('.commentRow .voteUp').disabled&&getComputedStyle(document.querySelector('.commentRow .voteUp svg')).animationName==='newsActionPop'`))
    await until(`window.releases.length===1`)
    await evaluate(`window.holdActions=false;window.releases.shift()()`)
    await evaluate(`document.querySelector('.commentRow [aria-label="Upvote"]').click()`)
    await until(`document.querySelector('.commentRow .voteUp').getAttribute('aria-pressed')==='false'`)
    await evaluate(`document.querySelector('.commentRow [aria-label="Downvote"]').click()`)
    await until(`document.querySelector('.commentRow .voteDown').getAttribute('aria-pressed')==='true'`)
    await evaluate(`document.querySelector('[aria-label="News pagination"] [aria-label="Next page"]').click()`)
    await until(`document.querySelector('.newsPost h2')?.innerText==='Second page update'`)
    await evaluate(`document.querySelector('[aria-label="News pagination"] [aria-label="Previous page"]').click()`)
    await until(`document.querySelectorAll('.newsPost:not(.skeleton)').length===3`)
    await click('Audit Reports')
    await until(`document.querySelector('.feedNotice')?.innerText.includes('No updates match')`)
    await click('Clear filters')
    await until(`document.querySelectorAll('.newsPost:not(.skeleton)').length===3`)
    for (const width of [1280, 768, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 640 }, sessionId)
      assert.ok(await evaluate(`Array.from(document.querySelectorAll('.newsPost')).every(el=>el.scrollWidth<=el.clientWidth+1)`), `news cards fit ${width}px`)
      assert.ok(await evaluate(`getComputedStyle(document.querySelector('.newsPost')).padding===getComputedStyle(document.querySelectorAll('.newsPost')[1]).padding`), `same featured padding at ${width}px`)
    }
    assert.deepEqual(errors, [])
    assert.ok(await evaluate(`actions.some(a=>a.method==='POST'&&a.path.endsWith('/comments'))&&actions.some(a=>a.path.endsWith('/vote'))&&actions.some(a=>a.method==='DELETE'&&a.path.endsWith('/save'))`))
    console.log('PASS: image-first layout, image fallbacks, safe summaries, immediate/cached reader, optimistic bookmark/vote counts and pop animations before responses, new-comment 0s and minute updates, pagination/filtering, responsive 1280/768/390/320px. Fixtures only; no production writes.')
  })
} finally { await server.close() }
