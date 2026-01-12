# 社群擴散的「傳染病模型化」筆記（15 分鐘時間窗）

## 目的

把 Threads 貼文擴散拆成「曝光（接觸）→互動（採納）→轉發（傳播）」三層，建立一套可用於：

- 早期判斷貼文是否正在加速擴散
- 在缺少 `shares` 指標時，推估「出圈/推薦流量」訊號
- 將指標改寫成可計算、可落地、可監控的時間序列模型

本文件是獨立的演算法議題整理，可搭配既有指標使用（例如 `virality-score.md`）。

---

## 背景直覺（原始想法）

- 使用「傳染病擴散」類比社群擴散
- 使用者的 `followers_count` 視為可接觸人數（contactable）
- `like/留言` 視為「被感染」
- 互動者本身也會再把感染擴散出去：互動 × 權重 × 互動者 followers
- `轉發` 被視為「出圈訊號」或更強的擴散事件
- 用互動成長率來預測擴散幅度

---

## 校正重點（避免系統性高估）

### 1) `followers_count ≠ 可接觸人數`

`followers_count` 只能近似「理論上限」，實際「接觸」更接近 `views`（曝光/看到）。

把 followers 直接乘上衰減並加總，常見會高估，原因包含：

- **可見率（view rate）**：追蹤者未必會在時間窗內看到
- **受眾重疊（overlap）**：不同互動者的追蹤者高度重疊，不能線性加總
- **演算法放大/抑制**：大量曝光可能來自推薦而非社交圖譜

因此在資料可得時，應以 `views` 當「接觸/曝光」主體。

### 2) `like/留言 = 採納`，但不等於 `傳播`

`like/留言` 可以視為「已採納/已反應」，但它通常不會直接把內容帶給新受眾；相對地：

- `repost/quote` 更接近「具傳染性的人」（會造成下一輪新增曝光/互動）
- `like/留言` 更像提高被推薦的機率（弱傳播、間接）

### 3) 重複互動不是「重複感染」

同一使用者「回來再互動」比較像多次曝露造成採納機率上升，而不是每次都能重新帶來一整批新的可接觸人數。

---

## 可用資料（假設）

以每篇貼文的 15 分鐘時間序列為主，至少包含：

- `timestamp`（對齊到 15 分鐘 bucket）
- `views`
- `likes`
- `replies`
- `reposts`
- `quotes`

註：實務上 `shares` 常拿不到（即使文件/介面宣稱存在），本筆記提供無 `shares` 的替代推估方法。

### 範例原始資料（Raw Data）

本 repo 已放入一份 15 分鐘 bucket 的貼文時間序列匯出，可用來驗證本文件的計算與判讀：

- `docs/06-metrics/diffusion-modeling rawdata/README.md`
- `docs/06-metrics/diffusion-modeling rawdata/Supabase Snippet Workspace Row-Level Access Policies.csv`

---

## 數據形式：累積值（總數） vs 每窗增量（delta）

### 建議：以「累積值」作為 Single Source of Truth

即使 API/資料表同時提供兩者，也建議：

1. 以累積值 `X_t`（總數）作為主資料
2. 自行計算每窗增量 `ΔX_t`
3. 使用原生 delta 僅作 QA（檢查回填/延遲/不一致）

計算：

```
ΔX_t = max(0, X_t - X_{t-1})
```

> 若出現回填或重算，可能會短暫出現負增量；建議先截斷為 0，並在資料品質層面另行標記。

---

## 三層對應：接觸 / 採納 / 傳播

### 接觸（Exposure）

- 以 `views` 代表「接觸量」
- 時間序列使用 `Δviews_t`

### 採納（Adoption）

- 以 `likes + replies`（或更細分）代表採納
- 時間序列使用 `Δengagement_t`

### 傳播（Transmission）

- 以 `reposts`（必要時含 `quotes`）代表傳播事件
- 時間序列使用 `Δreposts_t`、`Δquotes_t`

---

## 可直接落地的 15 分鐘窗核心指標（不用互動者 followers）

令每窗增量：

- `V_t = Δviews_t`
- `L_t = Δlikes_t`
- `P_t = Δreplies_t`
- `R_t = Δreposts_t`
- `Q_t = Δquotes_t`

### 採納率（互動轉換）

```
p_engage(t) = (L_t + P_t + R_t + Q_t) / V_t
```

（也可拆成 `p_reply(t)=P_t/V_t`、`p_repost(t)=R_t/V_t` 等）

### 傳播率（轉發轉換）

```
p_repost(t) = R_t / V_t
```

> 當 `V_t=0` 時可跳過該窗、或以 0 處理並在圖表上斷點顯示。

---

## 「出圈/推薦」訊號：用看不見的 share，改用「解釋不了的曝光（lift）」做代理

在缺少 `shares` 且無法得知 Non-followers ratio 的情況下，可把每窗新增曝光拆成三部分：

1. 自然衰退帶來的曝光（貼文生命週期）
2. repost/quote 造成的次級曝光
3. 其他來源（推薦、外部分享、私訊等不可觀測）

以離散時間的分解表示：

```
V_t ≈ base(age_t) + Σ_{k=1..K} β_k · R_{t-k} + lift_t
```

- `base(age_t)`：貼文隨時間自然衰退的曝光基線（可先用指數衰減或用前幾窗擬合）
- `β_k`：過去第 k 個時間窗的 repost 對本窗曝光的貢獻
- `lift_t`：殘差（長期為正或突然暴增時，常見可視為「推薦/出圈」代理訊號）

判讀建議：

- `V_t` 暴增但 `R_t` 沒同步上升 → 往往是推薦/外部分享在推
- `lift_t` 持續偏大 → 代表非社交圖譜的流量佔比提升

---

## 「擴散是否加速」：用 repost 當感染事件估類 R 值

把每窗新增 repost 視為「感染事件」：

```
I_t = R_t
```

使用簡化的再生數近似（離散、加權回看）：

```
R̂_t = I_t / Σ_{k=1..K} w_k · I_{t-k}
```

- `w_k`：世代間隔（從一次轉發到後續轉發的時間分佈）的近似權重
- `R̂_t > 1`：擴散加速
- `R̂_t < 1`：擴散衰退

在沒有足夠歷史資料前，可先用單調遞減權重（例如最近 3–6 窗）做啟動版本；後續再用大量貼文回推 `w_k`。

---

## 驗證方式（用本 repo 的 CSV）

本 repo 已包含一份 15 分鐘 bucket 的貼文時間序列 CSV，可先做「數據一致性」驗證，再做「模型訊號」驗證。

### A. 數據一致性（必做）

- 累積值單調性：同一 `post_id` 的 `views/likes/replies/reposts/quotes` 不應倒退
- delta 一致：`delta_*` 應與「累積值差分」一致（若不一致，多半是回填/延遲上報）
- 指標可重算：
  - `virality_score` 應符合 `virality-score.md` 的公式
  - `delta_engagement_rate` 應符合 `((Δ互動)/Δviews)*100`（若 `Δviews=0` 則為 0）

### B. 訊號驗證（建議）

- `lift` 代理：找出 `Δviews` 暴增但 `Δreposts=0` 的時間窗，作為推薦/外部分享候選

### 本機腳本

- `docs/06-metrics/diffusion-modeling rawdata/README.md`
- `docs/06-metrics/diffusion-modeling rawdata/validate.mjs`

---

## 與既有指標的關係

- `virality-score.md`：做「加權互動 / views」的橫切評分
- 本文件：做「隨時間演進」的擴散建模與不可觀測訊號（`lift`、`R̂_t`）

兩者可同時存在：

- `Virality Score` 用於排序/警報門檻
- `lift_t` 與 `R̂_t` 用於解釋「為什麼突然爆」與「接下來是否會續爆」

---

## 限制與注意事項

- `views` 可能包含重複曝光，非 unique reach
- 無法直接量化「互動者 followers 帶來的新增觸及」，因缺少互動者層級資料與受眾重疊資訊
- `shares` 缺失時只能用 `lift` 代理，無法精準歸因
- 時間序列噪音高，建議對 `V_t`、`I_t` 做移動平均或中位數平滑後再做判讀

---

## 下一步（若要產品化）

- 固定 15 分鐘 bucket 對齊與缺值補齊策略
- 以歷史貼文回推：
  - `base(age)` 的通用形狀（分內容類型/帳號層級）
  - `β_k`、`w_k` 的合理範圍
- 將 `lift`、`R̂_t` 接到「早期爆紅偵測」與通知機制

### 外部訓練（Offline）

若要把「參數回推/訓練」從產品 runtime 拆出去，可使用本 repo 的離線訓練腳本：

- `tools/diffusion-training/README.md`
- `tools/diffusion-training/train.mjs`
