# Bucky O'Hare source inventory and porting plan

## Source baseline

Reference disassembly: https://github.com/Yoshimaster96/bucky-disasm

Previously inspected source inventory:

- `bucky.asm`: assembly entry point and region/build selection
- `regs.asm`: NES CPU, PPU, APU, and controller register definitions
- `vars.asm`: game RAM variables and constants
- `prg0.asm`: HUD, level state, collision, player setup
- `prg1.asm`: victory/ending, explosions, score/life-up, enemy routines
- `prg2.asm`: level data, boss data, title/password routines
- `prg3.asm`: additional level and boss data
- `prg4.asm`: nametables, IRQ/CHR bank data, enemy data, stage select
- `prg5.asm`: player/enemy sprite and animation data
- `prg6.asm`: sound/music engine
- `prg7.asm`: game modes, level routines, scrolling, collision

Previously counted baseline: approximately 53,061 lines across PRG assembly files. Counts must be revalidated against the exact upstream commit before implementation.

## Porting strategy

This is a behavior-preserving reimplementation, not a line-by-line assembler-to-JavaScript text conversion. The assembly uses NES memory-mapped hardware and banked data. Each subsystem must first be mapped to its observable behavior and state, then implemented in TypeScript with tests.

### Work packages

1. **Source lock and audit**
   - Pin the exact disassembly commit.
   - Inventory every label, data table, memory variable, bank, and call/jump relationship.
   - Record region differences and asset/license constraints.
2. **Runtime foundation**
   - Fixed-step game loop with deterministic frame timing.
   - 256x240 logical viewport and integer scaling.
   - Input abstraction for keyboard, gamepad, and touch.
   - Scene/state machine and save-state data model.
3. **Data and rendering**
   - Tile/map representation, sprite metadata, palette handling, layering, scrolling.
   - Recreate assets only from material with verified rights.
4. **Player system**
   - Five playable characters, movement, jump, attacks, damage, switching, animation.
5. **World and enemies**
   - Stage flow, collision, hazards, enemy state machines, projectiles, boss encounters.
6. **Audio**
   - Reimplement sound events and music sequencing with Web Audio; test timing and channel behavior.
7. **UI and game modes**
   - Title, dialog, stage selection, gameplay, death, game over, ending, HUD, passwords.
8. **Compatibility**
   - Compare deterministic gameplay traces and screenshots against a lawfully available reference runtime.
   - Test desktop, mobile, gamepad, pause/resume, and browser lifecycle.
9. **Release**
   - Build static output into `wwwroot/nes/`.
   - Test subpath asset resolution and ensure existing site/API smoke tests remain green.

## Important technical decision

The disassembly references NES hardware directly. A faithful port must model the game-specific effects of bank switching, frame timing, PPU graphics, and APU sound. We will not claim full fidelity until those behaviors have been tested. If exact original behavior proves to require a complete NES emulator, that option will be evaluated as a compatibility layer rather than silently changing the project scope.

## Licensing

The reference disassembly repository did not show a clear license in the inspected tree. Do not copy its source files, ROM images, music, or graphics into this repository or public deployment unless the relevant rights are confirmed. Keep source references, independent notes, and original implementation separate.
