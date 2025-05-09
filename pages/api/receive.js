export const config = {
  api: {
    bodyParser: false, // Disable default JSON body parser
  },
};

import { supabase } from '../../lib/supabaseClient';
import getRawBody from 'raw-body';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const rawBody = await getRawBody(req);
      const message = rawBody.toString().trim();

      if (!message) {
        return res.status(400).json({ error: 'No message provided' });
      }

      const { error } = await supabase
        .from('messages')
        .insert([{ message }]);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json({ status: 'Message stored' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read body' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
