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
    // Simple English check (adjust regex as needed)
    const isEnglish = /^[a-zA-Z0-9\s.,!?;:'"()\-]+$/.test(originalMessage);
    if (isEnglish) {
      return res.status(200).json({ messages: [{ response: originalMessage }] });
    }

    // Fallback to LibreTranslate for detection if needed
    const detectResponse = await fetch("https://libretranslate.com/detect", {
      method: "POST",
      body: JSON.stringify({ q: originalMessage }),
      headers: { "Content-Type": "application/json" }
    });
    const detectedLang = (await detectResponse.json())[0]?.language || "en";
    
    // Translate with MyMemory
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842"; // Replace with your key
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${detectedLang}|en&key=${MYMEMORY_API_KEY}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();
    const translatedMessage = result.responseData?.translatedText || originalMessage;

    await supabase.from('messages').update({ translated_message: translatedMessage }).eq('id', id);
    res.status(200).json({ messages: [{ response: translatedMessage }] });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ 
      error: 'Translation failed',
      detail: err.message,
      fallback: originalMessage
    });
  }
}
