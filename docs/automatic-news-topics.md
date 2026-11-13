# Automatic news topics

News is assigned to Legislation, Government Projects, Public Spending, Audit Reports or Government Announcements without a separate category approval step or a classification badge.

`NewsTopics` is the shared classifier. It weighs subject signals in the headline above the summary and the first 1,500 characters of source text. Specific subjects break ties before general spending language. It avoids the former broad `act`, `coa` and `bill` substring matches, which could misclassify words such as factories, coastal and billion. Articles without a topic signal fall back to Government Announcements. This is deterministic categorization; it makes no additional AI requests.

New draft processing and administrator saves persist the computed category. Response mapping computes it for existing articles, so no published-record backfill or review reset is necessary. The public topic filter uses the same scoring expression in the database before pagination; labels, filter results, totals and pages therefore agree. Dashboard category-dependent counts also use that expression. Stored summaries, publication status and review history are not changed when reading or filtering articles.

The administrator form displays the topic as read-only. Article content still follows the existing review/publication workflow. Legacy clients may continue sending a category field, but it does not override automatic selection; the field is optional on review updates.

No schema migration is required. The updated backend must be running for existing articles to receive the computed response topics. No production database operation, deployment or backend restart is part of this change. Keyword-based classification can still need refinement for ambiguous articles; the rules are centralized rather than split across retrieval, mock processing and filtering.

Validation: full backend suite passed (128 tests, 3 skipped), followed by 9 passing focused tests after the final signal refinements. Coverage includes legacy labels, response/filter agreement, category pagination, unchanged stored review/publication data, retrieval/review/publication behavior and bounded query counts. Frontend lint passed with 31 existing warnings and no errors; the production build passed. All database tests use H2 with Flyway disabled.
