# NEStry — Bucky O'Hare HTML5 Port

This directory contains the source project for a browser-native Bucky O'Hare reimplementation.

## Deployment target

The built game is published by the existing HattrickAI V6 ASP.NET Core host at:

- `https://dinceryuksek.com/nes/`

The existing root homepage and HattrickAI routes must remain unchanged.

## Architecture

- `src/`: TypeScript game implementation (not served directly)
- `assets/`: project-owned or redistributable game assets and extracted data
- `tests/`: deterministic unit and compatibility tests
- `docs/`: source analysis, subsystem maps, porting decisions
- `wwwroot/nes/`: generated static web build served by ASP.NET Core

The game must not depend on a server-side game API. Runtime gameplay should execute in the browser using Canvas 2D and Web Audio.

## Porting principles

1. Preserve the original game behavior, timing, physics, collision rules, stage flow, enemy patterns, and audio behavior wherever evidence allows.
2. Translate subsystem-by-subsystem; do not mechanically translate assembly mnemonics into JavaScript.
3. Record the source file, labels, addresses, and evidence for each implemented subsystem.
4. Add deterministic tests before integrating each subsystem.
5. Keep original source/disassembly and copyrighted ROM/audio/graphics out of public deployment unless redistribution rights are confirmed.
6. Do not replace the production homepage or alter the existing V6 API routes.

## Build output

The build pipeline will compile TypeScript into `wwwroot/nes/`. The production host already serves static files, so the intended route is the subdirectory path `/nes/`, without adding a new domain, VM, container port, or Cloudflare hostname.
