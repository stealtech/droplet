import { truncate } from './FormatUtil';
import { fetchJson } from './HttpUtil';

export interface ReviewDbReviewSummary {
  author: string;
  rating?: string;
  content: string;
}

function getObjectValue(record: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = record;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function toReviewRecords(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(item => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>;
  }

  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    for (const key of ['reviews', 'data', 'items']) {
      const candidate = container[key];
      if (Array.isArray(candidate)) {
        return candidate.filter(item => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>;
      }
    }
  }

  return [];
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getFirstString(record: Record<string, unknown>, paths: string[]): string {
  for (const path of paths) {
    const value = toStringValue(getObjectValue(record, path));
    if (value) {
      return value;
    }
  }

  return '';
}

function getReviewerName(review: Record<string, unknown>): string {
  const directName = getFirstString(review, [
    'author_name',
    'username',
    'display_name',
    'global_name',
    'reviewer_name',
  ]);

  if (directName) {
    return directName;
  }

  const nestedName = getFirstString(review, [
    'author.username',
    'author.global_name',
    'author.display_name',
    'author.name',
    'reviewer.username',
    'reviewer.global_name',
    'reviewer.display_name',
    'reviewer.name',
    'user.username',
    'user.global_name',
    'user.display_name',
    'user.name',
    'sender.username',
    'sender.global_name',
    'sender.display_name',
    'sender.name',
  ]);

  if (nestedName) {
    return nestedName;
  }

  const fallbackId = getFirstString(review, [
    'author.id',
    'reviewer.id',
    'user.id',
    'sender.id',
    'authorId',
    'reviewerId',
    'userId',
  ]);

  if (fallbackId) {
    return `User ${fallbackId}`;
  }

  return 'Unknown reviewer';
}

function getReviewContent(review: Record<string, unknown>): string {
  const content = getFirstString(review, [
    'comment',
    'review',
    'content',
    'text',
    'message',
    'body',
  ]);

  return content || 'No comment.';
}

export async function fetchReviewDbReviews(userId: string): Promise<ReviewDbReviewSummary[]> {
  const endpoint = `https://manti.vendicated.dev/api/reviewdb/users/${userId}/reviews`;
  const payload = await fetchJson<unknown>(endpoint);
  const reviews = toReviewRecords(payload);

  return reviews.map(review => {
    const author = getReviewerName(review);
    const rating = review.rating ?? review.score;
    const content = getReviewContent(review);

    return {
      author: truncate(author, 48),
      rating: typeof rating === 'number' || typeof rating === 'string' ? String(rating) : undefined,
      content: truncate(content, 220),
    };
  });
}

export function formatReviewDbSummaries(reviews: ReviewDbReviewSummary[], max = 8): string {
  const lines = reviews.slice(0, max).map((review, index) => {
    const detailLines = [`### ${index + 1}. ${review.author}`];

    if (review.rating) {
      detailLines.push(`- Rating: **${review.rating}**`);
    }

    detailLines.push(`- Review: ${review.content}`);
    return detailLines.join('\n');
  });

  return lines.join('\n\n');
}
