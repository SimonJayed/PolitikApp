# PolitikApp AI Core Engineering Instructions

# SYSTEM CONTEXT: PolitikApp Core Purpose & Architecture

## 🎯 What is the System?
PolitikApp is a responsive web application built for the Philippine political landscape. Its core mission is to centralize and cross-reference factual, evidence-based political records through crowdsourced public contributions and an asynchronous community moderation pipeline. It acts as a transparent, public accountability dashboard.

## 👥 Core System Actors & Target Users
1. **Contributor:** An authenticated public user who submits factual updates or historical records regarding an official. They must provide a valid government source URL (`.gov.ph` or `.edu.ph`) for every submission.
2. **Peer Reviewer (The Jury):** A trusted community moderator who audits pending submissions in a double-blind, anonymous interface. They vote to Agree, Disagree, or Flag for Revision.
3. **System Administrator:** A high-level administrative user who steps in to resolve deadlocked votes or system timeout escalations.

## 🧩 Structural Module Map
* **Module 1 (Source-First Profile Aggregator):** Manages public-facing politician dashboards, dynamic performance metrics (KPIs), and the ingestion form for new evidence submissions.
* **Module 2 (Asynchronous Judicial Moderation Engine):** Handles the double-blind community voting queues, consensus calculations, and automated deadlock escalation loops.
* **Module 3 (Reputation-Based Trust Architecture):** Evaluates user track records behind the scenes to automatically apply platform penalties (lockouts) or reward highly accurate moderators with accelerated voting power.

## 🛑 CRITICAL MANDATE
Before generating any code, files, or modifications for this project, you MUST scan, read, and cross-reference all markdown files located in the `/docs` folder. You must treat those files as absolute constraints. Never hallucinate variables, endpoints, or rules that contradict them.

## 🚧 STRICT SCOPE ISOLATION AND CONTAINMENT RULE
1. **Never build ahead:** You are strictly forbidden from writing code, stubs, or data schemas for multiple modules or use cases at once. 
2. **One Feature, One File:** You must operate strictly on a micro-level. Focus exclusively on the single file, specific method, or single use case requested by the user in the current prompt.
3. **Bypass Downstream Logic:** If a feature you are writing relies on a downstream module that hasn't been built yet (e.g., a Module 1 controller needing Module 3's permission variable), do not switch files to build Module 3. Use a clear, documented mock placeholder variable or throw a temporary `UnsupportedOperationException` until instructed to build that specific module layer.

## 📁 Workspace Directory Map & Context Roles
You must reference the files in the `/docs` directory according to their specific functional roles:

1. **`CODING_PRINCIPLES.md` (Syntax & Network Configuration)**
   * Reference this for indentation scales (2 spaces for React, 4 spaces for Java Frameworks), naming conventions (PascalCase components, snake_case database variables), and local sleepover Wi-Fi network cross-origin adjustments (`@CrossOrigin(origins = "*")`).
2. **`DATABASE_SCHEMA.md` (The Persistent Data Layer)**
   * Reference this for the exact entity fields, data types, and primary/foreign key connections for the tables. Never drop or rename columns.
3. **`API_SPECIFICATION.md` (The Network Contract)**
   * Reference this to align frontend fetch/axios payload fields with backend controller path definitions. Ensure JSON transport schemas match end-to-end perfectly.
4. **`TESTING_CRITERIA.md` (Business Constraints & Rule Thresholds)**
   * Reference this for structural limits, including the 15% contributor error account lockout, the 90% peer accuracy vote weight acceleration ($vote\_weight = 5$), and the 24-hour scheduler daemon timeout loop rules.

## 🎯 Code Generation Strategy (60% Vertical Slice)
* Prioritize establishing end-to-end data pipeline functionality over exhaustive edge-case handling.
* Ensure all database columns required for a transaction (such as `contributor_id`) are explicitly declared and handled.
* Write defensive validation filters at the controller level; check constraints immediately and abort transactions early using accurate HTTP error status payloads (e.g., 422 Unprocessable Entity) if inputs fail criteria matches.

## ⚙️ How to Acknowledge
When the user prompts you or references this workspace context, confirm that you have read the four core documents in `/docs` and are ready to generate compliant, zero-duplicate code according to our engineering guidelines under the Strict Scope Isolation rule.