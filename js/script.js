/* ===============================
   GLOBALER ZUSTAND
   =============================== */

let allLessonData = { meta: null, lesson: null };
let currentLessonKey = "Lektion1";
let currentLang = "DE";
let currentView = "vocabulary";
let isRTL = false;

const RTL_LANGS = ["AR", "FA"];

/* Writing-Übung */
let exerciseWords = [];
let currentExerciseIndex = 0;
let writingInputValue = "";

/* Memory */
let memoryCards = [];
let memoryFlipped = [];
let memoryMatched = [];
let memoryLock = false;
let startTime = null;
let timerInterval = null;
let elapsedTime = 0;

/* Scramble */
let scrambleWord = null;          // { de, foreign, emoji }
let scrambleScrambled = "";       // feste Buchstabenfolge (nicht bei jedem Render neu)
let scrambleInput = "";
let scrambleSolved = false;

/* ===============================
   HILFSFUNKTIONEN
   =============================== */

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeLangText(v) {
  const t = v?.[currentLang];
  return (t && t !== "N/A") ? t : v?.DE;
}

function setBodyDirection() {
  isRTL = RTL_LANGS.includes(currentLang);
  document.body.classList.toggle("ltr", !isRTL);
}

/* ===============================
   TTS
   =============================== */

function speak(text, lang = "DE") {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text ?? ""));

  const map = {
    DE: "de-DE",
    AR: "ar-SA",
    FA: "fa-IR",
    RU: "ru-RU",
    RO: "ro-RO",
  };

  u.lang = map[lang] || "de-DE";
  u.rate = 0.9;

  const voices = speechSynthesis.getVoices();
  const wanted = u.lang.slice(0, 2);
  const voice = voices.find(v => v.lang?.startsWith(wanted));
  if (voice) u.voice = voice;

  speechSynthesis.speak(u);
}

/* ===============================
   INITIALISIERUNG / LADEN
   =============================== */

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentLessonKey = params.get("lesson") || "Lektion1";
  loadLesson(currentLessonKey).catch(err => {
    console.error(err);
    const area = document.getElementById("content-area");
    if (area) area.innerHTML = `<div style="padding:16px;color:#b91c1c;font-weight:700">Fehler beim Laden: ${escHtml(err.message)}</div>`;
  });
});

async function loadLesson(key) {
  const metaRes = await fetch("data/meta.json");
  if (!metaRes.ok) throw new Error("meta.json nicht gefunden");
  const meta = await metaRes.json();

  const lessonRes = await fetch(`data/${key}.json`);
  if (!lessonRes.ok) throw new Error(`${key}.json nicht gefunden`);
  const lesson = await lessonRes.json();

  allLessonData = { meta, lesson };
  currentLang = meta.defaultLang || "DE";

  initWriting();
  initMemory();
  initScramble();

  render();
}

/* ===============================
   RENDER
   =============================== */

function render() {
  const lesson = allLessonData.lesson;
  if (!lesson) return;

  setBodyDirection();

  // Titel setzen (falls Element existiert)
  const titleEl = document.getElementById("lesson-title");
  if (titleEl && lesson.title?.DE) {
    const foreign = lesson.title[currentLang] || lesson.title.DE;
    titleEl.textContent = `${lesson.title.DE} (${foreign})`;
  }

  // Sprachbuttons stylen
  document.querySelectorAll(".lang-btn").forEach(b => {
    const sel = b.dataset.lang === currentLang;
    b.classList.toggle("bg-blue-600", sel);
    b.classList.toggle("text-white", sel);
    b.classList.toggle("bg-gray-200", !sel);
    b.classList.toggle("text-gray-700", !sel);
  });

  // Tabs aktiv markieren
  document.querySelectorAll(".tab-btn").forEach(t => {
    const sel = t.dataset.view === currentView;
    t.classList.toggle("tab-active", sel);
    t.classList.toggle("tab-inactive", !sel);
  });

  // Views zeigen/verstecken
  document.querySelectorAll(".active-view").forEach(v => {
    v.classList.toggle("hidden", v.id !== `${currentView}-view`);
  });

  // Inhalt rendern
  if (currentView === "vocabulary") {
    const el = document.getElementById("vocabulary-list");
    if (el) el.innerHTML = renderVocabulary(lesson);
  }

  if (currentView === "exercises") {
    const el = document.getElementById("exercises-container");
    if (el) el.innerHTML = renderWriting();
  }

  if (currentView === "memory") {
    const el = document.getElementById("memory-container");
    if (el) el.innerHTML = renderMemory();
  }

  if (currentView === "scramble") {
    const el = document.getElementById("scramble-container");
    if (el) el.innerHTML = renderScramble();
  }
}

/* ===============================
   WORTSCHATZ
   =============================== */

function renderVocabulary(lesson) {
  const vocab = lesson.vocabulary || [];
  return vocab.map(v => {
    const emoji = v.emoji_icon || "💡";
    const foreignText = safeLangText(v);

    const de = escHtml(v.DE);
    const foreign = escHtml(foreignText);

    return `
      <div class="flip-card cursor-pointer" onclick="this.querySelector('.flip-card-inner')?.classList.toggle('flipped')">
        <div class="flip-card-inner">

          <div class="flip-card-front bg-white p-4 border rounded-lg flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-2xl">${emoji}</span>
              <strong>${de}</strong>
            </div>
            <button class="audio-btn" onclick="event.stopPropagation(); speak('${de}','DE')">🔊</button>
          </div>

          <div class="flip-card-back bg-indigo-100 p-4 border rounded-lg flex flex-col items-center justify-center ${isRTL ? "rtl" : "ltr"}">
            <div class="text-lg mb-2">${foreign}</div>
            ${currentLang !== "DE" ? `<button class="audio-btn" onclick="event.stopPropagation(); speak('${foreign}','${escHtml(currentLang)}')">🔊</button>` : ""}
          </div>

        </div>
      </div>
    `;
  }).join("");
}

/* ===============================
   WRITING – kein Fokusverlust
   =============================== */

function initWriting() {
  const vocab = allLessonData.lesson?.vocabulary || [];
  exerciseWords = vocab.map(v => ({
    de: v.DE,
    foreign: safeLangText(v),
    emoji: v.emoji_icon || "💡"
  }));
  currentExerciseIndex = 0;
  writingInputValue = "";
}

function renderWriting() {
    const w = exerciseWords[currentExerciseIndex];
    if (!w) return "<p>Fertig 🎉</p>";

    return `
        <p class="text-left mb-2">
            Bitte schreibe das deutsche Wort für:
        </p>

        <!-- Fremdwort IMMER linksbündig anzeigen -->
        <p class="text-xl font-bold mb-4 ltr text-left">
            ${w.foreign}
        </p>

        <!-- Eingabe IMMER LTR -->
        <input
            type="text"
            value="${writingInputValue}"
            oninput="writingInputValue=this.value"
            class="w-full max-w-md p-3 border rounded ltr text-left"
            dir="ltr"
            inputmode="latin"
            autocapitalize="none"
            autocomplete="off"
            spellcheck="false"
        />

        <div class="mt-4 flex gap-3">
            <button
                onclick="checkWriting()"
                class="px-4 py-2 bg-blue-600 text-white rounded">
                Prüfen
            </button>

            <button
                onclick="showWritingSolution()"
                class="px-4 py-2 bg-gray-300 text-gray-900 rounded">
                Lösung anzeigen
            </button>
        </div>
    `;
}



function normalizeAnswer(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
}

function checkWriting() {
  const w = exerciseWords[currentExerciseIndex];
  if (!w) return;

  const correct = normalizeAnswer(w.de);
  const input = normalizeAnswer(writingInputValue);

  if (input === correct) {
    speak("Richtig", "DE");
    currentExerciseIndex++;
    writingInputValue = "";
  } else {
    speak("Falsch", "DE");
  }

  render();
}

function nextWriting() {
  currentExerciseIndex++;
  writingInputValue = "";
  render();
}

/* ===============================
   MEMORY
   =============================== */

function initMemory() {
  memoryCards = [];
  memoryFlipped = [];
  memoryMatched = [];
  memoryLock = false;

  startTime = null;
  elapsedTime = 0;
  clearInterval(timerInterval);
  timerInterval = null;

  const vocab = allLessonData.lesson?.vocabulary || [];
  const pool = vocab.filter(v => v?.DE);
  if (pool.length < 6) return;

  // 6 Paare zufällig
  const copy = [...pool].sort(() => Math.random() - 0.5).slice(0, 6);

  copy.forEach((v, i) => {
    memoryCards.push({ matchId: i, text: v.DE, badge: "🇩🇪" });
    memoryCards.push({ matchId: i, text: safeLangText(v), badge: v.emoji_icon || "💡" });
  });

  memoryCards.sort(() => Math.random() - 0.5);
}

function flipMemory(idx) {
  if (memoryLock) return;
  if (memoryFlipped.includes(idx)) return;

  // Timer startet beim ersten Klick
  if (startTime === null) {
    startTime = Date.now();
    timerInterval = setInterval(() => {
      elapsedTime = Date.now() - startTime;
      const t = document.getElementById("memory-timer");
      if (t) t.textContent = `Zeit: ${(elapsedTime / 1000).toFixed(1)}s`;
    }, 100);
  }

  const card = memoryCards[idx];
  if (!card) return;

  // Bereits gematcht?
  if (memoryMatched.includes(card.matchId)) return;

  memoryFlipped.push(idx);
  render();

  if (memoryFlipped.length === 2) {
    memoryLock = true;
    const [a, b] = memoryFlipped;
    const c1 = memoryCards[a];
    const c2 = memoryCards[b];

    if (c1 && c2 && c1.matchId === c2.matchId) {
      memoryMatched.push(c1.matchId);
      memoryFlipped = [];
      memoryLock = false;
      speak("Korrekt", "DE");
      render();

      // Ende?
      if (memoryMatched.length === memoryCards.length / 2) {
        clearInterval(timerInterval);
        timerInterval = null;
        speak("Fertig", "DE");
      }
    } else {
      setTimeout(() => {
        memoryFlipped = [];
        memoryLock = false;
        render();
      }, 900);
    }
  }
}

function renderMemory() {
  if (!memoryCards.length) {
    return `<div class="p-4 bg-yellow-100 rounded">Nicht genug Vokabeln für Memory.</div>`;
  }

  const done = memoryMatched.length === memoryCards.length / 2;

  return `
    <div class="mb-3 flex items-center justify-between p-2 bg-gray-100 rounded">
      <div class="text-sm text-gray-700">Finde Paare (Deutsch ↔ Übersetzung)</div>
      <div id="memory-timer" class="font-bold">Zeit: ${(elapsedTime / 1000).toFixed(1)}s</div>
      <button onclick="initMemory(); render()" class="px-3 py-2 rounded bg-purple-600 text-white text-sm">Neustart</button>
    </div>

    <div class="grid grid-cols-4 gap-3">
      ${memoryCards.map((c, i) => {
        const open = memoryFlipped.includes(i) || memoryMatched.includes(c.matchId);
        const face = open
          ? `<div class="w-full h-full bg-white border rounded flex flex-col items-center justify-center p-2">
               <div class="text-2xl mb-1">${escHtml(c.badge)}</div>
               <div class="text-xs font-bold text-center">${escHtml(c.text)}</div>
             </div>`
          : `<div class="w-full h-full bg-purple-600 rounded flex items-center justify-center text-white text-3xl">❓</div>`;

        return `<div class="h-24 cursor-pointer" onclick="flipMemory(${i})">${face}</div>`;
      }).join("")}
    </div>

    ${done ? `<div class="mt-4 text-center font-bold text-green-700">Spiel beendet 🎉</div>` : ""}
  `;
}

/* ===============================
   SCRAMBLE (Buchstabensalat)
   =============================== */

function initScramble() {
  const vocab = allLessonData.lesson?.vocabulary || [];
  const pool = vocab.filter(v => (v?.DE || "").length >= 4);
  if (!pool.length) {
    scrambleWord = null;
    return;
  }

  const v = pool[Math.floor(Math.random() * pool.length)];
  scrambleWord = {
    de: v.DE,
    foreign: safeLangText(v),
    emoji: v.emoji_icon || "💡"
  };

  scrambleInput = "";
  scrambleSolved = false;

  // feste Mischung (nicht jedes Render neu)
  const letters = scrambleWord.de.split("");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  scrambleScrambled = letters.join(" ");
}

function renderScramble() {
  if (!scrambleWord) {
    return `<div class="p-4 bg-yellow-100 rounded">Nicht genug Wörter für Buchstabensalat.</div>`;
  }

  const show = scrambleSolved ? scrambleWord.de : scrambleScrambled;
  const info = `${scrambleWord.emoji} (${escHtml(scrambleWord.foreign)})`;

  return `
    <div class="p-4 bg-yellow-50 rounded border">
      <div class="text-sm text-gray-700 mb-2">Welches deutsche Wort ist das? ${info}</div>
      <div class="text-3xl font-mono font-bold mb-4">${escHtml(show)}</div>

      <input
        type="text"
        value="${escHtml(scrambleInput)}"
        oninput="scrambleInput=this.value; checkScrambleLive()"
        dir="ltr"
        autocapitalize="none"
        autocomplete="off"
        spellcheck="false"
        class="w-full max-w-sm p-3 border rounded text-xl"
        placeholder="Lösung eingeben"
        ${scrambleSolved ? "disabled" : ""}
      />

      <div class="mt-3 flex gap-2">
        <button onclick="showScrambleSolution()" class="px-4 py-2 rounded bg-red-600 text-white">Lösung</button>
        <button onclick="initScramble(); render()" class="px-4 py-2 rounded bg-blue-600 text-white">Neues Wort</button>
      </div>
    </div>
  `;
}

function checkScrambleLive() {
  if (!scrambleWord || scrambleSolved) return;

  const input = normalizeAnswer(scrambleInput);
  const correct = normalizeAnswer(scrambleWord.de);

  if (input === correct) {
    scrambleSolved = true;
    speak("Korrekt", "DE");
    render();
    setTimeout(() => {
      initScramble();
      render();
    }, 1200);
  }
}

function showScrambleSolution() {
  if (!scrambleWord) return;
  scrambleSolved = true;
  speak("Die Lösung war " + scrambleWord.de, "DE");
  render();
}
function showWritingSolution() {
    const w = exerciseWords[currentExerciseIndex];
    if (!w) return;

    writingInputValue = w.de;
    speak("Die Lösung ist " + w.de, "DE");
    render();
}

/* ===============================
   EVENTS (DELEGATION, robust)
   =============================== */

document.addEventListener("click", (e) => {
  // Sprachwechsel (auch wenn man auf Text im Button klickt)
  const langBtn = e.target.closest?.(".lang-btn");
  if (langBtn) {
    currentLang = langBtn.dataset.lang;

    initWriting();
    initMemory();
    initScramble();
    render();
    return;
  }

  // Tabwechsel
  const tabBtn = e.target.closest?.(".tab-btn");
  if (tabBtn) {
    currentView = tabBtn.dataset.view;
    render();
  }
});

// für manche Browser: Stimmen erst nach load verfügbar
window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});
