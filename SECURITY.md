# Security scope

Kodumi v1 is a **single-user local application**, bound to loopback by default. It has no account system. Do not expose it through a public tunnel or shared network without adding authentication, authorization, rate limits, and a deployment-specific origin policy.

## Existing controls

- Same-origin mutation token and explicit Origin checking.
- Local-hostname restriction to reduce DNS-rebinding exposure.
- Content Security Policy, no external scripts/fonts, escaped UI content, and request-size limits.
- Input/path validation and bounded imported snapshots/proposals.
- Server-side credentials excluded from browser responses and exports.
- Exact trusted-fixture checks before host execution.
- Optional resource-limited, network-disabled, unprivileged Docker runner for generated lab code.
- Explicit review before acceptance and separate confirmation before GitHub writes.
- Unchanged-base requirement before draft PR publication.

## Limits

Docker containers are not a complete hostile-code security boundary. Repository text and model output can be adversarial. Prompt instructions and path filters reduce some risks but do not eliminate prompt injection or accidental sensitive-data disclosure. Do not analyze repositories containing secrets. JSON reports can include source code and task descriptions; review them before sharing.

Workspace files in `.kodumi/` are stored unencrypted under your OS account. Keep OS permissions and backups appropriate to the code you import. Only one server process should use a data directory.

Never commit `.env`, tokens, or workspace data. Use selected-repository fine-grained tokens for local experiments. Prefer a GitHub App and user-specific authorization for a future hosted release.

If you find a vulnerability, privately contact the repository owner using the contact method they publish. Do not attach credentials or private source code to a public issue.
