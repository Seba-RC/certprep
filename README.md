# CertPrep

A practice-exam platform for certifications and course exams, built to run on AWS for close to nothing. It ships with two banks:

* **Google Cloud Associate Cloud Engineer (ACE)**: 261 questions in English (details below).
* **Sistemas Distribuidos (Taller de Ciencia de Redes, ICIIT · UDD)**: 170 questions in Spanish (`bank-src/sd-udd/`), written from the exam syllabus (60 questions, 120 min) and the Unidad 1–2 slides. It covers POSIX C (fork, pipes, signals), TCP sockets, Raft, consistency and replication, message queues, logical clocks, distributed storage and patterns, with sections weighted like the syllabus (25/13/13/12/17/5/8/7). The mock exam is 60 questions in 120 minutes.

The ACE bank has **261 questions**. Every answer option has its own feedback, the questions map to the ACE exam guide that took effect on June 30, 2026, and they're spread across the four sections in the same proportions as the real exam.

> **About the questions:** these are original, exam-style questions written against Google's public exam guide. Google keeps real exam questions confidential under its certification agreement, and sites that claim to have "real questions" are publishing leaked dumps, so none of those were used. The questions copy the real exam's format: scenario-based "what should you do?" items, single and multiple select, and "Choose two" questions.

## What you get

| Feature | Details |
|---|---|
| **Practice mode** | Choose sections, a filter (all, unanswered, wrong last time, flagged) and a count. After each answer you see whether you were right and **feedback for every option**, plus a one-line key takeaway and doc links. |
| **Live score counter** | Right and wrong counts plus a running percentage on every question. |
| **Mock exam** | 50 questions in 120 minutes, drawn by the exam-guide weights (20/30/30/20 gives 10/15/15/10). Includes a countdown, question navigator, mark for review, a review screen before submitting, and auto-submit when time runs out. You can resume after reloading the page. |
| **Results** | Overall score, pass/fail against a 70% practice target (Google doesn't publish its passing score), a per-section breakdown, and a full review with feedback. One click starts practice on the questions you missed. |
| **Spaced repetition** | Leitner boxes (1, 3, 7, 16, 35 days). **Review mistakes** serves wrong answers and questions that are due. |
| **Dashboard** | Estimated exam score (weighted by section, shrunk toward 50% when you've seen few questions), accuracy, coverage, a day streak, per-section bars, a **question bank map** (one dot per question colored by your last answer), and session history. |
| **Question bank browser** | Search and filter every question, with answers and feedback. |
| **Flags, keyboard shortcuts, themes** | Flag questions to revisit. A–F or 1–6 choose an answer, Enter checks or continues, F flags, ← → move between questions in exams. Light, dark or system theme. |
| **Progress** | Saved in the browser by default. Export, import (merged) and reset. Optional **cloud sync** across devices with sign-in. |
| **Multi-certification** | Each certification is a folder of Markdown question files plus a `cert.json`. A scaffold script creates new ones. |

## Architecture

```
Browser ──HTTPS──> CloudFront (OAC, security headers, HTTP/3) ──> S3 (private bucket: HTML/CSS/JS + question JSON)
   │
   └─ optional ─> Cognito managed login (OAuth code + PKCE)
                  API Gateway HTTP API (JWT authorizer, throttled) ──> Lambda (Node 22, arm64) ──> DynamoDB (on-demand)
```

* The site is fully static. Question banks are JSON files served by CloudFront, so taking tests costs nothing beyond CDN delivery.
* Sync is a single Lambda with three routes (`GET/PUT/DELETE /progress/{certId}`). PUT **merges** on the server (newest answer per question wins, and attempt histories are combined), so two devices never overwrite each other.
* Everything lives in one SAM/CloudFormation template (`template.yaml`). Set `EnableSync=false` for a static-only deployment.

## What it costs

For a personal or small-group study site, expect **$0–$1/month**:

* **CloudFront**: 1 TB of transfer and 10M requests per month are in the always-free tier. The whole app plus question bank is roughly 400 KB.
* **S3**: a few MB of storage, which costs fractions of a cent.
* **Cognito**: the Lite and Essentials plans include 10,000 monthly active users free. New user pools default to Essentials.
* **Lambda / API Gateway / DynamoDB**: on-demand pricing, and a study session makes a handful of requests, so this rounds to $0. The API is throttled (10 req/s, burst 20) to cap any runaway cost.
* **DynamoDB point-in-time recovery** is enabled for safety and costs pennies at this size. You can turn it off in the template.

A budget alert is still a good idea: Billing → Budgets → $1 monthly.

## Deploy

Easiest: open **AWS CloudShell** (it already has the AWS CLI, SAM CLI and Python), upload or clone this folder, then:

```bash
cd certprep
./scripts/deploy.sh
```

The first run is guided. Pick a region and stack name, and set **AuthDomainPrefix** to something globally unique such as `certprep-sebastian-2026` (it can't contain "aws", "amazon" or "cognito"). If you don't want accounts or sync, set **EnableSync** to `false`. Answer `y` to saving the arguments. The script then:

1. Builds the question bank (`scripts/build_bank.py`).
2. Deploys the stack with `sam deploy`.
3. Writes `config.json` from the stack outputs, so the site knows the API and sign-in URLs.
4. Uploads the site to S3 and invalidates CloudFront.

It prints your site URL at the end. A brand-new distribution can take a few minutes to start serving.

After editing questions or the UI, run `./scripts/deploy.sh --site-only` to rebuild and upload without touching the stack.

**Tear down:** `sam delete --stack-name certprep`. The DynamoDB table is set to `Retain` so progress isn't deleted by accident. Delete it in the console if you want it gone. You may need to empty the S3 bucket first, since it's versioned.

## Automatic deploys from GitHub

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`):

* **Every push and pull request** runs the checks: question-bank validation, the unit tests, and `cfn-lint`.
* **Every push to `main`** then deploys. If `template.yaml` or `backend/src/` changed, it runs `sam deploy` for the full stack first. Otherwise it only rebuilds and publishes the website, which takes about a minute.
* **Run workflow** on the Actions tab lets you redeploy by hand. Tick "full deploy" to force a stack deploy.

GitHub signs in to AWS through OIDC, so no AWS keys are stored in GitHub. Only workflows running on `main` in `Seba-RC/certprep` can assume the deploy role. That role can start CloudFormation deploys, upload files and clear the CDN cache. The actual resource changes run through a separate execution role that only CloudFormation can use, and it's limited to the app stack's `certprep-*` resources.

**One-time setup:**

1. In CloudShell (us-east-1), from the `certprep` folder, run:
   ```bash
   ./scripts/setup_github_deploy.sh
   ```
   This creates the `certprep-github-deploy` stack (`infra/github-deploy.yaml`), which contains the OIDC provider (if your account doesn't have one yet), the two roles, and an artifacts bucket. It prints your AWS account ID at the end.
2. In GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add a repository variable named `AWS_ACCOUNT_ID` set to that account ID.

Until that variable exists, the workflow runs the checks and skips the deploy. The region, stack name and Cognito prefix are set in the workflow's `env:` block. Edit them there if they ever change.

## Run locally

```bash
python3 scripts/build_bank.py
cd web && python3 -m http.server 8765
# open http://localhost:8765
```

Local mode uses browser storage. To test sign-in locally against a deployed stack, copy the deployed `config.json` into `web/`. `http://localhost:8765` is already an allowed callback and CORS origin.

## Tests

```bash
cd backend && npm install && npm test
```

There are 18 tests. They cover bank validity (every bank in `web/banks/`), safe rich-text rendering, accent-insensitive search, scoring (exact match for multi-select), exam weighting, spaced repetition, practice selection, stats, client/server merge agreement, and the Lambda (auth, validation, merge-on-PUT, per-user isolation, delete). `pip install cfn-lint && cfn-lint template.yaml` lints the template.

## Writing questions

Questions live in `bank-src/<cert-id>/*.md`:

```markdown
### ace-3104 [3.2] d2 #lifecycle
Logs in a bucket should move to Coldline after 30 days and be deleted after 365 days. How should you implement this?
+ Set an Object Lifecycle Management configuration with ... :: Lifecycle rules apply actions automatically based on conditions such as age.
- Write a daily Cloud Run job that lists and rewrites objects :: This is custom code for a built-in feature.
- Set the bucket's default storage class to Coldline :: New objects would go to Coldline immediately, and nothing would be deleted.
> Lifecycle rules can change storage class or delete objects based on age, version count, live state, prefix, and other conditions.
```

* `### <id> [<objective>] d<1-3> #tags`. IDs must stay stable, because progress is keyed by them.
* `+` marks a correct option and `-` a wrong one. Text after ` :: ` is the feedback for that option.
* With two or more `+` lines, the stem must include `(Choose two.)` or `(Choose three.)`. The build checks this.
* `>` is the takeaway shown after answering.
* Spanish banks can write `(Elige dos.)` / `(Elige tres.)` instead of `(Choose two.)`.
* A stem can include a fenced code block (```` ```c ```` … ```` ``` ````) that keeps its line breaks and is shown as code. `Backticks` give inline code in stems, options, feedback and takeaways. Everything is HTML-escaped first, so question files can't inject markup.
* The build validates everything (feedback present, no duplicates, known objectives) and shuffles option order deterministically, so answer letters stay balanced. The app can shuffle again each time.

Run `python3 scripts/build_bank.py` to compile to `web/banks/`. It prints counts per section and objective so you can keep the bank weighted like the exam.

## Adding another certification

```bash
python3 scripts/new_cert.py aws-saa "AWS Certified Solutions Architect – Associate" --vendor AWS --accent "#ff9900"
```

Edit `bank-src/aws-saa/cert.json` (domains, weights, objectives with doc links, exam length, time and pass mark; optional `searchHint` and `codeMarker` for non-English banks, and leave `examGuideUrl` empty if there is no public guide), write questions, and run the build. The new certification appears on the home page automatically, and progress, sync, mock exams and stats all work per certification with no code changes.

## Project layout

```
template.yaml            SAM/CloudFormation: S3, CloudFront+OAC, Cognito, HTTP API, Lambda, DynamoDB
scripts/deploy.sh        build + deploy + upload + invalidate
scripts/setup_github_deploy.sh  one-time: let GitHub Actions deploy (OIDC)
infra/github-deploy.yaml OIDC provider, deploy role, CloudFormation execution role, artifacts bucket
.github/workflows/       checks on every push/PR, auto-deploy from main
scripts/build_bank.py    Markdown questions -> validated JSON
scripts/new_cert.py      scaffold a new certification
bank-src/gcp-ace/        cert.json + 6 question files (261 questions)
bank-src/sd-udd/         cert.json + 8 question files in Spanish (170 questions)
web/                     the static app (no build step, vanilla JS modules)
  js/engine.js           scoring, exam builder, spaced repetition, stats, merge (pure, unit-tested)
  js/richtext.js         safe code-block / inline-code rendering for question text
  js/store.js            localStorage with in-memory fallback
  js/sync.js             Cognito PKCE sign-in + sync API client
  js/app.js              UI and routing
backend/src/             Lambda handler + server-side merge
backend/test/            node:test suites
```

## Keeping the bank current

Google revises the ACE exam guide periodically. When it changes, update the domains, objectives and weights in `bank-src/gcp-ace/cert.json`, then add or retire questions to match. Products get renamed often (for example, Vertex AI became Gemini Enterprise Agent Platform, and Gemini CLI is being folded into Google Antigravity), so check stems against the current guide's product names.
