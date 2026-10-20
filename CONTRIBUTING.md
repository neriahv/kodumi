# Contributing

1. Use Node 22.9+ and Git.
2. Create a branch for one focused improvement.
3. Run `npm test` and `npm run check`.
4. Walk through the affected interface at desktop and mobile widths.
5. Document changes to integration permissions, execution boundaries, and user-visible claims.

Keep dependencies intentional. Model adapters must treat source content as untrusted data, validate generated file changes, and keep credentials outside browser state. Do not add arbitrary shell-command execution or imply skipped validation succeeded.

For new guided labs, include a small source module, a known repair, an honest diagnosis, and regression tests that fail before and pass after the fix. Test host execution must remain restricted to exact shipped fixtures.
