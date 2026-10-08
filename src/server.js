const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const { ensureSuperadmin, ensureInitialData } = require('./services/bootstrap');

(async () => {
  try {
    await connectDB();
    await ensureSuperadmin();
    await ensureInitialData();
    const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

    // To'g'ri to'xtash: yangi so'rovlarni qabul qilmaydi, ulanishlarni yopadi
    const shutdown = (signal) => {
      console.log(`${signal} qabul qilindi, to'xtatilmoqda...`);
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
})();

// Kutilmagan xatolar logga yoziladi (server qulamaydi, lekin e'tibor bering)
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
