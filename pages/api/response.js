export default function handler(req, res) {
  const { id } = req.query;

  if (!id || !global.responses || !global.responses[id]) {
    return res.status(404).json({ error: 'Response not found' });
  }

  res.status(200).json(global.responses[id]);
}
