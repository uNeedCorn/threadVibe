/**
 * 回填 snapshot 比率值
 *
 * 使用方式：
 * cd frontend && SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/backfill-snapshot-rates.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://emlclhiaqbkuvztlkfbh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('請設定 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function backfillSnapshotRates() {
  console.log('回填 snapshot 比率值...');

  const PAGE_SIZE = 1000;
  let offset = 0;
  let totalUpdated = 0;
  let hasMore = true;

  while (hasMore) {
    // 取得尚未設定比率的 snapshots（views > 0 且 engagement_rate = 0）
    const { data: snapshots, error } = await supabase
      .from('workspace_threads_post_metrics')
      .select('id, views, likes, replies, reposts, quotes, shares')
      .eq('engagement_rate', 0)
      .gt('views', 0)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!snapshots || snapshots.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`處理第 ${offset + 1} - ${offset + snapshots.length} 筆...`);

    for (const snap of snapshots) {
      const { views, likes, replies, reposts, quotes, shares } = snap;

      const engagementRate = ((likes + replies + reposts + quotes) / views) * 100;
      const replyRate = (replies / views) * 100;

      const spreadScore = reposts * 3 + quotes * 2.5 + (shares || 0) * 3;
      const engagementScore = likes + replies * 1.5;
      const viralityScore = ((spreadScore * 2 + engagementScore) / views) * 100;

      const { error: updateError } = await supabase
        .from('workspace_threads_post_metrics')
        .update({
          engagement_rate: Math.round(engagementRate * 10000) / 10000,
          reply_rate: Math.round(replyRate * 10000) / 10000,
          virality_score: Math.round(viralityScore * 100) / 100,
        })
        .eq('id', snap.id);

      if (!updateError) totalUpdated++;
    }

    // 因為我們查詢的是 engagement_rate = 0 的記錄，更新後就不會再查到
    // 所以不需要增加 offset，每次都從頭開始查
    hasMore = snapshots.length === PAGE_SIZE;
  }

  console.log('總共更新', totalUpdated, '筆 snapshots');
}

backfillSnapshotRates().catch(console.error);
