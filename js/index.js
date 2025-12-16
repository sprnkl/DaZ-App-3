console.log("index.js geladen");

// ===== index.js – NUR für index.html =====

let currentLang = "DE";
let metaData = null;

// ===============================
// Modul-Zuordnung (mehrsprachig)
// ===============================
const moduleMap = {
  1: {
    start: 1,
    end: 8,
    emoji: "🏫",
    titles: {
      DE: "Modul 1: Ich und mein Schulalltag",
      AR: "الوحدة 1: أنا والمدرسة",
      RU: "Модуль 1: Я и школа",
      FA: "ماژول ۱: من و مدرسه",
      RO: "Modulul 1: Eu și școala"
    }
  },
  9: {
    start: 9,
    end: 15,
    emoji: "👨‍👩‍👧",
    titles: {
      DE: "Modul 2: Alltag, Familie und Freizeit",
      AR: "الوحدة 2: الحياة اليومية والعائلة",
      RU: "Модуль 2: Повседневная жизнь и семья",
      FA: "ماژول ۲: زندگی روزمره و خانواده",
      RO: "Modulul 2: Viața zilnică și familia"
    }
  },
  16: {
    start: 16,
    end: 25,
    emoji: "🇩🇪",
    titles: {
      DE: "Modul 3: Leben in Deutschland",
      AR: "الوحدة 3: الحياة في ألمانيا",
      RU: "Модуль 3: Жизнь в Германии",
      FA: "ماژول ۳: زندگی در آلمان",
      RO: "Modulul 3: Viața în Germania"
    }
  },
  26: {
    start: 26,
    end: 34,
    emoji: "🎉",
    titles: {
      DE: "Modul 4: Feste, Kultur und Traditionen",
      AR: "الوحدة 4: الأعياد والثقافة",
      RU: "Модуль 4: Праздники и культура",
      FA: "ماژول ۴: جشن‌ها و فرهنگ",
      RO: "Modulul 4: Sărbători și cultură"
    }
  },
  35: {
    start: 35,
    end: 44,
    emoji: "🧑‍🎓",
    titles: {
      DE: "Modul 5: Jugend, Schule und Zukunft",
      AR: "الوحدة 5: الشباب والمستقبل",
      RU: "Модуль 5: Молодёжь и будущее",
      FA: "ماژول ۵: نوجوانان و آینده",
      RO: "Modulul 5: Tineret și viitor"
    }
  }
};

// ===============================
// TTS
// ===============================
function speak(text, langCode) {
  const u = new SpeechSynthesisUtterance(text);

  const map = {
    DE: "de-DE",
    AR: "ar-SA",
    RU: "ru-RU",
    FA: "fa-IR",
    RO: "ro-RO"
  };

  u.lang = map[langCode] || "de-DE";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ===============================
// Laden
// ===============================
async function loadIndex() {
  const metaRes = await fetch("data/meta.json");
  metaData = await metaRes.json();
  renderIndex();
}

// ===============================
// Render Index
// ===============================
async function renderIndex() {
  const container = document.getElementById("lesson-list-container");
  container.innerHTML = "";

  for (const mod of Object.values(moduleMap)) {

    const deTitle = mod.titles.DE;
    const foreignTitle = mod.titles[currentLang] || deTitle;

    /* ---------- MODULÜBERSCHRIFT ---------- */
    const h2 = document.createElement("div");
    h2.className =
      "flex justify-between items-center mt-8 mb-4 border-b pb-2 text-indigo-700";

    h2.innerHTML = `
      <h2 class="text-2xl font-semibold">
        ${mod.emoji} ${deTitle}
        <div class="text-sm text-gray-600 font-normal">
          ${foreignTitle}
        </div>
      </h2>

      <div class="flex gap-2">
        <button
          onclick="speak('${deTitle.replace(/'/g, "\\'")}', 'DE')"
          title="Modul auf Deutsch"
          class="text-blue-600 font-semibold"
        >🔊</button>

        <button
          onclick="speak('${foreignTitle.replace(/'/g, "\\'")}', '${currentLang}')"
          title="Modul übersetzt"
          class="text-indigo-600 font-semibold"
        >🌍</button>
      </div>
    `;

    container.appendChild(h2);

    /* ---------- LEKTIONEN ---------- */
    const ul = document.createElement("ul");
    ul.className = "space-y-3";

    for (let i = mod.start; i <= mod.end; i++) {
      const res = await fetch(`data/Lektion${i}.json`);
      if (!res.ok) continue;

      const lesson = await res.json();
      const lDe = lesson.title.DE;
      const lForeign = lesson.title[currentLang] || lDe;

      const li = document.createElement("li");
      li.className =
        "bg-indigo-100 p-4 rounded-lg shadow-md hover:bg-indigo-200 transition";

      li.innerHTML = `
        <div class="flex justify-between items-center gap-4">
          <a href="lektion.html?lesson=Lektion${i}" class="flex-1 font-semibold text-indigo-800">
            Lektion ${i}: ${lDe}
            <div class="text-sm text-gray-600">${lForeign}</div>
          </a>

          <div class="flex gap-2">
            <button
              onclick="event.preventDefault(); event.stopPropagation(); speak('${lDe.replace(/'/g, "\\'")}', 'DE')"
              class="text-blue-600 font-semibold"
            >🔊</button>

            <button
              onclick="event.preventDefault(); event.stopPropagation(); speak('${lForeign.replace(/'/g, "\\'")}', '${currentLang}')"
              class="text-indigo-600 font-semibold"
            >🌍</button>
          </div>
        </div>
      `;

      ul.appendChild(li);
    }

    container.appendChild(ul);
  }
}

// ===============================
// Sprache wechseln
// ===============================
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    currentLang = e.target.dataset.lang;
    renderIndex();
  });
});

document.addEventListener("DOMContentLoaded", loadIndex);
