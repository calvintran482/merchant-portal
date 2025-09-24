import { clearSession } from './_lib/session.js';

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    // Clear session cookie
    clearSession(res);
    
    // Return success response
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
