// Local-only live test entrypoint. Never deploy this file.
import worker from './src/index';

let submitted = false;
export default {
  async fetch(request: Request, env: Parameters<typeof worker.fetch>[1]) {
    const pathname = new URL(request.url).pathname;
    if (request.method === 'GET' && pathname === '/test-config') {
      return Response.json({ model: 'gemini-3.8-flash', mode: 'parallel', maxRetries: 0, submitted });
    }
    if (request.method !== 'POST' || pathname !== '/api/analyze' || submitted) {
      return new Response('This test permits one analysis submission only.', { status: 409 });
    }
    submitted = true;
    return worker.fetch(request, {
      ...env,
      GEMINI_MODEL: 'gemini-3.8-flash',
      GEMINI_ANALYSIS_MODE: 'parallel',
      GEMINI_MAX_RETRIES: '0',
      GEMINI_INPUT_USD_PER_MILLION_TOKENS: '0.75',
      GEMINI_OUTPUT_USD_PER_MILLION_TOKENS: '3.75',
    });
  },
};
