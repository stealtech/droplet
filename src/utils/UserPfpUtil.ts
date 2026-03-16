import { fetchJson } from './HttpUtil';

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toUserPfpRecords(payload: unknown, userId: string): Array<Record<string, unknown>> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const direct = (payload as Record<string, unknown>)[userId];
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return [direct as Record<string, unknown>];
    }
  }

  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Object.values(payload as Record<string, unknown>)
      : [];

  return source
    .filter(item => typeof item === 'object' && item !== null)
    .map(item => item as Record<string, unknown>)
    .filter(item => {
      const id = toStringValue(item.userId ?? item.user_id ?? item.userid ?? item.id);
      return id === userId;
    });
}

function extractImageLinks(records: Array<Record<string, unknown>>): string[] {
  const links = new Set<string>();

  for (const record of records) {
    for (const key of ['url', 'image', 'img', 'avatar', 'gif', 'link']) {
      const value = record[key];
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        links.add(value);
      }
    }

    for (const key of ['urls', 'images', 'gifs']) {
      const value = record[key];
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
          links.add(item);
        }
      }
    }
  }

  return [...links];
}

export async function fetchUserPfpMedia(userId: string): Promise<string[]> {
  const payload = await fetchJson<unknown>('https://userpfp.github.io/UserPFP/source/data.json');
  const records = toUserPfpRecords(payload, userId);
  return extractImageLinks(records);
}
