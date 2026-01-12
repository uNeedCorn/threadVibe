# 擴散模型理論對比與改進建議

> 本文件比較現有 `tools/diffusion-training/` 實作與傳染病模型理論，並提出具體改進方向。

## 1. 現有實作分析

### 1.1 模型架構 (`train.mjs`)

現有模型使用 **Ridge Regression** 擬合兩個目標：

| 模型 | 目標變數 | 特徵向量 |
|------|----------|----------|
| Exposure Model | `ΔViews_t` | `[exp(-λ × age), ΔR_{t-1}, ..., ΔR_{t-k}]` |
| Repost Model | `ΔReposts_t` | `[exp(-λ × age), ΔR_{t-1}, ..., ΔR_{t-k}]` |

數學表示：
```
ΔV_t ≈ β_0 × exp(-λ × age_t) + Σ_{j=1}^{k} β_j × ΔR_{t-j}
ΔR_t ≈ w_0 × exp(-λ × age_t) + Σ_{j=1}^{k} w_j × ΔR_{t-j}
```

### 1.2 現有優點

| 優點 | 說明 |
|------|------|
| **簡潔** | 線性模型易於解釋、快速訓練 |
| **衰減建模** | 使用 `exp(-λ × age)` 捕捉貼文生命週期自然衰退 |
| **滯後效應** | 考慮過去 k 個時間窗的轉發對當前曝光的影響 |
| **正則化** | Ridge regression 避免過擬合 |

### 1.3 現有問題

| 問題 | 說明 |
|------|------|
| **非線性缺失** | 傳染病模型的 S×I 交互項被簡化為線性 |
| **無 R₀ 估計** | 未明確計算再生數（基本傳染數） |
| **自激勵不足** | Repost model 的自迴歸係數可能為零或負 |
| **無飽和機制** | 未考慮「易感人群耗盡」的上界效應 |
| **網路效應缺失** | 未使用互動者的 `followers_count` |

---

## 2. 傳染病模型理論

### 2.1 經典 SIR 模型

| 狀態 | 社群擴散對應 | 說明 |
|------|--------------|------|
| **S** (Susceptible) | 尚未看到貼文的潛在觀眾 | ≈ `total_reach - views` |
| **I** (Infected) | 已看到且可能傳播 | ≈ 近期互動者 |
| **R** (Recovered) | 已看過但不再傳播 | ≈ 過去觀看者 |

微分方程：
```
dS/dt = -β × S × I / N
dI/dt = β × S × I / N - γ × I
dR/dt = γ × I
```

關鍵參數：
- **β (傳播率)**: 每個感染者單位時間內接觸並感染易感者的平均數
- **γ (恢復率)**: 感染者停止傳播的速率
- **R₀ = β/γ**: 基本再生數，R₀ > 1 表示擴散，R₀ < 1 表示衰退

### 2.2 社群媒體適配：SIS 模型

社群擴散更接近 **SIS 模型**（無永久免疫）：

```
dS/dt = -β × S × I / N + γ × I
dI/dt = β × S × I / N - γ × I
```

理由：用戶可能「忘記」貼文後重新被吸引（重複曝光）。

### 2.3 Hawkes Process（自激勵點過程）

對於社群事件（轉發、互動），**Hawkes Process** 更適合：

```
λ(t) = μ + Σ_{t_i < t} φ(t - t_i)
```

- **μ**: 基線強度（自然曝光率）
- **φ(τ)**: 觸發核函數（過去事件對當前的激發效應）
- **分支比 n**: `n = ∫φ(τ)dτ`，類似 R₀

現有實作的 `β_k` 係數可視為 Hawkes Process 的離散化觸發核。

### 2.4 R₀ 的社群媒體版本

文獻中常用的近似公式：

```
R̂_t = I_t / Σ_{k=1}^{K} w_k × I_{t-k}
```

- `I_t = ΔReposts_t`（當前時間窗新增轉發）
- `w_k`: 世代間隔分佈權重

判讀：
- **R̂ > 1**: 擴散加速（超臨界）
- **R̂ < 1**: 擴散衰退（亞臨界）
- **R̂ ≈ 1**: 臨界點

---

## 3. 差距對比

| 面向 | 現有實作 | 理論建議 | 差距 |
|------|----------|----------|------|
| **模型類型** | 線性迴歸 | 非線性動力學 (SIR/Hawkes) | 高 |
| **再生數** | 無 | R̂_t 時序估計 | 高 |
| **飽和效應** | 無 | S×I/N 項引入上界 | 中 |
| **網路效應** | 無 | followers 加權 | 中 |
| **觸發核形狀** | k 個離散係數 | 連續參數化核函數 | 低 |
| **不確定性** | 無 | 信賴區間/貝葉斯估計 | 低 |

---

## 4. 改進建議

### 4.1 短期改進（可在現有框架內實作）

#### A. 新增 R̂_t 計算

在 `train.mjs` 或產品端加入即時 R̂ 計算：

```javascript
function estimateR(deltaReposts, k = 6) {
  // 簡化權重：指數衰減
  const weights = Array.from({ length: k }, (_, i) => Math.exp(-0.2 * i));
  const normWeights = weights.map(w => w / weights.reduce((a, b) => a + b, 0));

  const I_t = deltaReposts[deltaReposts.length - 1] ?? 0;
  const denominator = deltaReposts.slice(-k - 1, -1)
    .reduce((sum, val, i) => sum + normWeights[i] * val, 0);

  return denominator > 0 ? I_t / denominator : null;
}
```

#### B. Lift 代理訊號強化

現有 `lift_t` 概念可擴展為「非社交圖譜流量佔比」：

```javascript
// 在每個時間窗計算
const predictedViews = beta_0 * Math.exp(-lambda * age)
  + betas.reduce((sum, b, i) => sum + b * laggedReposts[i], 0);
const lift_t = deltaViews - predictedViews;
const liftRatio = lift_t / deltaViews;  // 推薦/外部流量佔比
```

#### C. 加權世代間隔估計

從歷史資料回推 `w_k` 的經驗分佈：

```javascript
// 對每篇貼文，找出「轉發 → 後續轉發」的時間間隔
// 用核密度估計或直方圖建立 w_k
```

### 4.2 中期改進（需擴展模型結構）

#### A. 準 SIS 模型

引入飽和效應的近似：

```javascript
// S_t ≈ followers_count - cumulative_views（理論上限）
const saturationFactor = 1 - cumulativeViews / totalReach;
const adjustedExposure = baseExposure * saturationFactor;
```

#### B. 多尺度時間序列

區分快慢動態：
- **快變量**: `ΔViews`、`ΔReposts`（15 分鐘尺度）
- **慢變量**: 累積互動率、貼文「熱度」趨勢（小時/天尺度）

#### C. 分群模型

不同貼文類型可能有不同傳播動態：
- **低傳播**: 大多數貼文，R̂ 持續 < 1
- **病毒式**: 少數貼文，R̂ 初期 > 1，後衰退
- **長尾**: R̂ ≈ 1，持續緩慢擴散

### 4.3 長期改進（需額外資料/基礎設施）

| 改進 | 需求 | 效益 |
|------|------|------|
| **互動者 followers 加權** | 互動者層級 API | 精確次級曝光估計 |
| **Hawkes Process 擬合** | GPU 訓練 / Stan | 連續時間建模、分支比估計 |
| **貝葉斯參數估計** | PyMC / NumPyro | 不確定性量化 |
| **A/B 實驗驗證** | 實驗框架 | 因果推論、策略優化 |

---

## 5. 優先實作路徑

### Phase 1: 指標擴充（1-2 週）✅ 已完成

1. **R̂_t 計算**: ✅ 使用 Job Queue 架構實作
   - `r_hat_queue` 表：管理待計算貼文
   - `r-hat-calculator` Edge Function：每 5 分鐘批次計算
   - 結果寫入 15m/hourly/daily 表的 `r_hat` 和 `r_hat_status` 欄位
2. **Lift 比例**: ⏳ 待實作
3. **早期爆紅偵測**: ⏳ 待實作（可依 `r_hat_status = 'viral'` 觸發）

### Phase 2: 模型強化（2-4 週）

1. **從歷史資料回推 w_k**: 使用 `tools/diffusion-training/train.mjs` 框架
2. **飽和調整**: 加入 `(1 - views/followers)` 衰減因子
3. **驗證**: 比較預測 vs 實際的 RMSE 改善

### Phase 3: 進階建模（可選）

1. **Hawkes Process 離線訓練**: 使用 Python tick 或 R hawkes 套件
2. **貼文分群**: 依傳播模式分類，使用不同參數集
3. **即時 R̂ 儀表板**: 視覺化貼文擴散動態

---

## 6. 參考文獻

1. **SIR on Networks**: Pastor-Satorras & Vespignani (2001) - 網路上的傳染病動力學
2. **Hawkes Process for Social Media**: Zhao et al. (2015) - 社群事件的自激勵建模
3. **Virality Prediction**: Cheng et al. (2014) - 內容傳播預測的機器學習方法
4. **R₀ Estimation**: Wallinga & Teunis (2004) - 從時間序列估計再生數
5. **NPJ Complexity 2025**: 社群媒體傳播的複雜網路模型

---

## 7. 附錄：現有程式碼參考

### train.mjs 核心邏輯

```javascript
// 特徵建構
const features = [Math.exp(-lambda * age)];  // baseline decay
for (let lag = 1; lag <= k; lag++) {
  features.push(pts[i - lag].dReposts);       // lagged reposts
}

// Ridge regression
const w = fitRidge(XTrain, yTrain, alpha);

// 輸出參數
{
  exposure_model: {
    lambda,                    // 衰減係數
    baseline_weight,           // β_0
    beta_repost_lags: [β_1, ..., β_k]  // repost 影響係數
  },
  repost_model: {
    lambda,
    baseline_weight,           // w_0
    w_repost_lags: [w_1, ..., w_k]     // 自迴歸係數
  }
}
```

### 建議新增：R̂_t 估計函數

```javascript
/**
 * 估計即時再生數 R̂_t
 * @param {number[]} deltaReposts - 過去 k+1 個時間窗的 ΔReposts
 * @param {number[]} weights - 世代間隔權重 [w_1, ..., w_k]
 * @returns {number|null} - R̂_t 或 null（分母為零時）
 */
function estimateReproductionNumber(deltaReposts, weights) {
  const I_t = deltaReposts[deltaReposts.length - 1];
  const denominator = deltaReposts
    .slice(0, -1)
    .reverse()
    .reduce((sum, val, i) => sum + (weights[i] ?? 0) * val, 0);

  if (denominator === 0) return null;
  return I_t / denominator;
}
```
