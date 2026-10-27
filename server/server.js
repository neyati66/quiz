require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const connectDB = require('./config/db');

(async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('JWT_SECRET is missing or too short. Set it in .env (see .env.example).');
    process.exit(1);
  }
  await connectDB();
  // build indexes (unique emails / questionIds / one attempt per session) before serving traffic
  await Promise.all(['User', 'Question', 'Progress', 'AttemptLog', 'QuizSession'].map((m) => require('./models/' + m).init()));
  const app = require('./app');
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Quizzy running at http://localhost:${port}  (API: /api)`));
})().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
