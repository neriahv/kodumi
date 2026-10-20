# Verification

## Automated checks

Run `npm test` and `npm run check` from the project root. Tests use temporary directories and ephemeral local HTTP ports, never your saved workspace or personal credentials.

Build verification: **23 tests passed** on Node 24.19.0; all JavaScript source files passed syntax checks. GitHub Actions is configured to repeat checks on Node 22 and 24.

The suite covers:

- Real baseline failures and successful shipped repairs in all three labs.
- Host execution rejection for unrecognized generated code.
- Full workflow create/run/review/approve/export/delete behavior.
- Patch application using Git, including files without final newlines.
- Cancellation, retry, local persistence, and interrupted-task recovery.
- Theme/reduced-motion persistence and static file serving.
- Origin/CSRF controls, malformed input, and missing credentials.
- Gemini output validation, token usage extraction, truncated responses, and provider errors with mocked HTTP responses.
- GitHub immutable snapshots, path filtering, stale-base rejection, separate branch creation, and draft PR flag with mocked HTTP responses.
- Actual frontend-module render smoke checks for primary navigation, review tabs, escaped source content, skipped-validation labels, and approval-gated PR controls. These run on a minimal DOM surface, not a browser engine.

## Verification limits

- Live paid Gemini inference and authenticated GitHub writes require your own configured credentials; provider adapters are tested with mocks.
- Docker execution is optional and was not exercised in the build environment when Docker was unavailable.
- Automated browser rendering and cross-browser visual QA were unavailable in the build environment. Responsive layouts and accessible controls are implemented, but should be checked on your own target browsers using the walkthrough below.
- Passing bundled tests demonstrates the specific lab behavior, not universal patch correctness.

## Browser walkthrough

1. Start the app and open http://localhost:3000.
2. Check the Workshop, Repositories, Task history, Meet the crew, and Settings screens.
3. Create each guided lab, run it, inspect all four tabs, and accept a proposal.
4. Download the unified patch and JSON report. Apply the patch in a copy of matching fixture source with `git apply`.
5. Create another task, cancel during execution, and retry.
6. Search tasks with `/`, create one with `N`, and close dialogs with `Esc`.
7. Toggle themes and reduced motion, reload, and verify that preferences persist.
8. Narrow the browser to mobile width; confirm bottom navigation and readable code overflow.
9. With a configured Gemini key, run a small AI task and inspect both a successful and a provider-error outcome.
10. In a disposable GitHub repo you control, import, propose, review, accept, and explicitly create a draft PR. Change the base after import to verify stale-base rejection.

When publishing your portfolio, record actual test counts and verified integrations from your own environment. Avoid presenting optional or untested deployment steps as completed work.
