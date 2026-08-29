import { app, boot } from './app.js';
import { config } from './config.js';

await boot();

app.listen(config.port, () => {
  console.log(`[server] Stock Insights API running at http://localhost:${config.port}`);
});
