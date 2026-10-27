// ============================================================
// questions.js — Phase 2.
// The question bank (with correct answers + explanations) NO LONGER ships to the
// browser: it lives in MongoDB and is served per-attempt by GET /api/questions/due,
// with the correct option revealed only after each answer is locked.
// Only the subject list (non-sensitive metadata) remains here. The original
// 108-question bank is preserved verbatim in server/seed/questions.seed.json.
// ============================================================

const SUBJECTS = [
  { key: "HTML", name: "HTML", icon: "📄", desc: "Structure of the web — tags, semantics, forms." },
  { key: "CSS", name: "CSS", icon: "🎨", desc: "Styling, layout, Flexbox, Grid and responsive design." },
  { key: "JavaScript", name: "JavaScript", icon: "💻", desc: "Language fundamentals, DOM and async basics." },
  { key: "Python", name: "Python", icon: "🐍", desc: "Syntax, data types, functions and core built-ins." },
  { key: "Java", name: "Java", icon: "☕", desc: "OOP fundamentals, JVM, collections and syntax." },
  { key: "C++", name: "C++", icon: "⚙️", desc: "Pointers, memory, OOP and core language features." },
  { key: "Aptitude", name: "Aptitude", icon: "🧮", desc: "Quantitative reasoning, ratios, speed and averages." },
  { key: "DBMS", name: "DBMS", icon: "🗄️", desc: "SQL, keys, normalization and transactions." },
  { key: "OS", name: "OS", icon: "🖥️", desc: "Processes, scheduling, memory and deadlocks." },
];
