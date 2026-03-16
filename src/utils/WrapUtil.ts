export async function sleep(ms: number): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, ms));
}

export async function safely<T>(operation: () => Promise<T>, fallback?: T): Promise<T | undefined> {
	try {
		return await operation();
	} catch {
		return fallback;
	}
}
