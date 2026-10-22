import app from './app.js';

// `--port=` (used by `npm run dev`) wins over PORT so a PORT injected for the Vite
// dev server can't make the API steal Vite's port; the Vite proxy expects :4000.
const portArg = process.argv.find((a) => a.startsWith('--port='));
const PORT = (portArg && portArg.slice('--port='.length)) || process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SJC2 Capacity Schedule API listening on http://localhost:${PORT}`);
});
