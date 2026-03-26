import app from './app';

const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`[Velox API] Running on http://localhost:${PORT}`);
  console.log(`[Velox API] Health check: http://localhost:${PORT}/api/v1/health`);
});
