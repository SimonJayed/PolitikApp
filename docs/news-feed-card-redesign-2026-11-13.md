# News feed card redesign

Implemented locally on November 13, 2026. No commits, pushes, merges, deployments, migrations, or production database writes were performed.

## Subsequent layout revision

The user subsequently supplied four Claude-generated component/style files and requested their layout. The current UI follows those files: image first, category and larger headline, two-line preview, pill-shaped summary toggle, animated inline expansion (respecting reduced-motion preferences), and a paragraph-based article reader. The separate takeaway panel described in the initial implementation below is no longer displayed. Backend extraction and stored key points remain available without database changes.

The supplied layout was adapted to preserve all reviewed text, keep a preview when its sentences overlap stored key points, and maintain action/comment padding within the new edge-to-edge card. Frontend tests and browser expectations were updated for this structure. The frontend suite still passes all 61 tests; lint has zero errors and the same 31 warnings, and the production build passes. Browser checks also pass for image-first placement, images and fallbacks, summary expansion, comments/votes/bookmarks, pagination/filtering and responsive layouts at 1280, 768, 390 and 320px.

## Card and reader changes

The dashboard now presents agency identity, publication date and administrator-review badge, category, headline, optional original-source image, key takeaways, a short preview, and the existing article/comment/source/bookmark actions in that order.

Collapsed cards show at most three concise takeaways and a three-line preview. Inline expansion shows the full reviewed summary and all available reviewed key points. The article reader uses the same image and takeaway components, includes source-author information, and puts the retrieved source text behind a disclosure. Existing related-politician navigation remains available.

Typography retains the existing fonts and navy/white/light-blue palette. Desktop headlines reach 26px, mobile headlines are 21px, body copy is 16px with 1.65 line height, and takeaways have their own light-blue panel. Padding, paragraph spacing, rounded media, and constrained text widths reduce density. No distracting animation was added.

## Images and persistence

The extractor reads original-source Open Graph/Twitter image metadata and article image elements. It accepts only HTTP(S) images on the original government hostname, with a source public-domain notice or a recognized CC BY, BY-SA, CC0 or public-domain-mark license. Unknown rights, external image hosts, restricted photo credits, logos, placeholders, and pages requesting no image indexing are skipped. HTTPS articles cannot introduce HTTP images.

A live Department of Agriculture article was inspected read-only: [DA source article](https://www.da.gov.ph/da-backs-hog-raisers-tariff-hike-bid-vows-immediate-relief/). Its HTML provides an original-source image, a public-domain notice, a separate byline/date block, and an inline AFID photo credit. Extraction preserves available attribution; administrators can see the image and credit in the existing source preview before publication. Source notices are evidence used by the filter, not a guarantee that every photograph is unrestricted; exceptions still require administrator review.

Images use a responsive 16:9 reserved area, rounded corners, lazy loading, asynchronous decoding, and original-source/rights links. Missing metadata produces an image-free card. Failed requests produce a branded placeholder with the same aspect ratio. No random, generated, or substitute article photograph is introduced.

Author and image metadata are stored under `sourceMetadata` inside the existing `news_articles.extraction_data` field introduced by V24. The AI processing/reset paths preserve this metadata and cannot replace it with model-provided metadata. Responses expose only the selected author/image fields publicly; private AI extraction evidence remains private.

**No new database migration is required.** Existing migration files and Flyway history were not changed. No image backfill or automatic rewriting of previously reviewed/published records was performed.

## Takeaways and extraction

The existing pipeline already stores structured AI key points. New AI prompts request two or three short, complete, distinct factual sentences and exclude bylines, publication metadata, repeated headings, boilerplate, and HTML. Existing administrator review and publication requirements remain in place.

The public frontend prefers reviewed structured key points. If none exist, it selects exact complete sentences from the reviewed summary and labels them as excerpts. It never calls an AI service or invents missing points. If fewer than two suitable sentences exist, it shows only the available supported points rather than manufacturing enough to fill the design. Long points remain available in the expanded view; collapsed points are not cut mid-sentence. Exact duplicate takeaway sentences are excluded from the short preview.

Bold emphasis is rendered as React text/strong nodes, including short reviewed emphasis and supported amounts, dates, percentages, and bill/act identifiers. HTML from article/model text is never interpreted.

New retrieval separates author/date metadata, removes matching repeated heading elements and common byline/share boilerplate, and moves the DA inline author/photo credit out of body text into attribution. Cleanup targets recognizable metadata patterns and preserves factual body text. The frontend also removes the recognizable leading author/date prefix from displayed older summaries without changing stored records or the government source document.

## Validation

| Check | Result |
| --- | --- |
| Full backend Maven suite using the test profile (H2; Flyway disabled) | 126 tests, 0 failures, 0 errors, 3 skipped |
| Frontend Node test suite | 61 passed |
| ESLint | 0 errors; 31 existing warnings |
| Vite production build | Passed; existing bundle-size/plugin-timing advisories remain |
| Browser integration using intercepted API/image fixtures | Passed at 1280, 768, 390 and 320px |
| Git whitespace check | Passed |

Backend coverage includes extraction, allowed/rejected images, metadata preservation, public response privacy, and the existing retrieval, AI, review and publication workflow tests. Browser checks cover valid/missing/broken images, reserved aspect ratio, lazy loading, safe emphasis, metadata separation, inline expansion and the reader, comment submission/voting, save/unsave, pagination, filtering and responsive overflow. Browser fixtures use an explicitly labeled test image; they do not post comments or other records to production.

Local verification commands:

```powershell
# backend directory; test resources select H2 and disable Flyway
.\mvnw.cmd -o '-Dmaven.repo.local=C:/Users/edz/.m2/repository' test

# frontend directory
npm.cmd test
npm.cmd run lint
npm.cmd run build
# Set CHROME_PATH to an installed Chromium/Chrome executable if needed.
npm.cmd run test:browser:news
```

## Files changed

Backend paths are relative to `backend/src/main/java/com/politikapp/backend/news/`:

- `dto/NewsDtos.java`: optional author/image response fields.
- `service/SourceTextExtractor.java`: image rights/metadata extraction and body cleanup.
- `service/GovernmentNewsRetrievalService.java`: persist extracted metadata on new drafts.
- `service/NewsSourceMetadata.java` (new): preserve trusted source metadata through AI processing.
- `service/NewsAiService.java`: concise-keypoint instructions and complete-sentence draft points.
- `service/AdminNewsService.java`: retain metadata when AI processing fails.
- `service/NewsMapper.java`: map safe optional image/author fields while preserving public extraction privacy.
- `backend/src/test/java/com/politikapp/backend/news/service/NewsPresentationTests.java` (from repository root; new): extraction, image and metadata tests.

Frontend paths are relative to `frontend/`:

- `src/components/NewsCardContent.jsx` and `.css` (new): shared card content, images, takeaways and responsive styling.
- `src/components/NewsArticleReader.jsx` and `.css` (CSS new): complete reviewed content and source disclosure.
- `src/pages/Dashboard/Dashboard.jsx`: integrate the new card body while preserving interaction handlers.
- `src/pages/AdminNews/AdminNews.jsx`: show source image/author in the administrator preview.
- `src/features/news/newsPresentation.js` and `.test.js` (new): deterministic reviewed-content presentation and tests.
- `scripts/test-news-cards-browser.mjs` (new): browser interaction/responsive checks.
- `scripts/browserHarness.mjs`: CDP event subscription support for fixture interception.
- `package.json`: register presentation tests and the news browser test command.

This report is `docs/news-feed-card-redesign-2026-11-13.md`.

## Remaining limitations

- Existing articles without stored image metadata remain image-free. Only future retrieval supplies these fields automatically; any backfill needs a separately authorized workflow.
- Sources without an acceptable reuse notice, external CDN images, inaccessible images, and PDF-only sources can remain image-free. There is no image proxy or image-file storage service.
- Old reviewed summaries with too few suitable complete sentences may show fewer than two takeaways. No existing reviewed summary is regenerated to meet a visual quota.
- The frontend changes appear when the development server rebuilds. The optional image/author API fields require the updated backend to be running. The backend was not restarted against the configured production database as part of this task.
- Browser interaction checks use isolated fixtures. They verify UI behavior without claiming a new end-to-end production publication or production database test.
