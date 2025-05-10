import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ messages: [{ response: 'No messages.' }] });

  const { id, message: originalMessage, translated_message } = data[0];
  if (translated_message) return res.status(200).json({ messages: [{ response: translated_message }] });

  try {
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842";
    
    // Use MyMemory's language detection
    const detectUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=|en&key=${MYMEMORY_API_KEY}`;
    const detectResponse = await fetch(detectUrl);
    const detectResult = await detectResponse.json();
    const detectedLang = detectResult.responseData?.match?.lang || detectResult.responseData?.detectedSourceLanguage;

    // Skip translation if it's already in English
    if (detectedLang === 'en') {
      return res.status(200).json({ messages: [{ response: originalMessage }] });
    }

    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=es|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    const translatedMessage = translateResult.responseData?.translatedText || originalMessage;
    await supabase.from('messages').update({ translated_message: translatedMessage }).eq('id', id);

    res.status(200).json({ messages: [{ response: translatedMessage }] });
  } catch (err) {
    res.status(500).json({ 
      error: 'Translation failed', 
      detail: err.message,
      fallback: originalMessage
    });
  }
}
