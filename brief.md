# Break Into Tech – SQL Pratice Playground - Project Brief

## Overview

This is the official development repository for the Break Into Tech SQL Practice Playground, a browser-based learning tool that allows students to:
- Generate fake but realistic SQL databases based on a topic or business type
- Write and run SQL queries directly in the browser (using sql.js)
- Receive AI-powered coaching help when their queries fail or when in help mode (via a separate Claude API)

The playground will be embedded into the Break Into Tech website via an iFrame at:  
**https://breakintotech.com/resources/sql-practice**

---

## 🧑‍💻 Roles

### 🎯 Himanshi Sheth – SQL Playground Developer
**Title:** Software Engineer – SQL Playground Dev

Himanshi is responsible for the core UI and backend logic of the playground, including:

1. **UI Development**  
   - Build a clean, responsive UI using React (or preferred framework)
   - Include:
     - Input prompt field
     - “Generate Dataset” button
     - Schema viewer panel
     - SQL code editor
     - Query results table
     - Error message panel

2. **Claude Integration via Cloudflare Worker**  
   - Send user prompt to Claude
   - Return schema + data (CREATE TABLE + INSERT statements)
   - Load the schema into sql.js

3. **Query Execution + Display**  
   - Use sql.js to execute queries in the browser
   - Display results or errors in real time

4. **Error Handling + Coaching Layer Handoff**  
   - Capture query errors
   - Send them (with query + schema) to Kate’s Cloudflare Worker for AI-based feedback

5. **Deployment**  
   - Deploy app to Cloudflare Pages at:
     `https://dev.breakintotech.com/api/sql-app`

---

### 🎯 Kate Cai – AI Coaching Layer Developer
**Title:** AI Systems Engineer – AI Coaching & App Integration Lead

Kate is responsible for building an AI-powered assistant that explains query errors in plain English and suggests fixes.

1. **Claude Coaching API (Cloudflare Worker)**  
   - Accepts query error, SQL schema, and user query
   - Crafts a prompt and sends it to Claude API
   - Returns explanation + hint to the frontend (via JSON)

2. **Frontend Support Logic (Layer Integration)**  
   - Builds the `coaching-response` endpoint
   - Ensures responses are properly formatted for Himanshi’s UI to display

3. **Collaboration + Testing**  
   - Work with Himanshi to ensure data passed to the API is clean
   - Suggest UI placements or formats for improved coaching delivery

---

## 🌐 Deployment Plan

| Component                | Owner      | Location                                                            |
|--------------------------|------------|---------------------------------------------------------------------|
| SQL Playground App       | Himanshi   | `https://dev.breakintotech.com/api/sql-app`                         |
| Claude SQL Gen Worker    | Himanshi   | `Cloudflare Worker endpoint`                                        |
| Claude Coaching Worker   | Kate       | `Cloudflare Worker at /api/coaching-response`                       |
| Web Embedding Page       | Charlotte  | `https://breakintotech.com/resources/sql-practice` (Webflow iFrame) |

---

## 🔐 Licensing & Attribution

- All code is licensed for personal/educational use only (see [LICENSE.txt](./LICENSE.txt))
- Himanshi and Kate will be credited in:
  - GitHub README
  - Public embedding page (`https://breakintotech.com/resources/sql-practice`)
