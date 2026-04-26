import fs from 'node:fs';
import path from 'node:path';

export const readJsonFile = async (filePath) => {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(clean);
};

export const safeReadJsonFile = async (filePath) => {
  try {
    return await readJsonFile(filePath);
  } catch {
    return null;
  }
};

export const fileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const statSafe = async (filePath) => {
  try {
    return await fs.promises.stat(filePath);
  } catch {
    return null;
  }
};

export const listFilesSafe = async (dirPath, filterFn = () => true) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && filterFn(entry)).map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
};

export const withTimeout = async (promise, timeoutMs, label = 'timeout') => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
};

export const toIso = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const toFileUrlPath = (filePath) => `/api/runtime/files?path=${encodeURIComponent(filePath)}`;

export const isImageFile = (name = '') => /\.(png|jpg|jpeg|webp|gif)$/i.test(name);
export const isVideoFile = (name = '') => /\.(mp4|webm|mov|avi|mkv)$/i.test(name);

export const normalizeOutputKind = (filePath = '') => {
  if (isImageFile(filePath)) return 'image';
  if (isVideoFile(filePath)) return 'video';
  return 'unknown';
};

export const parseManifestTimestamp = (filename = '') => {
  const match = filename.match(/^manifest_(\d{8})_(\d{6})\.json$/i);
  if (!match) return undefined;
  const [, ymd, hms] = match;
  const date = new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
    Number(hms.slice(0, 2)),
    Number(hms.slice(2, 4)),
    Number(hms.slice(4, 6)),
  );
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const writeJsonFile = async (filePath, payload) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

export const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
};
