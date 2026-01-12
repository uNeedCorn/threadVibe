import fs from "node:fs"

function parseArgs(argv) {
  const args = {
    csv: null,
    k: 6,
    alpha: 1,
    out: null,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === "--csv") args.csv = next, i++
    else if (a === "--k") args.k = Number(next), i++
    else if (a === "--alpha") args.alpha = Number(next), i++
    else if (a === "--out") args.out = next, i++
  }

  if (!args.csv) throw new Error("Missing --csv <path>")
  if (!Number.isFinite(args.k) || args.k <= 0) throw new Error("Invalid --k")
  if (!Number.isFinite(args.alpha) || args.alpha < 0) throw new Error("Invalid --alpha")

  return args
}

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

function buildIndex(header) {
  const index = new Map()
  for (let i = 0; i < header.length; i++) index.set(header[i], i)
  return index
}

function get(record, index, name) {
  const idx = index.get(name)
  if (idx == null) return null
  return record[idx] ?? null
}

function transpose(A) {
  const m = A.length
  const n = A[0]?.length ?? 0
  const T = Array.from({ length: n }, () => Array.from({ length: m }, () => 0))
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) T[j][i] = A[i][j]
  return T
}

function matMul(A, B) {
  const m = A.length
  const n = A[0]?.length ?? 0
  const p = B[0]?.length ?? 0
  const out = Array.from({ length: m }, () => Array.from({ length: p }, () => 0))
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      const aik = A[i][k]
      for (let j = 0; j < p; j++) out[i][j] += aik * B[k][j]
    }
  }
  return out
}

function matVecMul(A, v) {
  const m = A.length
  const n = A[0]?.length ?? 0
  const out = Array.from({ length: m }, () => 0)
  for (let i = 0; i < m; i++) {
    let sum = 0
    for (let j = 0; j < n; j++) sum += A[i][j] * v[j]
    out[i] = sum
  }
  return out
}

function solveLinearSystem(A, b) {
  const n = A.length
  const M = A.map((row, i) => row.slice().concat([b[i]]))

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r
    }
    if (Math.abs(M[pivotRow][col]) < 1e-12) return null

    if (pivotRow !== col) {
      const tmp = M[pivotRow]
      M[pivotRow] = M[col]
      M[col] = tmp
    }

    const pivot = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= pivot

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col]
      if (factor === 0) continue
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c]
    }
  }

  return M.map((row) => row[n])
}

function fitRidge(X, y, alpha) {
  const Xt = transpose(X)
  const XtX = matMul(Xt, X)
  const p = XtX.length
  for (let i = 0; i < p; i++) XtX[i][i] += alpha
  const Xty = matVecMul(Xt, y)
  const w = solveLinearSystem(XtX, Xty)
  return w
}

function rmse(yTrue, yPred) {
  let s = 0
  for (let i = 0; i < yTrue.length; i++) {
    const d = yTrue[i] - yPred[i]
    s += d * d
  }
  return Math.sqrt(s / Math.max(1, yTrue.length))
}

function logSpace(min, max, steps) {
  const out = []
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1)
    out.push(Math.exp(logMin + (logMax - logMin) * t))
  }
  return out
}

function buildSeries(records, index) {
  const byPost = new Map()
  for (const r of records) {
    const postId = get(r, index, "post_id")
    if (!postId) continue
    const list = byPost.get(postId) ?? []
    list.push(r)
    byPost.set(postId, list)
  }

  const series = []
  for (const [postId, list] of byPost) {
    list.sort((a, b) => new Date(get(a, index, "bucket_ts")) - new Date(get(b, index, "bucket_ts")))
    let prev = null
    const points = []
    for (const r of list) {
      const age = toNumber(get(r, index, "age_minutes")) ?? null
      const views = toNumber(get(r, index, "views")) ?? 0
      const reposts = toNumber(get(r, index, "reposts")) ?? 0

      const dViews = prev ? Math.max(0, views - (toNumber(get(prev, index, "views")) ?? 0)) : (toNumber(get(r, index, "delta_views")) ?? 0)
      const dReposts = prev ? Math.max(0, reposts - (toNumber(get(prev, index, "reposts")) ?? 0)) : (toNumber(get(r, index, "delta_reposts")) ?? 0)

      points.push({
        postId,
        bucketTs: get(r, index, "bucket_ts"),
        ageMinutes: age,
        dViews,
        dReposts,
      })
      prev = r
    }
    series.push({ postId, points })
  }

  return series
}

function buildDataset(series, k, lambda, targetKey) {
  const X = []
  const y = []
  const meta = []

  for (const s of series) {
    const pts = s.points
    for (let i = k; i < pts.length; i++) {
      const age = pts[i].ageMinutes
      if (age == null) continue

      const features = [Math.exp(-lambda * age)]
      for (let lag = 1; lag <= k; lag++) features.push(pts[i - lag].dReposts)

      X.push(features)
      y.push(pts[i][targetKey])
      meta.push({ postId: s.postId, bucketTs: pts[i].bucketTs })
    }
  }

  return { X, y, meta }
}

function holdoutSplit(meta, y, X) {
  const byPostIdx = new Map()
  for (let i = 0; i < meta.length; i++) {
    const list = byPostIdx.get(meta[i].postId) ?? []
    list.push(i)
    byPostIdx.set(meta[i].postId, list)
  }

  const trainIdx = []
  const testIdx = []

  for (const idxs of byPostIdx.values()) {
    const cut = Math.max(1, Math.floor(idxs.length * 0.8))
    for (let j = 0; j < idxs.length; j++) {
      if (j < cut) trainIdx.push(idxs[j])
      else testIdx.push(idxs[j])
    }
  }

  const pick = (idxs, arr) => idxs.map((i) => arr[i])
  const pickRows = (idxs, mat) => idxs.map((i) => mat[i])

  return {
    XTrain: pickRows(trainIdx, X),
    yTrain: pick(trainIdx, y),
    XTest: pickRows(testIdx, X),
    yTest: pick(testIdx, y),
  }
}

function nonZeroRate(values) {
  if (values.length === 0) return 0
  let nz = 0
  for (const v of values) if (v !== 0) nz++
  return nz / values.length
}

function trainModel(series, k, alpha, targetKey) {
  const lambdas = logSpace(0.0005, 0.08, 40)
  let best = null

  for (const lambda of lambdas) {
    const { X, y, meta } = buildDataset(series, k, lambda, targetKey)
    if (y.length < Math.max(20, k * 5)) continue

    const { XTrain, yTrain, XTest, yTest } = holdoutSplit(meta, y, X)
    const w = fitRidge(XTrain, yTrain, alpha)
    if (!w) continue

    const yPred = XTest.map((row) => row.reduce((sum, v, i) => sum + v * w[i], 0))
    const score = rmse(yTest, yPred)
    const trainNonZeroRate = nonZeroRate(yTrain)
    const testNonZeroRate = nonZeroRate(yTest)

    if (!best || score < best.rmse) {
      best = {
        lambda,
        weights: w,
        rmse: score,
        nTrain: yTrain.length,
        nTest: yTest.length,
        train_nonzero_rate: trainNonZeroRate,
        test_nonzero_rate: testNonZeroRate,
      }
    }
  }

  return best
}

const args = parseArgs(process.argv)
const csvText = fs.readFileSync(args.csv, "utf8")
const rows = parseCsvRFC4180(csvText)
if (rows.length === 0) throw new Error("Empty CSV")

const header = rows[0]
const index = buildIndex(header)
const records = rows.slice(1).filter((r) => r.some((cell) => cell !== ""))

for (const col of ["post_id", "bucket_ts", "age_minutes", "views", "reposts"]) {
  if (!index.has(col)) throw new Error(`Missing required column: ${col}`)
}

const series = buildSeries(records, index)

const exposure = trainModel(series, args.k, args.alpha, "dViews")
const repost = trainModel(series, args.k, args.alpha, "dReposts")

if (!exposure) throw new Error("Not enough data to train exposure model")
if (!repost) throw new Error("Not enough data to train repost model")

const params = {
  bucket_minutes: 15,
  k: args.k,
  alpha: args.alpha,
  exposure_model: {
    lambda: exposure.lambda,
    baseline_weight: exposure.weights[0],
    beta_repost_lags: exposure.weights.slice(1),
    rmse: exposure.rmse,
    n_train: exposure.nTrain,
    n_test: exposure.nTest,
    train_nonzero_rate: exposure.train_nonzero_rate,
    test_nonzero_rate: exposure.test_nonzero_rate,
  },
  repost_model: {
    lambda: repost.lambda,
    baseline_weight: repost.weights[0],
    w_repost_lags: repost.weights.slice(1),
    rmse: repost.rmse,
    n_train: repost.nTrain,
    n_test: repost.nTest,
    train_nonzero_rate: repost.train_nonzero_rate,
    test_nonzero_rate: repost.test_nonzero_rate,
  },
}

console.log(JSON.stringify(params, null, 2))

if (args.out) {
  fs.mkdirSync("tools/diffusion-training", { recursive: true })
  fs.writeFileSync(args.out, JSON.stringify(params, null, 2))
}
