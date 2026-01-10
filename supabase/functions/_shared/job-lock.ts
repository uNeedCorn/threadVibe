import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface JobLockResult {
  acquired: boolean;
  locked_until: string;
}

export async function acquireJobLock(
  serviceClient: SupabaseClient,
  jobType: string,
  ttlSeconds: number
): Promise<JobLockResult> {
  const { data, error } = await serviceClient.rpc('acquire_system_job_lock', {
    p_job_type: jobType,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return {
    acquired: !!result.acquired,
    locked_until: String(result.locked_until),
  };
}

export async function releaseJobLock(
  serviceClient: SupabaseClient,
  jobType: string
): Promise<void> {
  const { error } = await serviceClient.rpc('release_system_job_lock', {
    p_job_type: jobType,
  });
  if (error) throw error;
}

