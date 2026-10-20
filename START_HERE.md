# Start here

1. Install Node.js **22.9+** from https://nodejs.org/ if it is not already installed.
2. Extract this ZIP. Open the inner `kodumi` folder in VS Code.
3. Open the terminal in that folder and run `npm start`.
4. Visit http://localhost:3000 in your browser.
5. Create a **Launchpad → Guided repair** task and select **Run task**.
6. Review the code changes and the before/after tests. Select **Accept proposal** after reviewing.

No key, database, Docker installation, or npm dependency download is required for this first walkthrough.

## Optional next steps

- Try Pagecraft and Tinycart, the other guided labs.
- Copy `.env.example` to `.env` and add a Gemini key for actual AI-generated proposals.
- Import a small GitHub repository to investigate its source with Gemini.
- Configure a GitHub token to publish reviewed proposals as draft PRs.
- Run `npm test` and `npm run check`. Install Git to run the patch-application tests.
- Follow the GitHub commands in README.md to create your own repository.

## If something does not start

- **`node` or `npm` not recognized:** install Node, then restart your terminal.
- **Unknown Node flag:** update to Node 22.9 or newer.
- **Port busy:** copy `.env.example` to `.env`, change `PORT=3001`, restart, and use http://localhost:3001.
- **AI option disabled:** set `GEMINI_API_KEY`, choose a model your account can use, and restart the server.
- **GitHub import fails:** check owner/name, repository access, token permissions, API quota, and network connectivity.
- **Imported tests say “not run”:** this is intentional. Download the patch and run the repository's own checks yourself.

Do not upload `.env` or `.kodumi/` to GitHub. They are ignored automatically.
