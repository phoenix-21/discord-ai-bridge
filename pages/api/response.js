import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const responseMessage = data.length === 0 ? 'No messages yet.' : data[0].message;

  res.status(200).json({
    messages: [
      {
        response: responseMessage
      }
    ]
  });
}
