# Faster public tab navigation

Dashboard, Politicians, and Compare reuse successful reads in bounded, memory-only caches. Entries are reused for 60 seconds; older entries render immediately while a background request refreshes them. A failed refresh preserves the last successful result. Concurrent readers share requests, including requests that finish after a page unmounts. Nothing is persisted across browser reloads.

Congress directory metadata is prefetched alongside the initial politician list and shared by Politicians and Compare. Both pages retain the same ordering helper. Directory retries bypass the freshness window.

Returning to Dashboard no longer reloads the full politician list within 60 seconds. Later refreshes keep existing cards visible. News summary, chart data, and filtered feed pages are cached separately. Authenticated news caches are scoped to the current token, so saved/vote flags are never shared with another session. Comment/save updates preserve the current feed and chart changes and discard other cached filtered pages.

The WGI leaderboard renders its last successful snapshot immediately on return, revalidates it in the background, and retains its existing 15-second visible-page update schedule. It does not infer scores from directory numeric defaults.

First visits, browser reloads, uncached searches, and backend cold starts still require network time. No backend, database, migration, deployment, or persistent browser-storage changes were made.

Validation: 50 frontend tests passed, including request deduplication, freshness, failed refresh preservation, bounded storage, and authentication scoping. Production build and lint passed (31 existing warnings). A headless Chrome fixture exercising actual App navigation with 400 ms delayed API responses measured approximately 53 ms for cached Dashboard and 42 ms for cached Politicians; no repeat feed/profile/membership requests occurred. These are local fixture timings, not production benchmarks. The browser check also verified immediate WGI snapshots and shared Compare ordering.

Optional local browser command: set `CHROME_PATH`, then run `npm.cmd run test:browser:tabs` from `frontend`.
