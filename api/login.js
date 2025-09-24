import { setSession } from './_lib/session.js';

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    // Parse request body
    const body = req.body;
    const { cashierId, pin } = typeof body === 'string' ? JSON.parse(body) : body;

    // Validate credentials (hardcoded for MVP)
    if (cashierId === 'test' && pin === '1234') {
      // Create session data
      const sessionData = {
        cashierId,
        processedCount: 0,
        loginTime: new Date().toISOString()
      };

      // Set session cookie
      setSession(res, sessionData);

      // Return success response
      res.status(200).json({
        ok: true,
        cashierId: sessionData.cashierId,
        processedCount: sessionData.processedCount
      });
    } else {
      // Invalid credentials
      res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
