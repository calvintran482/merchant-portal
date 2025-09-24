import crypto from 'crypto';

// Secret key for signing cookies (should be set in environment variables)
const SECRET = process.env.SESSION_SECRET || 'merchant-portal-secret-key-change-in-production';

// Base64url encoding (URL-safe base64)
function base64urlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Base64url decoding
function base64urlDecode(str) {
  // Add padding if needed
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64');
}

// Sign data with HMAC-SHA256
function sign(data) {
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(data);
  return hmac.digest();
}

// Verify signature
function verify(data, signature) {
  const expectedSignature = sign(data);
  return crypto.timingSafeEqual(signature, expectedSignature);
}

// Parse cookies from request headers
export function parseCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie || '';
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name) {
      const value = rest.join('=').trim();
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

// Get and verify session from request
export function getSession(req) {
  const cookies = parseCookies(req);
  const sessionCookie = cookies.session;
  
  if (!sessionCookie) {
    return null;
  }
  
  try {
    // Split the cookie value into signature and payload
    const [signatureBase64, payloadBase64] = sessionCookie.split('.');
    
    if (!signatureBase64 || !payloadBase64) {
      return null;
    }
    
    // Decode signature and payload
    const signature = base64urlDecode(signatureBase64);
    const payload = base64urlDecode(payloadBase64).toString('utf8');
    
    // Verify signature
    if (!verify(payload, signature)) {
      return null;
    }
    
    // Parse and return session data
    return JSON.parse(payload);
  } catch (error) {
    console.error('Session parsing error:', error);
    return null;
  }
}

// Set session cookie
export function setSession(res, sessionObj) {
  // Serialize session data
  const payload = JSON.stringify(sessionObj);
  
  // Sign the payload
  const signature = sign(payload);
  
  // Create the cookie value: signature.payload (both base64url encoded)
  const cookieValue = `${base64urlEncode(signature)}.${base64urlEncode(Buffer.from(payload))}`;
  
  // Set secure flag in production
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  
  // Set cookie with security flags
  const cookieString = `session=${cookieValue}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=2592000`;
  
  // Set the cookie header
  res.setHeader('Set-Cookie', cookieString);
  
  return res;
}

// Clear session cookie
export function clearSession(res) {
  // Set an expired cookie to clear it
  const cookieString = 'session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax';
  
  // Set the cookie header
  res.setHeader('Set-Cookie', cookieString);
  
  return res;
}
