# PolitikApp Interface API Contract Specification

This document maps out the explicit REST routing vectors and expected JSON schemas managed by the backend controllers.

## 🧑‍💻 Module 1: Source-First Profile Aggregator Routing

### 1. Ingest Factual Evidence Record
* **HTTP Method:** `POST`
* **API Endpoint Path:** `/api/submissions`
* **Headers:** `Content-Type: application/json`
* **JSON Request Payload Body:**
  ```json
  {
    "politicianId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "contributorId": "f1e2d3c4-b5a6-7f8e-9d0c-1b2a3f4e5d6c",
    "sourceUrl": "https://www.coa.gov.ph/reports/audit-cebu-city",
    "categoryTag": "Audit",
    "actionIdentifier": "COA_FINDING",
    "quantitativeMetric": 2450000.00,
    "impactSummary": "The Commission on Audit noted missing logistical document clearing paths during the routine mid-year evaluation loop."
  }