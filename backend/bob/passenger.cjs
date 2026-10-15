(async () => {
  const { createServer } = await import('./server.js');
  const { config } = await import('./config.js');

  const server = createServer();

  server.listen(config.port, config.host, () => {
    console.log(`[Bop Bob Backend / Passenger] Listening on http://${config.host}:${config.port}`);
  });
})().catch((err) => {
  console.error('[Bop Bob Backend / Passenger] Startup failed:', err);
  process.exit(1);
});
