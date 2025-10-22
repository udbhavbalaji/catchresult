import { $ } from "bun";

await $`bunx tsc --noEmit`; // running typechecking
await $`bun test`; // testing
await $`rm -rf dist`; // cleaning current build
await $`bun run build`; // building
