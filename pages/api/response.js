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

  let responseMessage = data.length === 0 ? 'No messages yet.' : data[0].message;

  try {
    // Dynamically import Translate API to avoid build errors
    const { v2: Translate } = await import('@google-cloud/translate');
    const translate = new Translate.Translate();

    // Detect language
    const [detection] = await translate.detect(responseMessage);
    const detectedLang = Array.isArray(detection) ? detection[0].language : detection.language;

    // Translate if not English
    if (detectedLang !== 'en') {
      const [translated] = await translate.translate(responseMessage, 'en');
      responseMessage = translated;
    }
  } catch (translateError) {
    return res.status(500).json({ error: 'Translation failed', detail: translateError.message });
  }

  res.status(200).json({
    messages: [
      {
        response: responseMessage
      }
    ]
  });
}
