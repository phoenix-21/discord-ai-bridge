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

  // Detect language and translate if not English
  try {
    const detectionResponse = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: originalMessage })
    });

    const detectionData = await detectionResponse.json();
    const detectedLang = detectionData[0]?.language || 'en';

    let translatedMessage = originalMessage;

    if (detectedLang !== 'es') {
      const translationResponse = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: originalMessage,
          source: detectedLang,
          target: 'en',
          format: 'text'
        })
      });

      const translationData = await translationResponse.json();
      translatedMessage = translationData.translatedText || originalMessage;
    }

    res.status(200).json({
      messages: [{ response: translatedMessage }]
    });
  } catch (err) {
    res.status(500).json({ error: 'Translation failed', detail: err.message });
  }
}
