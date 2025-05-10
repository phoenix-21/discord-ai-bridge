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
    return res.status(200).json({
      messages: [{ response: translated_message }]
    });
  }

  try {
    // MyMemory API call without a key
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=auto|en`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    // Extract translation or fallback to original
    const translatedMessage = result.responseData?.translatedText || originalMessage;

    // Save to DB
    await supabase
      .from('messages')
      .update({ translated_message: translatedMessage })
      .eq('id', id);

    res.status(200).json({
      messages: [{ response: translatedMessage }]
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Translation failed', 
      detail: err.message,
      fallback: originalMessage // Always return the original text if translation fails
    });
  }
}
