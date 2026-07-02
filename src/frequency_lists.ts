import type { FrequencyLists } from "./types.js"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

// Direct JSON import requires incompatible syntax across CJS and NodeNext ESM
// (CJS uses require(), ESM requires `with { type: "json" }`). readFileSync
// works identically under both module systems.
const currentDir =
    typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath((eval("import.meta") as ImportMeta).url))

const frequencyLists = JSON.parse(
    readFileSync(join(currentDir, "..", "data", "frequency_lists.json"), "utf-8"),
) as FrequencyLists

export default frequencyLists
