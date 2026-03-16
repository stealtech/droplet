export function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value;
	if (maxLength <= 3) return value.slice(0, maxLength);
	return `${value.slice(0, maxLength - 3)}...`;
}

export function splitAndClean(value: string, separator: string): string[] {
	return value
		.split(separator)
		.map(part => part.trim())
		.filter(Boolean);
}

export function parseLiteral(value: string, options: {
	parseBooleans: boolean;
	parseNumbers: boolean;
	parseNullAsUndefined: boolean;
}): string | number | boolean | undefined {
	if (options.parseNullAsUndefined && value.toLowerCase() === 'null') {
		return undefined;
	}

	if (options.parseBooleans) {
		if (value.toLowerCase() === 'true') return true;
		if (value.toLowerCase() === 'false') return false;
	}

	if (options.parseNumbers) {
		const numeric = Number(value);
		if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
			return numeric;
		}
	}

	return value;
}

export function extractUserId(raw: string): string {
	return raw.replace(/[<@!>]/g, '').trim();
}

export function escapeInlineCode(value: string): string {
	return value.replaceAll('`', '\\`');
}

export function formatDiscordTimestamp(date: Date, withRelative: boolean): string {
	const unix = Math.floor(date.getTime() / 1000);
	if (withRelative) {
		return `<t:${unix}:F> (<t:${unix}:R>)`;
	}

	return `<t:${unix}:F>`;
}
