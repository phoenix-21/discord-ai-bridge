export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // DEBUG: Log if the key is present and the first few characters
  console.log('API key present:', !!process.env.OPENROUTER_API_KEY);
  console.log('API key snippet:', process.env.OPENROUTER_API_KEY?.slice(0, 10));

  try {
    const openaiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://yourdomain.com' // optional but good practice
      },
      body: JSON.stringify({
        model: 'openai/gpt-4',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await openaiRes.json();

    if (data.error) {
      console.error('OpenRouter error:', data.error);
      return res.status(401).json({ error: data.error });
    }

    const id = Date.now().toString();
    global.responses = global.responses || {};
    global.responses[id] = data;

    res.status(200).json({ id });
  } catch (err) {
    console.error('Request failed:', err);
    res.status(500).json({ error: 'OpenRouter request failed' });
  }
}
