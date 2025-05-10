import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  // Fetch the latest message from Supabase
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ messages: [{ response: 'No messages.' }] });

  const { id, message: originalMessage, translated_message } = data[0];
  
  // If already translated, return cached version
  if (translated_message) {
    return res.status(200).json({ messages: [{ response: translated_message }] });
  }

  try {
    // Step 1: Detect if the message is English
    const detectResponse = await fetch("https://libretranslate.com/detect", {
      method: "POST",
      body: JSON.stringify({ q: originalMessage }),
      headers: { "Content-Type": "application/json" }
    });
    const detectedLang = (await detectResponse.json())[0]?.language || "en";

    // Step 2: Only translate if NOT English
    let translatedMessage = originalMessage; // Default to original (English)
    if (detectedLang !== "en") {
      const MYMEMORY_API_KEY = "803876a9e4f30ab69842"; // Replace with your key
      const langpair = `${detectedLang}|en`; // Dynamic source language
      
      const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${langpair}&key=${MYMEMORY_API_KEY}`;
      const translateResponse = await fetch(apiUrl);
      const result = await translateResponse.json();
      translatedMessage = result.responseData?.translatedText || originalMessage;

      // Save translation to Supabase
      await supabase
        .from('messages')
        .update({ translated_message: translatedMessage })
        .eq('id', id);
    }

    res.status(200).json({ messages: [{ response: translatedMessage }] });
  } catch (err) {
    res.status(500).json({ 
      error: 'Translation failed', 
      detail: err.message,
      fallback: originalMessage // Return original if error occurs
    });
  }
}
