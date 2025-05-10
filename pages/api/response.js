import { supabase } from '../../lib/supabaseClient';
import franc from 'franc'; // Lightweight language detection library

export default async function handler(req, res) {
  // 1. Fetch the latest message
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
    // 3. Detect language using "franc" (local, no API calls)
    const detectedLangCode = franc(originalMessage); // Returns ISO 639-3 code (e.g., 'eng', 'spa')
    const isEnglish = detectedLangCode === 'eng';

    // 4. Skip translation if English
    if (isEnglish) {
      return res.status(200).json({ messages: [{ response: originalMessage }] });
    }

    // 5. Convert ISO 639-3 to MyMemory-friendly code (e.g., 'spa' → 'es')
    const langMap = {
      spa: 'es', // Spanish
      fra: 'fr', // French
      deu: 'de', // German
      // Add more mappings as needed: https://en.wikipedia.org/wiki/ISO_639-3
    };
    const sourceLang = langMap[detectedLangCode] || 'en'; // Fallback to English

    // 6. Translate with MyMemory
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842"; // Replace with your key
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${sourceLang}|en&key=${MYMEMORY_API_KEY}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();
    const translatedMessage = result.responseData?.translatedText || originalMessage;

    // 7. Save to Supabase
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
