import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
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

  const { id, message: originalMessage, translated_message } = data[0];

  if (translated_message) {
    // Already translated, return cached version
    return res.status(200).json({
      messages: [{ response: translated_message }]
    });
  }

  try {
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      body: JSON.stringify({
        q: originalMessage,
        source: "auto",
        target: "en",
        format: "text",
        alternatives: 3,
        api_key: ""
      }),
      headers: { "Content-Type": "application/json" }
    });

    const result = await response.json();
    const translatedMessage = result.translatedText || originalMessage;

    // Save translated message in DB
    await supabase
      .from('messages')
      .update({ translated_message: translatedMessage })
      .eq('id', id);

    res.status(200).json({
      messages: [{ response: translatedMessage }]
    });
  } catch (err) {
    res.status(500).json({ error: 'Translation failed', detail: err.message });
  }
}
