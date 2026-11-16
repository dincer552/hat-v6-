# NEStry architecture and hosting plan

## Existing host inspected

Repository: https://github.com/dincer552/hat-v6-
Default branch: main
Inspected commit: 3324e8b79f6227a304b42b7a2cf425026eee8d96

Confirmed from repository files:

- ASP.NET Core Web SDK targeting .NET 9.
- Static site files live in `wwwroot/`.
- `Program.cs` enables `UseDefaultFiles()` and `UseStaticFiles()`.
- Docker image uses .NET 9 SDK/runtime.
- Container listens on port 10000.
- GitHub Actions builds and pushes to GHCR, then deploys using a self-hosted Linux x64 runner.
- Existing deploy workflow has health checks and a rollback path.
- Existing root homepage is `wwwroot/index.html`; it must remain unchanged.
- Existing Hattrick routes and API endpoints must remain unchanged.

## URL strategy

Serve the game from `wwwroot/nes/index.html` so the existing ASP.NET static-file middleware serves:

`https://dinceryuksek.com/nes/`

No new DNS record, Cloudflare Tunnel hostname, public port, or VM is needed for this approach. Relative asset URLs must be used so scripts, styles, maps, and audio resolve below `/nes/`.

## Repository layout

- `Nestry/src/`: TypeScript source
- `Nestry/assets/`: legally usable assets and data
- `Nestry/tests/`: unit, deterministic, and compatibility tests
- `Nestry/docs/`: disassembly inventory and porting notes
- `wwwroot/nes/`: compiled browser output only

## Deployment isolation

The initial implementation is prepared on a feature branch. It must not be merged to `main` or deployed until the game build, tests, and route smoke tests pass. The current V6 deploy workflow replaces the Hattrick container, so any release must pass the existing health check and retain rollback behavior.

A later refinement may separate game artifact deployment from the V6 application deployment. For the first working version, placing the static build beneath `wwwroot/nes/` is the smallest-risk option and avoids changing Cloudflare or Nginx routing.

## Compatibility requirements

- Root `/` continues serving the personal homepage.
- Existing Hattrick routes and `/api/*` endpoints remain unchanged.
- `/nes/` serves the game independently.
- All game assets use relative paths or a configured base path.
- No game API endpoint is required for client-side play.
- Browser runtime targets desktop keyboard, gamepad, and mobile touch controls.

## Release gates

1. TypeScript build succeeds.
2. Unit tests pass.
3. Browser smoke test verifies `/nes/` and all referenced assets.
4. Existing `/health`, `/`, and Hattrick smoke tests pass.
5. Only then merge and allow the existing deployment workflow to publish.
