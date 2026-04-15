'use strict';

/**
 * Netlify Function: ask
 * Route: POST /ask  (proxied via netlify.toml redirect)
 *
 * Adapts the Netlify Function event/response contract to the Express-style
 * req/res interface used by the orchestrator handler.
 */

const handler = require('../../apps/orchestrator/api/ask.js');

exports.handler = async (event) => {
  // Parse JSON body
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (err) {
      console.error('[netlify/ask] Failed to parse request body:', err.message);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }
  }

  // Build a minimal Express-compatible req object
  const req = {
    method:  event.httpMethod,
    headers: event.headers || {},
    body,
  };

  // Build a minimal Express-compatible res object that captures the response
  const responseHeaders = {};
  let statusCode  = 200;
  let responseBody = '';

  const res = {
    status(code)           { statusCode = code; return this; },
    setHeader(name, value) { responseHeaders[name] = value; return this; },
    json(data)             { responseBody = JSON.stringify(data); return this; },
    end()                  { return this; },
  };

  try {
    await handler(req, res);
  } catch (err) {
    console.error('[netlify/ask] Unhandled error in orchestrator handler:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }

  // Ensure a body is set if the handler didn't produce one
  if (!responseBody) responseBody = JSON.stringify({ error: 'No response from handler' });

  return {
    statusCode,
    headers: responseHeaders,
    body: responseBody,
  };
};
