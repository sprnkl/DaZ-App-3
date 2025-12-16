console.log("index.js geladen");

// ===== index.js – NUR für index.html =====

let currentLang = "DE";
let metaData = null;

// ===============================
// Infotexte (mehrsprachig)
// ===============================
const infoTexts = {
  DE: `
    <p>
      Diese App unterstützt Schülerinnen und Schüler beim Lernen von Deutsch als Zweitsprache (DaZ).
      Sie enthält Wortschatzarbeit, Hörverstehen und Lernspiele zu allen Lektionen.
    </p>
    <p>
      Alle Inhalte sind mehrsprachig. Die Sprache kann oben ausgewählt werden.
      Titel, Begriffe und Vorlesefunktionen passen sich automatisch an.
    </p>
    <p>
      <strong>Hinweis zur Sprachausgabe:</strong><br>
      Die App funktioniert am zuverlässigsten im Browser <strong>Microsoft Edge</strong>,
      da dort alle Sprachfunktionen vollständig unterstützt werden.
    </p>
    <p>
      Auf iPads funktioniert die Sprachausgabe nur, wenn die jeweilige Sprache
      (z. B. Arabisch oder Farsi) in den iOS-Spracheinstellungen installiert ist.
    </p>
  `,

  AR: `
    <p>
      هذا التطبيق يساعد الطلاب على تعلم اللغة الألمانية كلغة ثانية.
      يحتوي على مفردات وتمارين استماع وألعاب تعليمية.
    </p>
    <p>
      جميع المحتويات متعددة اللغات ويمكن تغيير اللغة من الأعلى.
    </p>
    <p>
      يعمل التطبيق بشكل أفضل في متصفح Microsoft Edge بسبب دعم النطق الصوتي.
    </p>
    <p>
      على أجهزة iPad يجب تثبيت حزمة اللغة المناسبة للحصول على النطق الصوتي.
    </p>
  `,

  RU: `
    <p>
      Это приложение помогает изучать немецкий язык как второй язык.
      Содержит лексику, аудирование и учебные игры.
    </p>
    <p>
      Все материалы многоязычны и автоматически адаптируются.
    </p>
    <p>
      Рекомендуется использовать браузер Microsoft Edge для корректной озвучки.
    </p>
    <p>
      На iPad необходимо установить языковые пакеты системы.
    </p>
  `,

  FA: `
    <p>
      این برنامه برای یادگیری زبان آلمانی به عنوان زبان دوم طراحی شده است.
      شامل واژگان، تمرین شنیداری و بازی‌های آموزشی است.
    </p>
    <p>
      محتوا چندزبانه است و زبان از بالا قابل انتخاب است.
    </p>
    <p>
      بهترین مرورگر برای استفاده Microsoft Edge است.
    </p>
    <p>
      در iPad باید بسته‌های زبانی سیستم نصب شده باشند.
    </p>
  `,

  RO: `
    <p>
      Această aplicație sprijină învățarea limbii germane ca limbă secundară.
      Conține vocabular, exerciții audio și jocuri educative.
    </p>
    <p>
      Conținutul este multilingv și se adaptează automat.
    </p>
    <p>
      Se recomandă utilizarea browserului Microsoft Edge.
    </p>
    <p>
      Pe iPad este necesară instalarea pachetelor de limbă.
    </p>
  `
};

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

  /* ---------- INFO-TEXT ---------- */
  const infoBox = document.getElementById("info-text");
  if (infoBox) {
    infoBox.innerHTML = infoTexts[currentLang] || infoTexts.DE;
  }

  /* ---------- MODULE ---------- */
  for (const mod of Object.values(moduleMap)) {

    const deTitle = mod.titles.DE;
    const foreignTitle = mod.titles[currentLang] || deTitle;

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
        <button onclick="speak('${deTitle.replace(/'/g, "\\'")}', 'DE')" class="text-blue-600 font-semibold">🔊</button>
        <button onclick="speak('${foreignTitle.replace(/'/g, "\\'")}', '${currentLang}')" class="text-indigo-600 font-semibold">🌍</button>
      </div>
    `;

    container.appendChild(h2);

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
            <button onclick="event.preventDefault(); event.stopPropagation(); speak('${lDe.replace(/'/g, "\\'")}', 'DE')" class="text-blue-600 font-semibold">🔊</button>
            <button onclick="event.preventDefault(); event.stopPropagation(); speak('${lForeign.replace(/'/g, "\\'")}', '${currentLang}')" class="text-indigo-600 font-semibold">🌍</button>
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
