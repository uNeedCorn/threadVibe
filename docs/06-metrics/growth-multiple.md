# Growth Multiple（曝光成長倍數）

## 指標目的

衡量貼文曝光的成長倍數，用於判斷是否進入演算法推薦池。

---

## 用途

| 場景 | 說明 |
|------|------|
| **推薦池判斷** | 成長倍數高代表進入推薦流 |
| **爆紅預警** | 倍數突然飆升時發出警報 |
| **內容分析** | 找出被演算法推薦的內容特徵 |

---

## 計算公式

```
Growth Multiple = current_views / previous_views
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `current_views` | 當前曝光數 |
| `previous_views` | 前一時間點曝光數 |

### 程式碼範例

```typescript
function calculateGrowthMultiple(
  currentViews: number,
  previousViews: number
): number {
  if (previousViews === 0) return 0;
  return currentViews / previousViews;
}
```

---

## 基準值

| 等級 | 數值 | 說明 |
|------|------|------|
| 穩定 | 1-1.5x | 自然曝光 |
| 小漲 | 1.5-3x | 有成長跡象 |
| 預警 | > 3x | 首小時小爆預警 |
| 爆紅 | > 5x | 進入推薦池 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 單則貼文的曝光成長 |

---

## 觀測時間窗口

| 比較區間 | 用途 |
|----------|------|
| **30 分鐘** | 最即時的成長信號 |
| **1 小時** | 早期爆發判斷 |
| **3 小時** | 趨勢確認 |
| **24 小時** | 日成長率 |

---

## 決議過程

### 討論背景

Growth Multiple 需要比較兩個時間點的數據：
- 需要 L1 Snapshot 提供時間序列資料
- 可以比較任意兩個時間點

### 決議結果

採用 `current_views / previous_views` 計算成長倍數。

### 計算方式

- **即時計算**：從 L1 Snapshot 取得兩個時間點的 views
- **不預存 L2**：移除 L2 Delta 表，成長率由前端或 API 即時計算
- **彈性區間**：可根據需求選擇比較的時間區間

### 顯示顆粒度

- 同步頻率：每 15 分鐘
- 顯示顆粒度：30 分鐘（聚合顯示）

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Early Velocity](early-velocity.md) | 早期互動速度 |
| [Virality Score](virality-score.md) | 病毒傳播潛力 |

---

## 參考資料

- Growth Multiple > 3x：首小時小爆預警
- Growth Multiple > 5x：爆紅跡象
