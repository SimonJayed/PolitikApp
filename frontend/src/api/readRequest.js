// Retry only public GET transport failures. Mutations and HTTP errors are not retried.
export async function fetchReadWithRetry(url, { signal, headers, retryDelay = 1000 } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted()
    try {
      const requestTimeout = AbortSignal.timeout(8000)
      const requestSignal = signal ? AbortSignal.any([signal, requestTimeout]) : requestTimeout
      return await fetch(url, { signal: requestSignal, headers })
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error.name === 'TimeoutError') throw new Error('The server took too long to respond. Please try again.', { cause: error })
      if (error.name !== 'TypeError') throw error
      if (attempt === 2) {
        throw new Error('Unable to reach the backend. Check that it is running, then select Retry.', { cause: error })
      }
      await new Promise((resolve, reject) => {
        const finish = () => { signal?.removeEventListener('abort', abort); resolve() }
        const timer = setTimeout(finish, retryDelay * (attempt + 1))
        const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal.reason) }
        signal?.addEventListener('abort', abort, { once: true })
        if (signal?.aborted) abort()
      })
    }
  }
}
