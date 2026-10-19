import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { learningApi } from '@/api/academics/learning';

const ALLOWED_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']);

export type OpenVideoOutcome = 'app' | 'browser' | 'blocked' | 'failed';

export function isYoutubeWatchUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export interface OpenVideoDeps {
  openUrl: (url: string) => Promise<unknown>;
  openBrowser: (url: string) => Promise<unknown>;
  record: (videoId: string) => Promise<unknown>;
}

const defaultDeps: OpenVideoDeps = {
  openUrl: (url) => Linking.openURL(url),
  openBrowser: (url) => WebBrowser.openBrowserAsync(url),
  record: (videoId) => learningApi.openVideo(videoId),
};

/**
 * Hands the lecture to the real YouTube app (the OS routes https watch links there when it is
 * installed) and falls back to the browser. EduSetu never embeds, downloads or re-streams the video.
 * Recording the open is best-effort and is not treated as proof of watching.
 */
export async function openLecture(video: { id: string; watchUrl: string }, deps: OpenVideoDeps = defaultDeps): Promise<OpenVideoOutcome> {
  if (!isYoutubeWatchUrl(video.watchUrl)) return 'blocked';
  void deps.record(video.id).catch(() => undefined);
  try {
    await deps.openUrl(video.watchUrl);
    return 'app';
  } catch {
    try {
      await deps.openBrowser(video.watchUrl);
      return 'browser';
    } catch {
      return 'failed';
    }
  }
}
