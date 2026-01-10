/**
 * 重新計算 Layer 2 Deltas
 *
 * 從 Layer 1 Snapshots 計算增量變化
 *
 * 使用方式：
 * cd frontend && npx tsx scripts/recalculate-deltas.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://emlclhiaqbkuvztlkfbh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('請設定 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function recalculateAccountInsightsDeltas() {
  console.log('=== 重新計算帳號 Insights Deltas ===\n');

  // 1. 取得所有帳號
  const { data: accounts, error: accountsError } = await supabase
    .from('workspace_threads_accounts')
    .select('id, username')
    .eq('is_active', true);

  if (accountsError || !accounts) {
    console.error('查詢帳號失敗:', accountsError);
    return;
  }

  console.log(`找到 ${accounts.length} 個帳號\n`);

  for (const account of accounts) {
    console.log(`處理帳號: @${account.username}`);

    // 2. 取得該帳號的所有 insights，按時間排序
    const { data: insights, error: insightsError } = await supabase
      .from('workspace_threads_account_insights')
      .select('*')
      .eq('workspace_threads_account_id', account.id)
      .order('captured_at', { ascending: true });

    if (insightsError || !insights || insights.length < 2) {
      console.log(`   跳過 - 資料不足 (${insights?.length || 0} 筆)\n`);
      continue;
    }

    console.log(`   找到 ${insights.length} 筆 snapshots`);

    // 3. 刪除現有的 deltas（標記為 recalculated）
    const { error: deleteError } = await supabase
      .from('workspace_threads_account_insights_deltas')
      .delete()
      .eq('workspace_threads_account_id', account.id);

    if (deleteError) {
      console.error(`   刪除舊 deltas 失敗:`, deleteError.message);
      continue;
    }

    // 4. 計算 deltas
    const deltas = [];
    for (let i = 1; i < insights.length; i++) {
      const prev = insights[i - 1];
      const curr = insights[i];

      deltas.push({
        workspace_threads_account_id: account.id,
        period_start: prev.captured_at,
        period_end: curr.captured_at,
        followers_delta: (curr.followers_count || 0) - (prev.followers_count || 0),
        profile_views_delta: (curr.profile_views || 0) - (prev.profile_views || 0),
        likes_count_7d_delta: (curr.likes_count_7d || 0) - (prev.likes_count_7d || 0),
        views_count_7d_delta: (curr.views_count_7d || 0) - (prev.views_count_7d || 0),
        is_recalculated: true,
      });
    }

    // 5. 批次插入 deltas
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < deltas.length; i += batchSize) {
      const batch = deltas.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('workspace_threads_account_insights_deltas')
        .insert(batch);

      if (insertError) {
        console.error(`   批次插入失敗:`, insertError.message);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`   建立 ${insertedCount} 筆 deltas\n`);
  }
}

async function recalculatePostMetricsDeltas() {
  console.log('=== 重新計算貼文 Metrics Deltas ===\n');

  // 1. 取得所有有 metrics 的貼文
  const { data: posts, error: postsError } = await supabase
    .from('workspace_threads_posts')
    .select('id, threads_post_id, text');

  if (postsError || !posts) {
    console.error('查詢貼文失敗:', postsError);
    return;
  }

  console.log(`找到 ${posts.length} 個貼文\n`);

  let totalDeltas = 0;

  for (const post of posts) {
    // 2. 取得該貼文的所有 metrics，按時間排序
    const { data: metrics, error: metricsError } = await supabase
      .from('workspace_threads_post_metrics')
      .select('*')
      .eq('workspace_threads_post_id', post.id)
      .order('captured_at', { ascending: true });

    if (metricsError || !metrics || metrics.length < 2) {
      continue;
    }

    // 3. 刪除現有的 deltas
    await supabase
      .from('workspace_threads_post_metrics_deltas')
      .delete()
      .eq('workspace_threads_post_id', post.id);

    // 4. 計算 deltas
    const deltas = [];
    for (let i = 1; i < metrics.length; i++) {
      const prev = metrics[i - 1];
      const curr = metrics[i];

      deltas.push({
        workspace_threads_post_id: post.id,
        period_start: prev.captured_at,
        period_end: curr.captured_at,
        views_delta: (curr.views || 0) - (prev.views || 0),
        likes_delta: (curr.likes || 0) - (prev.likes || 0),
        replies_delta: (curr.replies || 0) - (prev.replies || 0),
        reposts_delta: (curr.reposts || 0) - (prev.reposts || 0),
        quotes_delta: (curr.quotes || 0) - (prev.quotes || 0),
        shares_delta: (curr.shares || 0) - (prev.shares || 0),
        is_recalculated: true,
      });
    }

    // 5. 批次插入 deltas
    if (deltas.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < deltas.length; i += batchSize) {
        const batch = deltas.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('workspace_threads_post_metrics_deltas')
          .insert(batch);

        if (insertError) {
          console.error(`   貼文 ${post.threads_post_id} 插入失敗:`, insertError.message);
        } else {
          totalDeltas += batch.length;
        }
      }
    }
  }

  console.log(`貼文 Metrics Deltas 建立完成: ${totalDeltas} 筆\n`);
}

async function main() {
  console.log('========================================');
  console.log('  重新計算 Layer 2 Deltas');
  console.log('========================================\n');

  await recalculateAccountInsightsDeltas();
  await recalculatePostMetricsDeltas();

  console.log('========================================');
  console.log('  完成！');
  console.log('========================================');
}

main().catch(console.error);
