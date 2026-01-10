/**
 * 回填 snapshot 比率值 (repost_rate, quote_rate)
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
  console.log('回填 snapshot 比率值 (repost_rate, quote_rate)...');

  // 先取得需要更新的總數
  const { count: totalCount } = await supabase
    .from('workspace_threads_post_metrics')
    .select('*', { count: 'exact', head: true })
    .gt('engagement_rate', 0)
    .eq('repost_rate', 0)
    .gt('reposts', 0); // 只更新有 reposts 的記錄

  console.log(`需要更新 ${totalCount} 筆有 reposts 的記錄`);

  const PAGE_SIZE = 1000;
  let totalUpdated = 0;
  let hasMore = true;

  // 處理有 reposts 的記錄
  while (hasMore) {
    const { data: snapshots, error } = await supabase
      .from('workspace_threads_post_metrics')
      .select('id, views, reposts, quotes')
      .gt('engagement_rate', 0)
      .eq('repost_rate', 0)
      .gt('reposts', 0)
      .limit(PAGE_SIZE);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!snapshots || snapshots.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`處理 ${snapshots.length} 筆有 reposts 的記錄...`);

    for (const snap of snapshots) {
      const { views, reposts, quotes } = snap;
      const repostRate = (reposts / views) * 100;
      const quoteRate = (quotes / views) * 100;

      await supabase
        .from('workspace_threads_post_metrics')
        .update({
          repost_rate: Math.round(repostRate * 10000) / 10000,
          quote_rate: Math.round(quoteRate * 10000) / 10000,
        })
        .eq('id', snap.id);

      totalUpdated++;
    }

    hasMore = snapshots.length === PAGE_SIZE;
  }

  // 處理有 quotes 但沒有 reposts 的記錄
  hasMore = true;
  while (hasMore) {
    const { data: snapshots, error } = await supabase
      .from('workspace_threads_post_metrics')
      .select('id, views, quotes')
      .gt('engagement_rate', 0)
      .eq('quote_rate', 0)
      .gt('quotes', 0)
      .limit(PAGE_SIZE);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!snapshots || snapshots.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`處理 ${snapshots.length} 筆有 quotes 的記錄...`);

    for (const snap of snapshots) {
      const { views, quotes } = snap;
      const quoteRate = (quotes / views) * 100;

      await supabase
        .from('workspace_threads_post_metrics')
        .update({
          quote_rate: Math.round(quoteRate * 10000) / 10000,
        })
        .eq('id', snap.id);

      totalUpdated++;
    }

    hasMore = snapshots.length === PAGE_SIZE;
  }

  console.log('總共更新', totalUpdated, '筆 snapshots');
}

backfillSnapshotRates().catch(console.error);
