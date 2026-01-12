import fs from "node:fs"

const defaultCsvPath =
  "docs/06-metrics/diffusion-modeling rawdata/Supabase Snippet Workspace Row-Level Access Policies.csv"

function parseCsvRFC4180(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ",") {
      row.push(field)
      field = ""
      continue
    }

    if (ch === "\n") {
      row.push(field)
      field = ""
      const last = row[row.length - 1]
      if (typeof last === "string") row[row.length - 1] = last.replace(/\r$/, "")
      rows.push(row)
      row = []
      continue
    }

    field += ch
  }

  if (inQuotes) throw new Error("CSV parse error: unmatched quote")

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function toNumber(value) {
  if (value === "" || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function median(numbers) {
  const sorted = numbers.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function approxEqual(a, b, eps = 1e-6) {
  if (a === b) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) <= eps
}

function computeViralityScore({ replies, reposts, quotes, likes, views }) {
  if (!views) return 0
  return ((replies * 3 + reposts * 2.5 + quotes * 2 + likes) / views) * 100
}

function computeDeltaEngagementRate({
  deltaLikes,
  deltaReplies,
  deltaReposts,
  deltaQuotes,
  deltaViews,
}) {
  if (!deltaViews) return 0
  return (((deltaLikes ?? 0) + (deltaReplies ?? 0) + (deltaReposts ?? 0) + (deltaQuotes ?? 0)) / deltaViews) * 100
}

const csvPath = process.argv[2] ?? defaultCsvPath
const csvText = fs.readFileSync(csvPath, "utf8")
const rows = parseCsvRFC4180(csvText)
if (rows.length === 0) throw new Error("Empty CSV")

const header = rows[0]
const records = rows.slice(1).filter((r) => r.some((cell) => cell !== ""))

const index = new Map()
for (let i = 0; i < header.length; i++) index.set(header[i], i)

function get(record, name) {
  const idx = index.get(name)
  if (idx == null) return null
  return record[idx] ?? null
}

const requiredCols = [
  "post_id",
  "bucket_ts",
  "views",
  "likes",
  "replies",
  "reposts",
  "quotes",
  "delta_views",
  "delta_likes",
  "delta_replies",
  "delta_reposts",
  "delta_quotes",
  "delta_engagement_rate",
  "virality_score",
]

const missing = requiredCols.filter((c) => !index.has(c))
if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`)

const byPost = new Map()
for (const r of records) {
  const postId = get(r, "post_id")
  if (!postId) continue
  const list = byPost.get(postId) ?? []
  list.push(r)
  byPost.set(postId, list)
}

let monotonicViolations = 0
let deltaMismatches = 0
let viralityMismatches = 0
let engagementRateMismatches = 0

const liftCandidates = []

for (const [postId, list] of byPost) {
  list.sort((a, b) => new Date(get(a, "bucket_ts")) - new Date(get(b, "bucket_ts")))

  let prev = null
  const windowDeltas = []

  for (const r of list) {
    const views = toNumber(get(r, "views")) ?? 0
    const likes = toNumber(get(r, "likes")) ?? 0
    const replies = toNumber(get(r, "replies")) ?? 0
    const reposts = toNumber(get(r, "reposts")) ?? 0
    const quotes = toNumber(get(r, "quotes")) ?? 0

    const csvDeltaViews = toNumber(get(r, "delta_views")) ?? 0
    const csvDeltaLikes = toNumber(get(r, "delta_likes")) ?? 0
    const csvDeltaReplies = toNumber(get(r, "delta_replies")) ?? 0
    const csvDeltaReposts = toNumber(get(r, "delta_reposts")) ?? 0
    const csvDeltaQuotes = toNumber(get(r, "delta_quotes")) ?? 0

    const csvVirality = toNumber(get(r, "virality_score")) ?? 0
    const csvDeltaER = toNumber(get(r, "delta_engagement_rate")) ?? 0

    const computedVirality = computeViralityScore({ replies, reposts, quotes, likes, views })
    if (!approxEqual(Number(computedVirality.toFixed(4)), Number(csvVirality.toFixed(4)), 1e-4)) {
      viralityMismatches++
    }

    const computedDeltaER = computeDeltaEngagementRate({
      deltaLikes: csvDeltaLikes,
      deltaReplies: csvDeltaReplies,
      deltaReposts: csvDeltaReposts,
      deltaQuotes: csvDeltaQuotes,
      deltaViews: csvDeltaViews,
    })
    if (!approxEqual(Number(computedDeltaER.toFixed(4)), Number(csvDeltaER.toFixed(4)), 1e-4)) {
      engagementRateMismatches++
    }

    if (prev) {
      const prevViews = toNumber(get(prev, "views")) ?? 0
      const prevLikes = toNumber(get(prev, "likes")) ?? 0
      const prevReplies = toNumber(get(prev, "replies")) ?? 0
      const prevReposts = toNumber(get(prev, "reposts")) ?? 0
      const prevQuotes = toNumber(get(prev, "quotes")) ?? 0

      if (
        views < prevViews ||
        likes < prevLikes ||
        replies < prevReplies ||
        reposts < prevReposts ||
        quotes < prevQuotes
      ) {
        monotonicViolations++
      }

      const dViews = Math.max(0, views - prevViews)
      const dLikes = Math.max(0, likes - prevLikes)
      const dReplies = Math.max(0, replies - prevReplies)
      const dReposts = Math.max(0, reposts - prevReposts)
      const dQuotes = Math.max(0, quotes - prevQuotes)

      const ok =
        approxEqual(dViews, csvDeltaViews, 1e-6) &&
        approxEqual(dLikes, csvDeltaLikes, 1e-6) &&
        approxEqual(dReplies, csvDeltaReplies, 1e-6) &&
        approxEqual(dReposts, csvDeltaReposts, 1e-6) &&
        approxEqual(dQuotes, csvDeltaQuotes, 1e-6)

      if (!ok) deltaMismatches++

      windowDeltas.push({
        bucketTs: get(r, "bucket_ts"),
        dViews: csvDeltaViews,
        dReposts: csvDeltaReposts,
      })

      const history = windowDeltas.slice(-5, -1).map((w) => w.dViews).filter((n) => n > 0)
      if (history.length >= 3) {
        const baseline = median(history)
        const lift = Math.max(0, csvDeltaViews - baseline)
        if (lift > 0 && csvDeltaReposts === 0) {
          liftCandidates.push({ postId, bucketTs: get(r, "bucket_ts"), lift, deltaViews: csvDeltaViews, baseline })
        }
      }
    } else {
      windowDeltas.push({ bucketTs: get(r, "bucket_ts"), dViews: csvDeltaViews, dReposts: csvDeltaReposts })
    }

    prev = r
  }
}

liftCandidates.sort((a, b) => b.lift - a.lift)
const topLift = liftCandidates.slice(0, 10)

console.log(`CSV: ${csvPath}`)
console.log(`rows: ${records.length}`)
console.log(`posts: ${byPost.size}`)
console.log("")
console.log("Consistency checks (counts):")
console.log(`- monotonic_violations: ${monotonicViolations}`)
console.log(`- delta_mismatches: ${deltaMismatches}`)
console.log(`- delta_engagement_rate_mismatches: ${engagementRateMismatches}`)
console.log(`- virality_score_mismatches: ${viralityMismatches}`)

console.log("")
console.log("Top lift candidates (Δviews spike with Δreposts==0):")
if (topLift.length === 0) {
  console.log("- (none)")
} else {
  for (const c of topLift) {
    console.log(
      `- post_id=${c.postId} bucket_ts=${c.bucketTs} lift=${c.lift.toFixed(0)} (Δviews=${c.deltaViews.toFixed(
        0
      )} baseline≈${c.baseline.toFixed(0)})`
    )
  }
}

