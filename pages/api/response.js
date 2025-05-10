import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  // 1. Fetch the latest message from Supabase
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ messages: [{ response: 'No messages.' }] });

  const { id, message: originalMessage, translated_message } = data[0];

  // 2. Return cached translation if it exists
  if (translated_message) {
    return res.status(200).json({ messages: [{ response: translated_message }] });
  }

  try {
    // 3. Skip translation if the message is already in English
    const isEnglish = /^[a-zA-Z0-9\s.,!?;:'"()\-]+$/.test(originalMessage);
    if (isEnglish) {
      return res.status(200).json({ messages: [{ response: originalMessage }] });
    }

    // 4. Translate non-English messages using MyMemory
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842"; // Replace with your key
    const langpair = "auto|en"; // MyMemory now supports "auto" detection!
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${langpair}&key=${MYMEMORY_API_KEY}`;

    const response = await fetch(apiUrl);
    const result = await response.json();

    // 5. Handle response
    const translatedMessage = result.responseData?.translatedText || originalMessage;

    // 6. Save to Supabase
    await supabase
      .from('messages')
      .update({ translated_message: translatedMessage })
      .eq('id', id);

    res.status(200).json({ messages: [{ response: translatedMessage }] });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ 
      error: 'Translation failed',
      detail: err.message,
      fallback: originalMessage
    });
  }
}
