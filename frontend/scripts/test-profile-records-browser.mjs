import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { withChrome } from './browserHarness.mjs'

const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Profile from '/src/pages/Profile/Profile.jsx';
import '/src/index.css';import '/src/App.css';
const bills=Array.from({length:9},(_,i)=>({key:'bill:'+i,type:'BILL',authorPoliticianId:'fixture',relationshipType:'AUTHORED_BY',title:'ACQUISITION OF RIGHT-OF-WAY',billNumber:String(2145+i),chamber:'senate',congress:i<6?'16':'19',filedDate:'2014-02-26',reportedStatus:'[{"date":"2014-03-01","status":"Consolidated/Substituted in the Committee Report"}]',history:[{date:'2014-02-26',action:'Introduced with the Senate'},{},{date:'2014-02-27',description:'Referred to the committee'}],sourceUrl:'https://legacy.senate.gov.ph/lis/bill_res.aspx?congress=16&q=SBN-'+(2145+i),datasetUrl:'https://github.com/bettergovph/open-congress-data/blob/commit/file.toml',reviewState:'SOURCE_REPORTED',originalSourceStatus:'UNCHECKED'}));
const memberships=[{chamber:'senate',congress:15},{chamber:'senate',congress:16},{chamber:'house',congress:9},{chamber:'house',congress:14}];
window.timeline=[{timelineId:'project',politicianId:'fixture',actionIdentifier:'PROJECT_COMPLETION',categoryTag:'Infrastructure',summary:'Road improvement completed.',actionDetails:{completionPercentage:75}},...Array.from({length:10},(_,i)=>({timelineId:'budget-'+i,politicianId:'fixture',actionIdentifier:'BUDGET_ALLOCATION',categoryTag:'Finance',summary:'Budget allocation number '+i,actionDetails:{allocationAmount:500000+i}})),{timelineId:'coa',politicianId:'fixture',actionIdentifier:'COA_FINDING',categoryTag:'Audit',summary:'Documented audit observation.',actionDetails:{flaggedAmount:125000}},{timelineId:'legislation',politicianId:'fixture',actionIdentifier:'SPONSORED_LEGISLATION',categoryTag:'Legislation',summary:'Preserved curated legislation',actionDetails:{legislationTitle:'Curated bill',dateFiled:'2024-01-01',legislativeStatus:'Filed'}},{timelineId:'membership',politicianId:'fixture',actionIdentifier:'CONGRESSIONAL_MEMBERSHIP',categoryTag:'Legislation',summary:'Imported source-reported membership',actionDetails:{sourceReported:true,recordType:'MEMBERSHIP'}}].map(row=>({...row,publicationStatus:'PUBLISHED',sourceUrl:'https://www.coa.gov.ph/record',isHidden:false}));
const awards=[{accomplishmentId:'award',politicianId:'fixture',title:'Public service award',description:'Documented accomplishment.',category:'Public service',accomplishmentYear:2025,sourceUrl:'https://www.dost.gov.ph/award',visible:true},{accomplishmentId:'hidden',title:'Hidden award',description:'Private',visible:false}];
const profile={politicianId:'fixture',fullName:'Profile Fixture',position:'SENATOR',jurisdiction:'NATIONAL',status:'ACTIVE',billsAuthored:1,wgiCompositeScore:5};
window.mutations=[];window.confirm=()=>true;
window.fetch=async(input,options={})=>{
const url=new URL(input,location.href);let data={};
if(url.pathname.endsWith('/congress-records')){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||5),congress=url.searchParams.get('congress');const rows=bills.filter(row=>!congress||congress==='ALL'||row.congress===congress);await new Promise(resolve=>setTimeout(resolve,25));data={records:rows.slice(offset,offset+limit).map((row,i)=>({...row,originalSourceStatus:url.searchParams.has('checkSources')?(i===1?'UNCONFIRMED':i===2?'UNAVAILABLE':'AVAILABLE'):'UNCHECKED'})),total:rows.length,offset,limit,memberships,congresses:['19','16']};}
else if(url.pathname.includes('/curation/metrics/')){window.mutations.push(options.method);const id=url.pathname.split('/').at(-1);if(options.method==='DELETE'){window.timeline=window.timeline.filter(row=>row.timelineId!==id);return new Response(null,{status:204});}const payload=JSON.parse(options.body);window.timeline=window.timeline.map(row=>row.timelineId===id?{...row,...payload,summary:payload.impactSummary,sourceUrl:payload.primarySourceUrl}:row);data=window.timeline.find(row=>row.timelineId===id);}
else if(url.pathname.endsWith('/accomplishments'))data=url.pathname.includes('/admin/')?awards:awards.filter(row=>row.visible);
else if(url.pathname.endsWith('/drafts')||url.pathname.endsWith('/pending-source-updates')||url.pathname.endsWith('/match-candidates'))data=[];
else if(url.pathname.includes('/open-congress/politicians/'))data=null;
return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
};
function Fixture(){const [admin,setAdmin]=useState(false);const [data,setData]=useState({...profile,publishedTimelineLedger:window.timeline});window.makeAdmin=()=>setAdmin(true);return React.createElement(Profile,{politicianId:'fixture',politicians:[profile],state:{status:'success',data},dbUser:admin?{role:'ADMIN'}:null,token:admin?'fixture-token':null,onReload:async()=>{setData({...profile,publishedTimelineLedger:window.timeline});return {ok:true}},onPoliticianUpdate:()=>{},onAddContribution:()=>{}})}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'profile-records-fixture',
    resolveId(id) { if (id === '/__profile_fixture.jsx') return '\0profile-fixture.jsx' },
    load(id) { if (id === '\0profile-fixture.jsx') return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__profile_browser')) return next()
        const html = await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__profile_fixture.jsx"></script></body></html>')
        res.setHeader('Content-Type', 'text/html'); res.end(html)
      })
    },
  }],
})
try {
  await server.listen()
  await withChrome(async ({ evaluate, until, input, click, navigate, call, sessionId }) => {
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId)
    const capture = async (selector, name) => {
      if (!process.env.PROFILE_SCREENSHOT_DIR) return
      const clip = await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(r.height,1200),scale:1}})()`)
      const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip }, sessionId)
      await writeFile(`${process.env.PROFILE_SCREENSHOT_DIR}/${name}.png`, Buffer.from(shot.data, 'base64'))
    }
    await navigate(`http://127.0.0.1:${server.httpServer.address().port}/__profile_browser`)
    await until(`document.querySelectorAll('.csCongressGroup .csRecord').length===5 && document.querySelectorAll('.accountabilityCard').length===9 && !document.querySelector('.csSection').innerText.includes('Checking original source')`)
    assert.ok(await evaluate(`document.querySelector('.csSection').innerText.includes('9 authored bills')`))
    assert.equal(await evaluate(`document.querySelectorAll('a[href*="github.com"]').length`), 0)
    assert.ok(await evaluate(`document.querySelector('.csMembershipSummary').innerText.includes('Senate: 15th and 16th Congresses')`))
    assert.ok(await evaluate(`document.querySelector('.csTitle').innerText.includes('SB 2145: Acquisition of Right-of-Way')`))
    await capture('.csSection', 'legislative-records-desktop')
    assert.ok(await evaluate(`document.querySelector('.csSection').innerText.includes('Original source unavailable')`))
    assert.ok(await evaluate(`Array.from(document.querySelectorAll('.csLinks a')).every(a=>a.target==='_blank'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')&&a.href.includes('congress=16&q='))`))
    await evaluate(`document.querySelector('.csHistory').open=true`)
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.csTimeline li')).filter(li=>!li.textContent.trim()).length`), 0)
    assert.ok(await evaluate(`document.querySelector('.csHistory').innerText.includes('Introduced with the Senate')`))
    await evaluate(`document.querySelector('[aria-label="Authored bill pagination"] [aria-label="Next page"]').click()`)
    await until(`document.querySelectorAll('.csCongressGroup .csRecord').length===4`)
    await evaluate(`const el=document.querySelector('.csCongressFilter select');el.value='19';el.dispatchEvent(new Event('change',{bubbles:true}))`)
    await until(`document.querySelectorAll('.csCongressGroup .csRecord').length===3`)
    assert.ok(await evaluate(`document.querySelector('.csSection').innerText.includes('3 authored bills')`))
    assert.ok(await evaluate(`!document.querySelector('[aria-label="Verified public records"]').innerText.includes('Preserved curated legislation')`))
    await input('Record type', 'COA_FINDING')
    await until(`document.querySelectorAll('.accountabilityCard').length===1`)
    assert.ok(await evaluate(`document.querySelector('.accountabilityCard').innerText.includes('₱125,000.00') && document.querySelector('.accountabilityCard').innerText.includes('does not by itself establish personal wrongdoing')`))
    await capture('[aria-label="Verified public records"]', 'verified-records-desktop')
    await input('Record type', 'PROJECT_COMPLETION')
    assert.ok(await evaluate(`document.querySelector('.accountabilityCard').innerText.includes('75% complete')`))
    await input('Record type', 'BUDGET_ALLOCATION')
    await until(`document.querySelectorAll('.accountabilityCard').length===9`)
    assert.ok(await evaluate(`document.querySelector('.accountabilityCard').innerText.includes('₱500,000.00')`))
    await evaluate(`document.querySelector('[aria-label="Record pagination"] [aria-label="Next page"]').click()`)
    await until(`document.querySelectorAll('.accountabilityCard').length===1`)
    await input('Record type', 'ACCOMPLISHMENT')
    await until(`document.querySelectorAll('.accountabilityCard').length===1 && document.querySelector('.accountabilityCard').innerText.includes('Public service award')`)
    assert.ok(await evaluate(`document.querySelector('.accountabilityCard').innerText.includes('2025')&&!document.body.innerText.includes('Hidden award')`))
    await input('Search verified records', 'no match')
    assert.equal(await evaluate(`document.querySelectorAll('.accountabilityCard').length`), 0)
    await input('Search verified records', '')
    await evaluate('window.makeAdmin()')
    await until(`document.querySelector('.prManage')`)
    await evaluate(`document.querySelector('.prManage').open=true`)
    await evaluate(`document.querySelector('[aria-label="Manage records pagination"] [aria-label="Next page"]').click()`)
    await until(`Array.from(document.querySelectorAll('.prManageRow')).some(row=>row.innerText.includes('Preserved curated legislation'))`)
    await evaluate(`Array.from(document.querySelectorAll('.prManageRow')).find(row=>row.innerText.includes('Preserved curated legislation')).querySelector('button').click()`)
    await until(`document.querySelector('[role=dialog]')`)
    await evaluate(`(()=>{const el=document.querySelector('[role=dialog] textarea[name=impactSummary]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Updated curated legislation remains managed');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await click('Publish verified record')
    await until(`!document.querySelector('[role=dialog]')`)
    assert.ok(await evaluate(`window.mutations.includes('PUT')`))
    await evaluate(`Array.from(document.querySelectorAll('.prManageRow')).find(row=>row.innerText.includes('Updated curated legislation')).querySelectorAll('button')[1].click()`)
    await until(`window.mutations.includes('DELETE')`)
    for (const width of [1280, 768, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 640 }, sessionId)
      assert.ok(await evaluate(`document.querySelector('.profilePage').scrollWidth<=document.querySelector('.profilePage').clientWidth+1`), `profile fits ${width}px`)
    }
    console.log('PASS: authored-only public layout, correct counts/pagination/Congress filter, compact memberships, no public dataset links, checked original links, nonempty histories, PHP/percent metrics, accomplishments/filter/search/pagination, preserved curated legislation admin edit/hide, responsive 1280/768/390/320px. API fixture only.')
  })
} finally { await server.close() }
