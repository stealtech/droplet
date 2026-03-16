import { startBot } from './src/bot';
import { renderStartupBanner } from './src/utils/LoggerUtil';

await renderStartupBanner();
await startBot();