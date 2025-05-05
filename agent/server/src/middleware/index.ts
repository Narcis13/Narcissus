import { Context, MiddlewareHandler } from 'hono';

/**
 * Authentication middleware to protect routes
 * Checks for an Authorization header with a Bearer token
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized: Missing or invalid token' }, 401);
  }
  
  // In a real app, validate the token
  // Here we're just checking for its presence
  await next();
};

/**
 * Rate limiting middleware
 * Simple example - in production use a Redis-based solution
 */
const requestCounts = new Map<string, { count: number, resetTime: number }>();

export const rateLimit = (limit: number, windowMs: number): MiddlewareHandler => {
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, {
        count: 0,
        resetTime: now + windowMs
      });
    }
    
    const requestData = requestCounts.get(ip)!;
    
    // Reset counter if time window has passed
    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + windowMs;
    }
    
    requestData.count++;
    
    if (requestData.count > limit) {
      return c.json({ message: 'Too many requests' }, 429);
    }
    
    await next();
  };
};

/**
 * Error handling middleware
 */
export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    return c.json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? undefined : String(error)
    }, 500);
  }
};