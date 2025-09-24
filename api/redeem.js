import { getSession, setSession } from './_lib/session.js';
import { redeem } from './_lib/codes.js';
import { incrementCount } from './_lib/stats.js';

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    // Check authentication
    const session = getSession(req);
    if (!session || !session.cashierId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    // Parse request body
    const body = req.body;
    const { code } = typeof body === 'string' ? JSON.parse(body) : body;

    // Validate input
    if (!code) {
      res.status(400).json({ ok: false, redeemed: false, reason: 'No code provided' });
      return;
    }

    // Attempt to redeem the code
    const result = redeem(code);

    if (!result.ok) {
      // Invalid code
      res.json({ ok: true, redeemed: false, reason: 'Invalid code' });
      return;
    }

    if (result.already) {
      // Code already redeemed
      res.json({ ok: true, redeemed: false, reason: 'Code already redeemed' });
      return;
    }

    // Successfully redeemed - persist per-cashier processed count
    const newCount = incrementCount(session.cashierId, 1);

    const updatedSession = {
      ...session,
      processedCount: newCount
    };

    // Update session cookie
    setSession(res, updatedSession);

    // Return success response
    res.json({ ok: true, redeemed: true });
  } catch (error) {
    console.error('Redemption error:', error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
