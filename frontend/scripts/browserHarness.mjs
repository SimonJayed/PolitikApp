import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Local, optional browser checks using Chrome's debugging protocol; no extra dependencies.
export async function withChrome(run) {
  if (!process.env.CHROME_PATH) throw new Error('Set CHROME_PATH to a local Chrome/Chromium executable.')
  const profile = await mkdtemp(path.join(tmpdir(), 'politikapp-wgi-browser-'))
  let browser, socket
  try {
    browser = spawn(process.env.CHROME_PATH, ['--headless=new', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    const address = await new Promise((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 20000)
      browser.on('error', reject)
      browser.stderr.on('data', chunk => {
        output += chunk.toString()
        const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
        if (match) { clearTimeout(timer); resolve(match[1]) }
      })
    })
    socket = new WebSocket(address)
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
    let next = 0
    const pending = new Map()
    socket.onmessage = event => {
      const message = JSON.parse(event.data)
      const handler = pending.get(message.id)
      if (handler) { pending.delete(message.id); message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result) }
    }
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true })
    await call('Page.enable', {}, sessionId)
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result.value
    }
    const until = async expression => {
      for (let i = 0; i < 150; i++) {
        if (await evaluate(`Boolean(${expression})`)) return
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error(`Browser condition timed out: ${expression}; page: ${await evaluate('document.body.innerText')}`)
    }
    const click = text => evaluate(`Array.from(document.querySelectorAll('button,summary')).find(el=>el.textContent.trim()===${JSON.stringify(text)}).click()`)
    const input = (label, value) => evaluate(`(()=>{const label=Array.from(document.querySelectorAll('label')).find(el=>el.firstChild.textContent.trim()===${JSON.stringify(label)});const el=label.querySelector('input,select');if(el.tagName==='SELECT'){el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));}else{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));}})()`)
    const navigate = url => call('Page.navigate', { url }, sessionId)
    await run({ call, sessionId, evaluate, until, click, input, navigate })
  } finally {
    socket?.close()
    if (browser && browser.exitCode === null) { browser.kill(); await new Promise(resolve => { browser.once('exit', resolve); setTimeout(resolve, 3000) }) }
    // Only the unique, absolute mkdtemp path inside the intended temp parent is removed.
    if (profile.startsWith(path.join(tmpdir(), 'politikapp-wgi-browser-'))) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}
