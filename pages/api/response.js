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

  if (!data || data.length === 0) {
    return res.status(200).json({
      messages: [{ response: 'No messages yet.' }]
    });
  }

  const originalMessage = data[0].message;

  try {
    const translationResponse = await fetch('https://translate.argosopentech.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: originalMessage,
        source: 'auto',
        target: 'en',
        format: 'text'
      })
    });

    if (!translationResponse.ok) {
      throw new Error(`Translation API error: ${translationResponse.statusText}`);
    }

    const translationData = await translationResponse.json();
    const translatedMessage = translationData.translatedText || originalMessage;

    res.status(200).json({
      messages: [{ response: translatedMessage }]
    });
  } catch (err) {
    res.status(500).json({ error: 'Translation failed', detail: err.message });
  }
}
