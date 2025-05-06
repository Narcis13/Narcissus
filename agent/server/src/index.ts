import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { routes } from './routes';


// Create main Hono app
const app = new Hono();

// Apply global middleware
app.use(logger());
app.use(prettyJSON());

// Register all routes
app.route('', routes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'API is running',
    version: '1.0.0'
  });
});

// Start server
const PORT = process.env.PORT ? Number(process.env.PORT) : 3013;
console.log(`Server is running on http://localhost:${PORT}`);
export default {
  port: PORT,
  fetch: app.fetch
};