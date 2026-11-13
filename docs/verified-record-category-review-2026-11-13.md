# Verified-record category review — November 13, 2026

Reviewed all **60 visible published timeline records across 15 politician profiles**, plus **one published submission without a visible timeline entry**. No visible standalone accomplishments existed to categorize.

Applied **32 timeline category corrections** and **23 published-submission category corrections** in the existing Supabase database. The submission changes keep mirrored records consistent and categorize the additional domestic-worker bill. Correctly categorized records were retained.

The review used each stored summary, legislation title, structured action details and citation context. Categories describe the subject of the record; they do not establish that its factual claim, attribution or scoring action is correct. Existing labels Audit, Finance, Infrastructure, Healthcare and Education were retained where appropriate. Governance, Labor and Employment, Social Welfare, Environment and Agriculture were added where needed instead of forcing unrelated subjects into Audit or Finance. Both existing category selectors now include these labels.

## Verification and recovery

- A read-only dry run validated all 55 planned row updates and original update timestamps before writing.
- One guarded transaction updated only `category_tag`; database triggers refreshed `updated_at` normally.
- All 106 published timeline/submission rows were compared before/after. All other columns—including actions, amounts, structured details, summaries, source URLs, associations and publication/review state—remained identical.
- A new read-only database connection verified the committed snapshot.
- All 7 existing leaderboard scores and ranks were fetched again after commit and match the pre-change values.
- Frontend lint passed with zero errors and 31 existing warnings. The production build passed.
- No migrations, Flyway changes, Git commits, pushes or deployments were performed.

Full before/after row backups, the applied plan, verification results and a guarded rollback plan are saved in [the local backup directory](../tmp/verified-record-category-review/run-20261113T104806608251400Z/). Preserve this ignored local directory; it is not included in Git.

The rollback plan restores categories only if the affected rows still have the expected category and update timestamp, protecting later edits. Restoring categories would also produce normal new update timestamps. It has not been executed.

## Other record issues found

Category cleanup does not fix records whose action type, amount, politician association or source content is inconsistent. These were recorded below without changing WGI inputs. In particular:

- Some press-release/survey records are stored as `COA_FINDING` with amounts that their summaries do not substantiate.
- One clinical-training assistance record has `BUDGET_ALLOCATION` on its timeline but `COA_FINDING` on its linked submission, with a `flaggedAmount` field.
- One travel-tax bill title/citation is paired with a domestic-worker bill summary; its existing Finance category was retained because the content conflicts.
- Fifteen visible timeline entries reference submission IDs that do not exist. No missing submissions or links were created.
- One separately published domestic-worker bill lacks a visible timeline entry. Its category was corrected without creating a new timeline record.

## Record-by-record decisions

### Alan Peter S. Cayetano

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 1 · `2b32b50f-f817-4feb-8001-3feb8b341a59` | Audit | Infrastructure | Flood-control funding concerns physical infrastructure. |
| 2 · `f44d4903-0ab5-45f3-b555-67f27404d755` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 3 · `7f448684-f005-44df-9fd8-205306279baa` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 4 · `d6a874b7-4ed7-4f27-bbae-46d3df76c1e2` | Education | Education | Existing category matches the main subject of the stored summary and structured record. |
| 5 · `f2a5edcd-0814-49f7-85c9-f29a6c4af86e` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 6 · `e85fe882-60ae-4e18-8b15-5e9ce74fdc93` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 7 · `188c6c8b-b1d8-4d86-b1f5-cb147e336f21` | Infrastructure | Infrastructure | Existing category matches the main subject of the stored summary and structured record. |
| 8 · `9816e807-ddc1-44cb-b4cd-90ab6674ab3d` | Finance | Social Welfare | Assistance-to-Nationals fund supports distressed OFWs and emergency welfare assistance. |
| 61 · `4a3effbc-d1b9-40db-8b61-f08754038395` (submission only) | Finance | Labor and Employment | The Enhanced Batas Kasambahay bill concerns domestic-worker rights and employment benefits. |

Additional observations:

- Record 1: The referenced submission is missing from the database; no submission was created.
- Record 5: Legislation title and citation concern travel-tax abolition, but the summary describes a different domestic-worker bill. Kept Finance because classification is ambiguous; did not rewrite facts.
- Record 61: Published submission has no matching visible timeline entry; no timeline row was created.

### Christopher Lawrence T. Go

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 9 · `126c0c87-56ba-42c7-8c06-01e90a4d6aa4` | Audit | Governance | Only a legislative privilege-speech title is provided; Governance is the supported broad subject. |

Additional observations:

- Record 9: Attached to Christopher Go but the title names Francis Tolentino; COA_FINDING and flagged amount are unsupported by the summary. The referenced submission is missing from the database; no submission was created.

### Erwin T. Tulfo

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 10 · `8dbe5ac9-d5c3-425e-b0b7-d63b80f36a2c` | Audit | Governance | The summary concerns a senatorial election survey, not an audit. |

Additional observations:

- Record 10: Attached to Erwin Tulfo but the title names Lito Lapid; a survey is not evidence of a COA finding. The referenced submission is missing from the database; no submission was created.

### Ferdinand "Bongbong" Romualdez Marcos Jr.

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 11 · `3781ac5c-db19-41e2-985e-64d15dec809a` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 12 · `53dc2be5-70a4-4c11-b626-a687be36a3f4` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 13 · `7d37892e-dc30-4375-b050-0cea9bb0be74` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 14 · `c35b6b55-84b5-435e-a956-3d8122a5abdf` | Audit | Infrastructure | Irrigation construction is infrastructure. |
| 15 · `e69c30ff-136d-4533-b85b-5f5d153f99be` | Audit | Infrastructure | Bridge construction and road connectivity are infrastructure. |
| 16 · `339a39e9-193c-42fe-b152-2a7c58cac298` | Audit | Infrastructure | Resettlement roads, drainage and wastewater facilities are infrastructure. |
| 17 · `a3585378-bc86-411d-a01a-1100d2461b5e` | Audit | Education | The allocation funds education programs and school services. |
| 18 · `8a1b072a-adda-46b9-9859-6d286ac82463` | Audit | Infrastructure | Public works construction and maintenance are infrastructure. |
| 19 · `e90c07f4-3f00-407b-9959-4e001b51e71e` | Audit | Healthcare | The allocation supports healthcare and Universal Health Care. |

### Francis "Chiz" G. Escudero

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 20 · `764f71b8-eb09-4384-897d-7a9365dcf04e` | Audit | Finance | Land-lease investment policy concerns finance and investment. |
| 21 · `1fe1c800-a73a-4c6c-beb7-99fa975134ef` | Audit | Social Welfare | The headline concerns assistance for disaster victims. |
| 22 · `cd85d021-b15c-486e-85b1-11c2fc3802c0` | Audit | Governance | The headline concerns transparency and legislative governance alongside financial protection. |
| 23 · `7e798e15-808c-43c6-9411-06b5ad83dca8` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 24 · `ea28d67b-1f37-4a63-8a04-90aaae735d77` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |

Additional observations:

- Record 20: The source headline concerns investment policy, but the action is COA_FINDING with a flagged amount. The referenced submission is missing from the database; no submission was created.
- Record 21: The source headline concerns disaster assistance, but the action is COA_FINDING with a flagged amount. The referenced submission is missing from the database; no submission was created.
- Record 22: The source headline concerns enacted laws, but the action is COA_FINDING with a flagged amount. The referenced submission is missing from the database; no submission was created.
- Record 23: A flood-control investigation headline is not by itself a COA finding; this record duplicates the next source/summary with a different flagged amount. The referenced submission is missing from the database; no submission was created.
- Record 24: Duplicate source/summary of the preceding record with a different flagged amount; action classification needs a separate factual correction. The referenced submission is missing from the database; no submission was created.

### Francis "Kiko" Pangilinan

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 25 · `1e207328-f63f-4b6d-9581-fbb1ad474cf0` | Education | Governance | Citizenship/naturalization legislation concerns governance, not education. |

Additional observations:

- Record 25: The referenced submission is missing from the database; no submission was created.

### Imee R. Marcos

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 26 · `37a60a22-fae4-440f-bc1b-554198424d80` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 27 · `89ddeb54-50ca-42cb-b4c3-73c51abf4789` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 28 · `2bd66e79-d573-4070-8495-8ec64aa7d195` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 29 · `56cd88fe-c700-4df7-9745-3711300c9dd7` | Audit | Labor and Employment | The bill concerns minimum wages and worker protection. |
| 30 · `ccd6ea9d-18f9-421f-bbdd-200ae6a7dad5` | Audit | Governance | The bill concerns barangay officials and local governance. |
| 31 · `5267c360-de02-4ba3-925a-f8f9dd5e47bd` | Audit | Healthcare | The bill regulates nursing practice and healthcare standards. |

### Jinggoy Ejercito Estrada

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 32 · `92b9c3ad-91f1-4018-9410-6537cf02180c` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 33 · `6683b522-443e-43a1-916a-3ea37cc18bd6` | Audit | Audit | Existing category matches the main subject of the stored summary and structured record. |
| 34 · `e10bfd73-6af3-42d6-98c4-c814ba6775ff` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 35 · `38a1c244-f8b5-45d6-a7ea-90cb182c29bd` | Finance | Governance | The bill concerns public participation in lawmaking. |
| 36 · `1931968d-aeca-4e4c-9a48-a8fa2b212902` | Finance | Governance | The bill concerns government agency abolition and reorganization. |
| 37 · `ca272984-ba93-481f-ab32-e9c770573554` | Infrastructure | Infrastructure | Existing category matches the main subject of the stored summary and structured record. |
| 38 · `50956ebc-cd5d-4cd0-a180-b354855962bd` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 39 · `7a401789-0a0c-4574-946a-faa3d19bd90e` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |

### Panfilo "Ping" M. Lacson

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 40 · `1f156568-482d-4032-834d-d41eda54d22f` | Infrastructure | Audit | The record concerns accountability investigations and charges, not infrastructure delivery. |

Additional observations:

- Record 40: An Ombudsman/Blue Ribbon investigation is not automatically a COA finding or personal liability for the politician. The referenced submission is missing from the database; no submission was created.

### Paolo Benigno "Bam" Aquino IV

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 41 · `d6426aaf-2b76-4d60-b57a-a49e1d4e04fc` | Audit | Education | The law concerns free tertiary tuition and student financial assistance. |
| 42 · `c6442edd-1005-4c37-aad7-d328627c4226` | Audit | Governance | The bill regulates political dynasties and elected office. |
| 43 · `77028c6c-4702-4ae1-9358-1f2f3bb9f5b6` | Audit | Finance | The bill concerns debt restructuring and housing-loan condonation. |
| 44 · `76a79ac8-f841-49ea-bbcb-6ff79ca1016c` | Audit | Education | The allocation supports higher education tuition and student subsidies. |
| 45 · `3f3dced3-8435-4372-9b00-73dc998f4f24` | Audit | Education | Classroom funding primarily supports education. |
| 46 · `d5d8da19-e72a-4b45-bf35-5e0f067e0556` | Audit | Education | The program pays student clinical-training expenses, an education benefit. |

Additional observations:

- Record 46: Timeline action is BUDGET_ALLOCATION, linked submission action is COA_FINDING, and details contain flaggedAmount instead of allocationAmount. Categories only were changed.

### Pia S. Cayetano

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 47 · `a1c66af0-49b9-40fa-b29e-fca515963ea4` | Healthcare | Healthcare | Existing category matches the main subject of the stored summary and structured record. |
| 48 · `b7ac958d-11b2-4924-acdc-51a84144994b` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 49 · `55a34abe-314f-48f8-a663-71a63ae87756` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 50 · `26e310bb-114a-4464-9f38-4637afea6f9d` | Education | Education | Existing category matches the main subject of the stored summary and structured record. |
| 51 · `4a2ac59b-7673-4182-8869-cf7e8c4494c3` | Audit | Education | The allocation supports university institutional capacity and faculty/student programs. |
| 52 · `32666bd9-c18a-409c-880e-1d4fa4374489` | Education | Education | Existing category matches the main subject of the stored summary and structured record. |

### Risa Hontiveros

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 53 · `4570b18e-3613-4f83-afdf-9fc1fac1977a` | Finance | Finance | Existing category matches the main subject of the stored summary and structured record. |
| 54 · `da08d9b2-b557-415c-9c8d-2012e20e207d` | Education | Education | Existing category matches the main subject of the stored summary and structured record. |

Additional observations:

- Record 53: A Meralco consumer refund is stored as BUDGET_ALLOCATION; this label correction does not establish it is a government allocation. The referenced submission is missing from the database; no submission was created.
- Record 54: The referenced submission is missing from the database; no submission was created.

### Robinhood C. Padilla

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 55 · `9cb9fb62-62cd-459f-a910-fa37742ed888` | Audit | Labor and Employment | The bill proposes a minimum-wage increase for private-sector workers. |
| 56 · `c930877d-e28b-4365-b672-c60f83913b7e` | Finance | Governance | The resolution concerns constitutional amendments and constituent-assembly governance. |

Additional observations:

- Record 55: The referenced submission is missing from the database; no submission was created.
- Record 56: The referenced submission is missing from the database; no submission was created.

### Ronald "Bato" M. dela Rosa

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 57 · `6696e91c-6659-41b7-a480-12be0f065cf6` | Audit | Environment | The bill concerns tree planting, reforestation and climate mitigation. |
| 58 · `eaa8ed19-ccb6-436f-beda-91063dae3f73` | Audit | Social Welfare | The bill concerns disability income support and access to basic needs. |
| 59 · `be759544-79d7-451f-ae50-06161cfef091` | Audit | Agriculture | The bill supports farmers, fisherfolk and agricultural production. |

### Tomas de la Rama Osmeña

| Record | Previous category | Category after review | Basis |
| --- | --- | --- | --- |
| 60 · `6cc7f881-a27f-4f85-826c-366a291229af` | Education | Education | Existing category matches the main subject of the stored summary and structured record. |

Additional observations:

- Record 60: Summary only says Education; the cited photo-release title does not establish the described project or completion percentage. Existing category retained. The referenced submission is missing from the database; no submission was created.
