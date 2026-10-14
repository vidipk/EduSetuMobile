import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';

import { accessTokenStore } from '@/auth/access-token';

const cacheDirectory = new Directory(Paths.cache, 'edusetu-downloads');

export function sanitizeFilename(filename: string) {
  const cleaned = filename.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned || 'download';
}

export async function downloadProtectedFile({ url, filename }: { url: string; filename: string }) {
  const accessToken = accessTokenStore.get();
  if (!accessToken) throw new Error('You need to sign in before downloading this file.');
  if (!cacheDirectory.exists) cacheDirectory.create({ intermediates: true });
  const target = new File(cacheDirectory, sanitizeFilename(filename));
  return File.downloadFileAsync(url, target, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function shareLocalFile(file: File) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri);
}
