# kodumi

### Your AI coding crew.

A playful developer workshop for investigating bugs, reviewing patches, and checking the evidence. Scout investigates, Atlas plans, Forge prepares a change, and Pixel reports validation. You accept proposals and explicitly choose whether to publish a draft pull request.

**A runnable, single-user local application. Zero npm dependencies. No API key needed to try it.**

## Start locally

Install **Node.js 22.9 or newer** and extract or clone this repository. In a terminal inside the `kodumi` directory:

```sh
npm start
```

Then open **http://localhost:3000**. There is no build step and no package installation is required. `npm install` is optional because this project has no external dependencies.

1. Select **New task**.
2. Choose **Launchpad** and **Guided repair**.
3. Create the task, then choose **Run task**.
4. Inspect **Overview**, **Changes**, **Files**, and **Tests**.
5. Compare failing baseline tests with the repaired result.
6. Accept the proposal, or download a patch and report from **Options**.

For development with automatic server restart:

```sh
npm run dev
```

The server binds to `127.0.0.1` by default. If port 3000 is occupied, set a different `PORT` in `.env`. Do not open `index.html` directly; the backend is required.

## What works

| Feature | Behavior |
| --- | --- |
| Three debugging labs | Real JavaScript source, bundled repairs, and actual `node --test` results before and after changes |
| Crew workflow | Four observable engineering stages, timestamped events, cancellation, and retry |
| Patch review | Original/proposed source, source-file browser, full-file comparison, downloadable unified patch |
| Validation reports | Named passing/failing checks, raw TAP output, and explicit “not run” states |
| Task management | Creation, history, filters, search, approval, deletion, and JSON report export |
| Local persistence | Atomic JSON writes; tasks, imported snapshots, events, and preferences survive restarts |
| Gemini integration | Optional real model call for a structured diagnosis, implementation plan, and file changes |
| GitHub import | Pinned public/private repository snapshots, with a maximum of 16 supported text files per import |
| Draft PR publication | Explicitly approved proposals create a separate branch and draft PR; stale bases are rejected |
| Appearance | Responsive interface, light/dark themes, reduced motion, keyboard shortcuts, and accessible dialogs |

## Guided labs versus AI mode

**Guided repair is deterministic.** It uses shipped repair code for the specific selected lab. It does not call a model and cannot solve arbitrary issues. The before/after tests genuinely execute, and their output is stored with the task.

**Gemini mode makes a real API request.** It sends the task and available repository files to Google's Gemini API. The model proposes a diagnosis, plan, and edits to at most five existing source files. Output is structurally validated before a patch is displayed. Generated code is not inherently correct.

The four characters represent stages in one workflow, rather than four independent models. Gemini mode currently produces the diagnosis, plan, and patch in one structured model call. This is an inspectable engineering workflow, not a self-improving autonomous coding service.

## Optional AI setup

Copy the example environment file:

```sh
# macOS / Linux / Git Bash
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Choose a `generateContent`-compatible model available to your Google account; the model name is configurable. Restart the server, select **Gemini** when creating a task, and submit a small, well-defined issue. API calls can incur provider charges. See [Google's API documentation](https://ai.google.dev/api/generate-content).

Credentials remain in the server environment and are never returned to the browser or included in task exports. **Do not commit `.env`.** Task descriptions and selected source files are sent to Google in AI mode, so do not submit secrets or material you are not authorized to share.

## Optional GitHub setup

Use **Repositories → Import repository** and enter `owner/repository`. Public snapshots can be read without a token, subject to GitHub's rate limits. The importer reads supported text files from an immutable commit, excludes hidden paths and common generated/dependency directories, and caps each file below 40 KB.

For private repositories or publishing, set:

```dotenv
GITHUB_TOKEN=your_fine_grained_token_here
```

Give the token access only to repositories you intend to use. Reading needs **Contents: read**; publishing additionally needs **Contents: write** and **Pull requests: write**. Repository settings and organization policies may restrict publication. See [GitHub's permission documentation](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens).

1. Import a snapshot.
2. Create and run a **Gemini** task.
3. Review the proposal; imported repository tests are **not executed**.
4. Accept the proposal locally.
5. Select **Create draft PR** and confirm publication.

Kodumi creates a new `kodumi/<task-id>` branch and a **draft** PR. It never merges a PR or pushes directly to the base branch. If the base commit has changed, import a fresh snapshot and run a new task. If PR creation fails after branch creation, retrying reuses that task's branch. Existing PRs are reused on retry.

This version's importer prioritizes source files but does not perform semantic retrieval over a whole repository. A partial import is labeled in the UI. Large or dependency-heavy repositories can lack sufficient context; use small repos and focused tasks.

## Code execution boundaries

- The app executes **only exact, shipped fixture source** directly on the host, in a temporary directory with the bundled tests.
- Imported GitHub code is **never executed**. Validation is labeled “not run,” and must be performed by the developer before merging.
- Other AI-written lab patches need the optional Docker runner. If it is absent, the app preserves the proposal and explicitly skips execution.
- No dependency installation or model-selected shell commands run automatically.
- Acceptance records a decision inside Kodumi; source snapshots remain unchanged. Apply the exported patch yourself or publish an approved GitHub draft PR.

To enable Docker validation of AI patches to the bundled labs:

```sh
docker pull node:22-alpine
```

```dotenv
KODUMI_DOCKER_IMAGE=node:22-alpine
```

The image must already exist locally. Containers use no network, a read-only filesystem and fixture mount, an unprivileged user, dropped capabilities, CPU/memory/process limits, and a timeout. Only the temporary fixture directory is mounted. A Docker socket is never mounted inside the container. **This is defense in depth, not a hardened isolation platform for hostile multi-tenant workloads.** Docker must be running and able to mount the OS temporary directory.

## Tests and checks

```sh
npm test
npm run check
```

The automated suite checks lab reproduction and repair, real patch application with `git apply`, workflow approval and cancellation, persistence and restart recovery, source-path validation, CSRF/origin controls, Gemini response handling, and GitHub draft-PR operations with mocked provider responses. **Git is required for the patch-application tests.** Node alone can run the application and labs.

Live Google/GitHub calls require your credentials and network access; they are not claimed as end-to-end verified by the offline test suite. See [verification notes](docs/VERIFICATION.md).

## Project structure

```text
kodumi/
  public/               Browser UI, styles, original SVG characters
  lib/
    engine.mjs          Task lifecycle and workflow orchestration
    fixtures.mjs        Three trusted regression labs
    runner.mjs          Real Node tests and optional Docker execution
    gemini.mjs          Structured model proposal adapter
    github.mjs          Snapshot import and draft PR adapter
    store.mjs           Serialized atomic JSON persistence
    validation.mjs      Input and proposal validation
    diff.mjs            Unified patch export
  server.mjs            Same-origin HTTP API and static server
  tests/                Node built-in test suite
  scripts/check.mjs     Source syntax verification
  docs/                 Architecture, branding, verification, roadmap
  .github/workflows/    GitHub Actions checks
```

## Put it on GitHub

Create an **empty** GitHub repository named `kodumi` in your own account, then run inside this extracted directory:

```sh
git init
git add .
git commit -m "Initial Kodumi coding workshop"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kodumi.git
git push -u origin main
```

Replace `YOUR_USERNAME`. Authenticate with your own GitHub account when prompted. The ZIP does not contain Git history, credentials, personal workspace data, or installed dependencies. A GitHub Actions workflow runs tests and syntax checks on push and pull request.

**GitHub Pages cannot run the Node backend.** The repo is ready for local development; use a properly secured server deployment for a live full-stack version. This release intentionally restricts hostnames and binds locally. Before making it public, implement authentication, per-user storage, rate limits, and a hardened execution service. See the [roadmap](docs/ROADMAP.md).

## Portfolio description

**Kodumi — JavaScript, Node.js, Gemini API, GitHub REST API, Docker, GitHub Actions**

Built a branded coding workshop with a four-stage investigation workflow, actual before/after regression tests, reviewable patch exports, persistent task history, and optional AI-generated proposals and developer-approved draft pull requests.

Personalize this description to reflect your own contributions, testing, and subsequent improvements. Do not describe the guided labs as autonomous AI fixes.

## Design and documentation

- [Start here](START_HERE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Brand identity](docs/BRAND.md)
- [Verification and limits](docs/VERIFICATION.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security scope](SECURITY.md)

MIT licensed. The Kodumi name and concept are a working project identity; this repository does not establish trademark or domain availability.
