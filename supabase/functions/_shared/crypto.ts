/**
 * 加密解密工具
 * 使用 AES-GCM 256-bit 加密
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const V2_PREFIX = 'v2:';
const V1_SALT = 'threadsvibe-salt';

/**
 * 取得加密 secret
 */
function getEncryptionSecret(): string {
  const secret = Deno.env.get('ENCRYPTION_SECRET');
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET not configured');
  }
  return secret;
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密字串
 *
 * v2 格式：v2:<base64(salt[16] + iv[12] + ciphertext)>
 * v1 格式：<base64(iv[12] + ciphertext)>
 */
export async function encrypt(plaintext: string): Promise<string> {
  const secret = getEncryptionSecret();
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(secret, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // 合併 salt + IV + 密文，使用 base64 編碼
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return `${V2_PREFIX}${btoa(String.fromCharCode(...combined))}`;
}

/**
 * 解密字串
 */
export async function decrypt(encrypted: string): Promise<string> {
  const secret = getEncryptionSecret();

  if (encrypted.startsWith(V2_PREFIX)) {
    const raw = encrypted.slice(V2_PREFIX.length);
    const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

    const key = await deriveKey(secret, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  }

  // v1：固定 salt + (iv + ciphertext)
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const key = await deriveKey(secret, new TextEncoder().encode(V1_SALT));

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * 常數時間字串比較
 * 防止 Timing Attack，用於驗證 secret/token
 *
 * @param a 第一個字串
 * @param b 第二個字串
 * @returns 是否相等
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
