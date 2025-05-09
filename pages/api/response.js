import { supabase } from './lib/supabaseclient';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (data.length === 0) {
    return res.status(200).json({ response: 'No messages yet.' });
  }

  res.status(200).json({ response: data[0].message });
}
