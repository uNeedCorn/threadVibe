/**
 * OAuth State 簽章模組
 * 使用 HMAC-SHA256 簽章防止 state 被竄改
 */

const OAUTH_STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET');

// State 有效期（5 分鐘）
const STATE_EXPIRY_MS = 5 * 60 * 1000;

export interface StatePayload {
  workspaceId: string;
  userId: string;
  nonce: string;
  transferId?: string; // 用於 Token 移轉流程
}

interface SignedState {
  payload: StatePayload;
  exp: number;
  sig: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 產生 HMAC-SHA256 簽章
 */
async function hmacSign(data: string): Promise<string> {
  if (!OAUTH_STATE_SECRET) {
    throw new Error('OAUTH_STATE_SECRET not configured');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(OAUTH_STATE_SECRET);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * 驗證 HMAC-SHA256 簽章
 */
async function hmacVerify(data: string, signature: string): Promise<boolean> {
  const expectedSig = await hmacSign(data);
  return constantTimeEqual(expectedSig, signature);
}

/**
 * 建立簽章的 state
 */
export async function signState(payload: StatePayload): Promise<string> {
  const exp = Date.now() + STATE_EXPIRY_MS;
  const dataToSign = JSON.stringify({ payload, exp });
  const sig = await hmacSign(dataToSign);

  const state: SignedState = { payload, exp, sig };
  return btoa(JSON.stringify(state));
}

/**
 * 驗證並解析 state
 */
export async function verifyState(stateStr: string): Promise<StatePayload> {
  const { payload } = await verifyStateDetailed(stateStr);
  return payload;
}

export async function verifyStateDetailed(
  stateStr: string
): Promise<{ payload: StatePayload; exp: number; stateHash: string }> {
  let state: SignedState;

  try {
    state = JSON.parse(atob(stateStr));
  } catch {
    throw new Error('Invalid state format');
  }

  // 驗證過期
  if (Date.now() > state.exp) {
    throw new Error('State expired');
  }

  // 驗證簽章
  const dataToVerify = JSON.stringify({ payload: state.payload, exp: state.exp });
  const isValid = await hmacVerify(dataToVerify, state.sig);

  if (!isValid) {
    throw new Error('Invalid state signature');
  }

  const stateHash = await sha256Hex(stateStr);
  return { payload: state.payload, exp: state.exp, stateHash };
}
