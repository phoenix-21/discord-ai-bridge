import { supabase } from '../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { message } = req.body;

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
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
