import { supabase } from '../../lib/supabaseClient';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ messages: [{ response: 'No messages.' }] });

  const { id, message: originalMessage, translated_message } = data[0];
  if (translated_message) {
    return res.status(200).json({
      messages: [{ response: translated_message, original_language: 'unknown' }]
    });
  }

  const MYMEMORY_API_KEY = "803876a9e4f30ab69842";
  let detectedLang = 'unknown';

  try {
    // Try LibreTranslate first
    try {
      const detectResponse = await fetch("https://translate.argosopentech.com/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: originalMessage })
      });
      const detectResult = await detectResponse.json();
      detectedLang = detectResult[0]?.language || 'unknown';
    } catch (libreErr) {
      console.warn("LibreTranslate failed, falling back to MyMemory");

      // Fallback: Try MyMemory
      const detectUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=|en&key=${MYMEMORY_API_KEY}`;
      const detectResponse = await fetch(detectUrl);
      const detectResult = await detectResponse.json();
      detectedLang = detectResult.responseData?.match?.lang || 'unknown';
    }

    // If detection failed or it's English, skip translation
    if (detectedLang === 'unknown' || detectedLang === 'en') {
      return res.status(200).json({
        messages: [{
          response: originalMessage,
          original_language: detectedLang
        }]
      });
    }

    // Translate only if valid language code detected
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${detectedLang}|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    const translatedMessage = translateResult.responseData?.translatedText || originalMessage;

    await supabase.from('messages').update({ translated_message: translatedMessage }).eq('id', id);

    res.status(200).json({
      messages: [{
        response: translatedMessage,
        original_language: detectedLang
      }]
    });
  } catch (err) {
    res.status(500).json({
      error: 'Translation failed',
      detail: err.message,
      fallback: originalMessage
    });
  }
}
