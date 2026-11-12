// Optional real-browser workflow check. Uses a local API fixture, never Supabase.
// CHROME_PATH must point to a Chromium/Chrome executable. No added dependencies.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const chrome = process.env.CHROME_PATH
if (!chrome) throw new Error('Set CHROME_PATH to a local Chromium/Chrome executable.')
const root = fileURLToPath(new URL('../', import.meta.url))
const profile = await mkdtemp(path.join(tmpdir(), 'politikapp-accomplishments-'))
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Profile from '/src/pages/Profile/Profile.jsx';
import '/src/index.css';
const isAdmin = new URLSearchParams(location.search).get('role') === 'admin';
window.fixtureCalls = [];
window.fetch = async (input, options = {}) => {
  const url = new URL(input, location.origin);
  const method = options.method || 'GET';
  if (url.pathname.includes('/accomplishments')) {
    window.fixtureCalls.push({method, path: url.pathname});
    const admin = url.pathname.includes('/api/admin/');
    if (admin && options.headers?.Authorization !== 'Bearer test-admin') return new Response(JSON.stringify({message:'Forbidden'}), {status:403});
    let rows = JSON.parse(localStorage.getItem('accomplishment-fixture') || '[]');
    let result;
    if (method === 'POST') {
      result = {...JSON.parse(options.body), accomplishmentId: crypto.randomUUID(), politicianId:'test-politician'};
      rows.unshift(result);
    } else if (method === 'PUT') {
      const id = url.pathname.split('/').at(-1);
      result = {...JSON.parse(options.body), accomplishmentId:id, politicianId:'test-politician'};
      rows = rows.map(row => row.accomplishmentId === id ? result : row);
    } else if (method === 'DELETE') {
      const id = url.pathname.split('/').at(-1);
      rows = rows.map(row => row.accomplishmentId === id ? {...row, visible:false} : row);
    } else result = admin ? rows : rows.filter(row => row.visible);
    localStorage.setItem('accomplishment-fixture', JSON.stringify(rows));
    await new Promise(resolve => setTimeout(resolve, 60));
    return method === 'DELETE' ? new Response(null,{status:204}) : new Response(JSON.stringify(result),{status:method==='POST'?201:200,headers:{'content-type':'application/json'}});
  }
  const result = url.pathname.endsWith('/congress-records') ? {records:[],memberships:[],total:0,offset:0,limit:5}
    : url.pathname.endsWith('/configuration') ? {enabled:false} : [];
  return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
};
const politician = {politicianId:'test-politician',fullName:'Workflow Test Politician',position:'Mayor',jurisdiction:'Cebu',biography:'Existing biography remains visible.',publishedTimelineLedger:[]};
createRoot(document.getElementById('root')).render(React.createElement(Profile, {politicianId:politician.politicianId, politicians:[politician], state:{status:'success',data:politician}, dbUser:isAdmin ? {role:'ADMIN'} : null, token:isAdmin?'test-admin':null}));
`
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'accomplishments-browser-fixture',
    resolveId(id) { if (id === '/__accomplishments_fixture.jsx') return '\0accomplishments-fixture.jsx' },
    load(id) { if (id === '\0accomplishments-fixture.jsx') return fixture },
    configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/__accomplishments_browser')) {
        const html = await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__accomplishments_fixture.jsx"></script></body></html>')
        res.setHeader('Content-Type','text/html'); res.end(html)
      } else next()
    })
  } }],
})
let browser
let socket
try {
  await server.listen()
  const port = server.httpServer.address().port
  // stdout carries only the local debugging address; no credentials or remote services are used.
  browser = spawn(chrome, ['--headless=new','--no-first-run','--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {windowsHide:true,stdio:['ignore','ignore','pipe']})
  const address = await new Promise((resolve,reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error('Chrome did not start within 20 seconds')),20000)
    browser.on('error',reject)
    browser.stderr.on('data', data => {
      output += data.toString(); const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) {clearTimeout(timeout);resolve(match[1])}
    })
  })
  socket = new WebSocket(address)
  await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject})
  let nextId = 0
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (pending.has(message.id)) {
      const {resolve,reject} = pending.get(message.id); pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result)
    }
  }
  const call = (method, params = {}, sessionId) => new Promise((resolve,reject) => {
    const id = ++nextId; pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,sessionId}))
  })
  const {targetId} = await call('Target.createTarget',{url:'about:blank'})
  const {sessionId} = await call('Target.attachToTarget',{targetId,flatten:true})
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId)
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const until = async expression => {
    for (let i=0;i<100;i++) {if(await evaluate(expression)) return; await new Promise(resolve=>setTimeout(resolve,100))}
    throw new Error(`Browser condition timed out: ${expression}; page: ${await evaluate('document.body.innerText')}`)
  }
  const navigate = async role => {
    await call('Page.navigate',{url:`http://127.0.0.1:${port}/__accomplishments_browser?role=${role}`},sessionId)
    await until(`document.querySelector('.accomplishmentsSection') && !document.querySelector('.accomplishmentsSection').innerText.includes('Loading accomplishments')`)
  }
  const click = text => evaluate(`Array.from(document.querySelectorAll('button,summary')).find(el=>el.textContent.trim()===${JSON.stringify(text)}).click()`)
  const input = async (label,value) => {
    await evaluate(`(()=>{const label=Array.from(document.querySelectorAll('label')).find(el=>el.firstChild.textContent.trim()===${JSON.stringify(label)}); const input=label.querySelector('input,textarea,select'); input.focus(); if(input.tagName==='SELECT'){input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));}else{Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));}})()`)
  }
  await navigate('guest')
  assert.ok(await evaluate(`document.querySelector('.accomplishmentsSection').innerText.includes('No accomplishments are currently available')`))
  assert.ok(await evaluate(`!document.querySelector('.accomplishmentsSection button')`))
  await navigate('admin')
  await click('Add accomplishment')
  await input('Title','Public service award')
  await input('Description','Documented public service accomplishment.')
  await input('Date precision','year')
  await input('Accomplishment year','2025')
  await input('Supporting source URL','https://www.dost.gov.ph/award')
  await evaluate(`(()=>{const form=document.querySelector('[role="dialog"] form'); form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()`)
  await until(`!document.querySelector('[role="dialog"]')`)
  assert.equal(await evaluate(`fixtureCalls.filter(call=>call.method==='POST').length`),1)
  await click('Manage accomplishments (1)')
  await click('Edit accomplishment')
  await input('Title','Updated service award')
  await click('Save accomplishment')
  await until(`!document.querySelector('[role="dialog"]')`)
  await navigate('guest')
  assert.ok(await evaluate(`document.querySelector('.accomplishmentsSection').innerText.includes('Updated service award')`))
  assert.equal(await evaluate(`document.querySelector('.accomplishmentsSection a').href`),'https://www.dost.gov.ph/award')
  assert.ok(await evaluate(`document.body.innerText.includes('Existing biography remains visible.')`))
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sessionId)
  assert.ok(await evaluate(`document.querySelector('.accomplishmentsSection').getBoundingClientRect().width <= innerWidth`))
  await navigate('admin')
  await click('Manage accomplishments (1)')
  await evaluate('window.confirm=()=>true')
  await click('Hide accomplishment')
  await until(`document.querySelector('.accomplishmentManagement').innerText.includes('Hidden')`)
  assert.ok(await evaluate(`document.querySelector('.accomplishmentManagement').innerText.includes('Updated service award')`))
  await navigate('guest')
  assert.ok(await evaluate(`document.querySelector('.accomplishmentsSection').innerText.includes('No accomplishments are currently available')`))
  assert.ok(await evaluate(`!document.querySelector('.accomplishmentsSection').innerText.includes('Updated service award')`))
  console.log('PASS: actual profile mounts; guest empty state; admin create/edit/hide; duplicate submit protection; public citation and visibility; mobile section width; existing biography retained. API fixture only.')
} finally {
  socket?.close()
  if (browser && browser.exitCode === null) {
    browser.kill()
    await new Promise(resolve => {browser.once('exit',resolve);setTimeout(resolve,3000)})
  }
  await server.close()
  // The path is a unique directory created above inside the system temporary directory.
  if (profile.startsWith(path.join(tmpdir(),'politikapp-accomplishments-'))) await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})
}
