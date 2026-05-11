import type { CurveName } from "./curves";

import { terminalSarmal } from "./terminal";
import { curves } from "./curves";

function usage(): void {
  process.stdout.write(
    [
      "Usage: npx @sarmal/core [options]",
      "",
      "Options:",
      "  --curve <id>   Curve name (e.g. deltoid, rose3). Random if omitted.",
      "  --fps <num>    Frame rate (default: 30).",
      "  --speed <num>  Animation speed multiplier (default: curve default).",
      "  --size <num>   Spinner width in characters (default: 16).",
      "  --color <hex>  Trail color as 6-digit hex (default: #ec5571).",
      "  --verbose      Show curve name and hint above spinner.",
      "  --help         Show this message.",
      "",
      "Examples:",
      "  npx @sarmal/core",
      "  npx @sarmal/core --curve deltoid --verbose",
      "  npx @sarmal/core --curve rose3 --fps 15 --speed 3",
      "",
    ].join("\n") + "\n",
  );
}

function matchArg(argv: string[], i: number, flag: string): string | undefined {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("-")) {
    process.stderr.write(`[sarmal] ${flag} requires a value\n`);
    process.exit(1);
  }
  return value;
}

function main(): void {
  const args = process.argv.slice(2);

  let curveName: string | undefined;
  let verbose = false;
  let fps: number | undefined;
  let speed: number | undefined;
  let size: number | undefined;
  let color: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--curve": {
        curveName = matchArg(args, i, "--curve")!;
        i++;
        break;
      }

      case "--fps": {
        const raw = matchArg(args, i, "--fps")!;
        fps = Number(raw);
        if (!Number.isFinite(fps) || fps <= 0) {
          process.stderr.write(`[sarmal] --fps must be a positive number, got "${raw}"\n`);
          process.exit(1);
        }
        i++;
        break;
      }

      case "--speed": {
        const raw = matchArg(args, i, "--speed")!;
        speed = Number(raw);
        if (!Number.isFinite(speed)) {
          process.stderr.write(`[sarmal] --speed must be a finite number, got "${raw}"\n`);
          process.exit(1);
        }
        i++;
        break;
      }

      case "--size": {
        const raw = matchArg(args, i, "--size")!;
        size = Math.round(Number(raw));
        if (!Number.isFinite(size) || size < 1) {
          process.stderr.write(`[sarmal] --size must be a positive integer, got "${raw}"\n`);
          process.exit(1);
        }
        i++;
        break;
      }

      case "--color": {
        const raw = matchArg(args, i, "--color")!;
        if (!/^#[0-9a-fA-F]{6}$/.test(raw)) {
          process.stderr.write(`[sarmal] --color must be a 6-digit hex string, got "${raw}"\n`);
          process.exit(1);
        }
        color = raw;
        i++;
        break;
      }

      case "--verbose": {
        verbose = true;
        break;
      }

      case "--help": {
        usage();
        process.exit(0);
      }

      default: {
        process.stderr.write(`[sarmal] Unknown option: ${arg}\n`);
        process.stderr.write("Run with --help for usage.\n");
        process.exit(1);
      }
    }
  }

  const allCurves = Object.values(curves);
  let curve = allCurves[Math.floor(Math.random() * allCurves.length)]!;

  if (curveName) {
    const availableCurves = Object.keys(curves);
    const lower = curveName.toLowerCase();
    const key = availableCurves.find((k) => k.toLowerCase() === lower);
    const found = key ? curves[key as CurveName] : undefined;

    if (!found) {
      process.stderr.write(
        `[sarmal] Unknown curve: "${curveName}". Available: ${availableCurves.join(", ")}\n`,
      );
      process.exit(1);
    }
    curve = found;
  }

  if (verbose) {
    process.stdout.write(`\x1B[2m${curve.name} — Ctrl+C to stop\x1B[0m\n\n`);
  }

  terminalSarmal(process.stdout, curve, {
    ...(fps !== undefined ? { fps } : {}),
    ...(speed !== undefined ? { speed } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(color !== undefined ? { trailColor: color } : {}),
  });
}

main();
