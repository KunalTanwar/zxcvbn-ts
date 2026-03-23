// Frequency lists are stored as JSON to avoid duplicating 1MB of data
// across CJS, ESM, and types build targets.
// The JSON file is copied alongside each compiled output by the build scripts.
import type { FrequencyLists } from "./types"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const frequencyLists: FrequencyLists =
    require("../data/frequency_lists.json") as FrequencyLists

export default frequencyLists
