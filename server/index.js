import { createAdvisorService } from './advisor.js';
import { createWhereToServer } from './app.js';
import { readConfig } from './config.js';
import { createOfficialPriceService } from './officialPrice.js';
import { createItineraryService } from './itinerary.js';

const config = readConfig();
const advisor = createAdvisorService({
  apiKey: config.openAiApiKey,
  model: config.openAiModel,
  timeoutMs: config.aiTimeoutMs,
});
const officialPrices = createOfficialPriceService({
  timeoutMs: config.priceLookupTimeoutMs,
  cacheTtlMs: config.priceCacheTtlMs,
});
const itinerary = createItineraryService({
  apiKey: config.openAiApiKey,
  model: config.openAiModel,
  timeoutMs: config.aiTimeoutMs,
});
const server = createWhereToServer({ config, advisor, itinerary, officialPrices });

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`WhereTo could not start: ${config.host}:${config.port} is already in use. Close the older WhereTo terminal, then run npm run dev again.`);
  } else {
    console.error('WhereTo API could not start:', error.message);
  }
  process.exitCode = 1;
});

server.listen(config.port, config.host, () => {
  console.log(`WhereTo API ready at http://${config.host}:${config.port}${advisor.configured ? '' : ' (OPENAI_API_KEY missing)'}`);
});

const shutdown = () => {
  server.close(() => process.exit());
  setTimeout(() => process.exit(1), 5_000).unref();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
