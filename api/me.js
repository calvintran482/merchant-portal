import { getSession } from './_lib/session.js';
import { getCount } from './_lib/stats.js';

export default async function handler(req, res) {
  // Only allow GET method
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    // Get session from cookie
    const session = getSession(req);
    
    // Check if session exists
    if (!session || !session.cashierId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
    
    // Return session data with persistent processed count
    res.status(200).json({
      ok: true,
      cashierId: session.cashierId,
      processedCount: getCount(session.cashierId)
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
