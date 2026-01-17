/**
 * 匯入歷史資料腳本
 *
 * 使用方式：
 * cd frontend && npx tsx ../scripts/import-historical-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// 從環境變數讀取（必填）
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('請設定環境變數：NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CSV 解析函式
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i]?.trim() || '';
    });
    return row;
  });
}

async function main() {
  console.log('=== 開始匯入歷史資料 ===\n');

  // 1. 查詢目前的 workspace_threads_account
  console.log('1. 查詢目前的帳號資訊...');
  const { data: accounts, error: accountError } = await supabase
    .from('workspace_threads_accounts')
    .select('id, workspace_id, threads_user_id, username')
    .eq('is_active', true)
    .limit(1);

  if (accountError || !accounts || accounts.length === 0) {
    console.error('找不到有效的 Threads 帳號:', accountError);
    process.exit(1);
  }

  const account = accounts[0];
  console.log(`   找到帳號: @${account.username} (ID: ${account.id})`);
  console.log(`   Workspace ID: ${account.workspace_id}`);
  console.log(`   Threads User ID: ${account.threads_user_id}\n`);

  // 2. 匯入 Account Insights
  console.log('2. 匯入帳號 Insights...');
  const insightsPath = path.join(__dirname, '../../rawdata/threads_account_insights_rows.csv');

  if (fs.existsSync(insightsPath)) {
    const insightsContent = fs.readFileSync(insightsPath, 'utf-8');
    const insightsRows = parseCSV(insightsContent);

    console.log(`   找到 ${insightsRows.length} 筆 insights 資料`);

    // 轉換資料格式
    const insightsToInsert = insightsRows.map(row => ({
      workspace_threads_account_id: account.id,
      followers_count: parseInt(row.followers_count) || 0,
      profile_views: parseInt(row.profile_views) || 0,
      likes_count_7d: parseInt(row.likes_count_7d) || 0,
      views_count_7d: parseInt(row.views_count_7d) || 0,
      demographics: row.follower_demographics ? JSON.parse(row.follower_demographics) : null,
      captured_at: row.snapshot_at,
    }));

    // 批次匯入
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < insightsToInsert.length; i += batchSize) {
      const batch = insightsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('workspace_threads_account_insights')
        .insert(batch);

      if (insertError) {
        console.error(`   批次 ${i / batchSize + 1} 匯入失敗:`, insertError.message);
      } else {
        insertedCount += batch.length;
        console.log(`   已匯入 ${insertedCount}/${insightsRows.length} 筆`);
      }
    }

    console.log(`   帳號 Insights 匯入完成: ${insertedCount} 筆\n`);
  } else {
    console.log('   找不到 insights CSV 檔案，跳過\n');
  }

  // 3. 匯入 Post Metrics
  console.log('3. 匯入貼文 Metrics...');
  const metricsPath = path.join(__dirname, '../../rawdata/threads_post_metrics_snapshots_rows (1).csv');

  if (fs.existsSync(metricsPath)) {
    const metricsContent = fs.readFileSync(metricsPath, 'utf-8');
    const metricsRows = parseCSV(metricsContent);

    console.log(`   找到 ${metricsRows.length} 筆 metrics 資料`);

    // 收集所有唯一的 threads_post_id
    const uniquePostIds = [...new Set(metricsRows.map(row => row.threads_post_id))];
    console.log(`   共有 ${uniquePostIds.length} 個不同的貼文\n`);

    // 3a. 查詢或建立貼文
    console.log('3a. 建立缺失的貼文記錄...');
    const { data: existingPosts } = await supabase
      .from('workspace_threads_posts')
      .select('id, threads_post_id')
      .eq('workspace_threads_account_id', account.id);

    const existingPostMap = new Map<string, string>();
    existingPosts?.forEach(post => {
      existingPostMap.set(post.threads_post_id, post.id);
    });

    console.log(`   現有貼文: ${existingPostMap.size} 個`);

    // 建立缺失的貼文
    const missingPostIds = uniquePostIds.filter(id => !existingPostMap.has(id));
    if (missingPostIds.length > 0) {
      console.log(`   需要建立 ${missingPostIds.length} 個貼文記錄`);

      const postsToCreate = missingPostIds.map(threadsPostId => ({
        workspace_threads_account_id: account.id,
        threads_post_id: threadsPostId,
        text: '[匯入的歷史貼文]',
        media_type: 'TEXT',
        published_at: new Date().toISOString(),
      }));

      const { data: createdPosts, error: createError } = await supabase
        .from('workspace_threads_posts')
        .insert(postsToCreate)
        .select('id, threads_post_id');

      if (createError) {
        console.error('   建立貼文失敗:', createError.message);
      } else {
        createdPosts?.forEach(post => {
          existingPostMap.set(post.threads_post_id, post.id);
        });
        console.log(`   已建立 ${createdPosts?.length || 0} 個貼文記錄`);
      }
    }

    // 3b. 匯入 metrics
    console.log('\n3b. 匯入貼文 Metrics...');
    const metricsToInsert = metricsRows
      .filter(row => existingPostMap.has(row.threads_post_id))
      .map(row => ({
        workspace_threads_post_id: existingPostMap.get(row.threads_post_id),
        views: parseInt(row.views) || 0,
        likes: parseInt(row.likes) || 0,
        replies: parseInt(row.replies) || 0,
        reposts: parseInt(row.reposts) || 0,
        quotes: parseInt(row.quotes) || 0,
        shares: parseInt(row.shares) || 0,
        captured_at: row.snapshot_at,
      }));

    // 批次匯入
    const batchSize = 100;
    let insertedMetricsCount = 0;

    for (let i = 0; i < metricsToInsert.length; i += batchSize) {
      const batch = metricsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('workspace_threads_post_metrics')
        .insert(batch);

      if (insertError) {
        console.error(`   批次 ${i / batchSize + 1} 匯入失敗:`, insertError.message);
      } else {
        insertedMetricsCount += batch.length;
        if (insertedMetricsCount % 1000 === 0 || insertedMetricsCount === metricsToInsert.length) {
          console.log(`   已匯入 ${insertedMetricsCount}/${metricsToInsert.length} 筆`);
        }
      }
    }

    console.log(`   貼文 Metrics 匯入完成: ${insertedMetricsCount} 筆\n`);
  } else {
    console.log('   找不到 metrics CSV 檔案，跳過\n');
  }

  console.log('=== 匯入完成 ===');
}

main().catch(console.error);
