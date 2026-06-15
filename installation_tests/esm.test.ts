// test/install-esm.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("installed package imports by name under node ESM", () => {
  const root = process.cwd()
  // 1. build + pack — tarball contains exactly what a consumer gets
  execFileSync("bun", ["run", "build"], { cwd: root, stdio: "inherit" })
  const tarball = execFileSync("npm", ["pack", "--silent"], { cwd: root, encoding: "utf8" }).trim()

  // 2. fresh project, no relation to this repo's node_modules
  const dir = mkdtempSync(join(tmpdir(), "zxcvbn-esm-"))
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", type: "module", private: true }))
    execFileSync("npm", ["install", join(root, tarball)], { cwd: dir, stdio: "inherit" })

    // 3. import by NAME — exercises exports map + internal specifiers
    const script = `
      import { zxcvbn } from "zxcvbn-ts";
      import { checkPwned } from "zxcvbn-ts/pwned";
      import { zxcvbnAI } from "zxcvbn-ts/ai";
      const r = zxcvbn("password");
      if (typeof r.score !== "number") { console.error("no score"); process.exit(1); }
      if (r.score > 1) { console.error("dictionaries not loaded"); process.exit(1); }
      console.log("ok");
    `
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: dir,
      encoding: "utf8",
    })
    assert.match(out, /ok/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(join(root, tarball), { force: true })
  }
})
