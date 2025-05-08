export default function handler(req, res) {
  if (req.method === 'POST') {
    const { message } = req.body;
    if (message) {
      console.log('Received message:', message);
      // You could store the message in a DB or temporary memory (if persistent)
      res.status(200).json({ status: 'Message received' });
    } else {
      res.status(400).json({ error: 'No message provided' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
