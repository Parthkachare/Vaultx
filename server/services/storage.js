const BUCKET = 'vaultx-papers';

function storageConfig() {
  const baseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for private paper storage.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error('SUPABASE_URL must be an absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('SUPABASE_URL must be an absolute HTTP(S) URL without embedded credentials.');
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), serviceKey };
}

function assertConfigured() {
  storageConfig();
}

function objectUrl(baseUrl, objectPath) {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/${BUCKET}/${encodedPath}`;
}

async function requestStorage(method, objectPath, body) {
  const { baseUrl, serviceKey } = storageConfig();
  const response = await fetch(objectUrl(baseUrl, objectPath), {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      ...(body ? { 'content-type': 'application/octet-stream', 'x-upsert': 'false' } : {}),
    },
    body,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase Storage ${method} failed (${response.status}): ${detail}`);
  }
  return response;
}

async function uploadEncrypted(objectPath, encryptedBytes) {
  await requestStorage('POST', objectPath, encryptedBytes);
}

async function downloadEncrypted(objectPath) {
  const response = await requestStorage('GET', objectPath);
  return Buffer.from(await response.arrayBuffer());
}

async function removeEncrypted(objectPath) {
  await requestStorage('DELETE', objectPath);
}

module.exports = { assertConfigured, uploadEncrypted, downloadEncrypted, removeEncrypted };
