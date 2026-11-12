// Retry only public GET transport failures. Mutations and HTTP errors are not retried.
export async function fetchReadWithRetry(url, { signal, retryDelay = 1000 } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted()
    try {
      return await fetch(url, { signal })
    } catch (error) {
      if (signal?.aborted) throw signal.reason
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
