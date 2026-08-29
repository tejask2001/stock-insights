// Vercel serverless entry point for the backend API.
// The Express app (server/src/app.js) is bundled as a single function.
import { app, boot } from '../server/src/app.js';

await boot();

export default app;
