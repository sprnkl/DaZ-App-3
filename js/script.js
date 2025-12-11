// --- 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (Состояние и настройки) ---

let allLessonData = {};
let currentLessonKey = "Lektion1";
let currentLang = "DE";
let currentView = 'vocabulary'; 
let isRTL = false;
const synth = window.speechSynthesis;

// Состояние ИГР/УПРАВЛЕНИЙ
let memoryCards = [];
let memoryFlipped = [];
let memoryMatched = [];
let memoryLock = false;
let startTime = null;
let elapsedTime = 0;
let timerInterval = null;

let scrambleWord = {};
let scrambleInput = "";
let scrambleSolved = false;

let exerciseWords = []; // Пул для упражнения 'Begriffe schreiben' (30 слов)
let currentExerciseIndex = 0;
let exerciseSubmitted = false; // Состояние для кнопки 'Nächste Aufgabe'


// --- 2. ОСНОВНЫЕ ФУНКЦИИ (TTS и DOM-утилиты) ---

/**
 * Функция синтеза речи (TTS) на немецком.
 * @param {string} text - Текст для озвучивания.
 */
function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.8; 
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('de'));
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
}

/**
 * Переворачивает карточку. Работает только в режиме "Wortschatz".
 */
function toggleCard(cardElement) {
    const inner = cardElement.querySelector('.flip-card-inner');
    if (inner && currentView === 'vocabulary') {
        inner.classList.toggle('flipped');
    }
}

/**
 * Обработчик аудио-кнопки.
 */
function playAudio(event, text) {
    event.stopPropagation(); 
    speak(text); 
}
/**
 * Spricht fremdsprachigen Text (z.B. Arabisch).
 */
function speakForeign(text, langCode) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    let bcp47;
    if (langCode === 'AR') bcp47 = 'ar-SA';
    else if (langCode === 'FA') bcp47 = 'fa-IR';
    else if (langCode === 'RU') bcp47 = 'ru-RU';
    else if (langCode === 'RO') bcp47 = 'ro-RO';
    else bcp47 = 'de-DE';

    utterance.lang = bcp47;
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith(bcp47.substring(0, 2)));
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
}

// --- 3. ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ДАННЫХ ---

async function initializeLesson(lessonKey) {
    currentLessonKey = lessonKey;
    try {
        const metaResponse = await fetch('data/meta.json'); 
        if (!metaResponse.ok) throw new Error('meta.json nicht gefunden.');
        const metaData = await metaResponse.json(); 
        
        const filePath = `data/${lessonKey}.json`; 
        const response = await fetch(filePath); 
        if (!response.ok) throw new Error(`Die Datei ${lessonKey}.json wurde nicht gefunden.`);
        
        const lessonContent = await response.json();
        
        allLessonData = { [lessonKey]: lessonContent, meta: metaData };
        currentLang = metaData.defaultLang; 
        
        initMemoryGame();
        initScrambleGame(); 
        initWritingGame();

        bindEventListeners();
        updateUI();

    } catch (error) {
        const area = document.getElementById('content-area');
        area.innerHTML = `<div class="text-red-600 p-6 font-bold text-center border-2 border-red-500 rounded-lg">
            FEHLER BEIM LADEN DER DATEN:
            <p class="text-gray-700 font-normal mt-2">${error.message}</p>
        </div>`;
        console.error("Modul-Ladefehler:", error.message);
    }
}

// Инициализирует пул слов для Vokabeltrainer'а
function initWritingGame() {
    const lesson = allLessonData[currentLessonKey];
    if (!lesson || !lesson.vocabulary || lesson.vocabulary.length === 0) {
        exerciseWords = [];
        return;
    }
    
    // Создаем пул из всех 30 слов
    exerciseWords = lesson.vocabulary.map(v => ({
        answerKey: v.DE,
        // ИСПРАВЛЕНИЕ: Гарантируем, что targetLang не будет undefined, используя DE как резерв.
        targetLang: v[currentLang] || v.DE, 
        emoji: v.emoji_icon
    }));
    
    // Перемешиваем для случайного порядка
    exerciseWords.sort(() => 0.5 - Math.random());
    currentExerciseIndex = 0;
    exerciseSubmitted = false;
    scrambleInput = ""; // СБРОС ВВОДА ПРИ СТАРТЕ НОВОЙ ИГРЫ
}

// --- 4. РЕНДЕРИНГ ИНТЕРФЕЙСА (ДЕТЕРМИНИРОВАННЫЙ РЕНДЕР) ---

function updateUI() {
    const lesson = allLessonData[currentLessonKey];
    if (!lesson || !lesson.title) return;

    // 1. Обновление заголовка и кнопок языка
    isRTL = allLessonData.meta.rtlLangs.includes(currentLang);
    document.body.classList.toggle('rtl', isRTL);
    document.getElementById('lesson-title').textContent = lesson.title.DE + " (" + (lesson.title[currentLang] || lesson.title.DE) + ")";

    document.querySelectorAll('.lang-btn').forEach(btn => {
        const isSelected = btn.dataset.lang === currentLang;
        btn.classList.toggle('bg-blue-600', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-700', !isSelected);
    });

    // 2. Скрытие/показ активной View
    document.querySelectorAll('.active-view').forEach(view => {
        const isCurrentView = view.id === `${currentView}-view`;
        view.classList.toggle('hidden', !isCurrentView);
        
        // 3. Рендеринг контента внутри активной View (ЕСЛИ ОНА АКТИВНА)
        if (isCurrentView) {
            let html = '';
            // Все функции рендеринга возвращают строку HTML
            if (currentView === 'vocabulary') html = renderVocabulary(lesson);
            else if (currentView === 'exercises') html = renderExercises(lesson);
            else if (currentView === 'memory') html = renderMemory(lesson);
            else if (currentView === 'scramble') html = renderScramble(lesson);

            // Очистка и вставка контента в целевой контейнер
            const targetContainer = document.getElementById(`${currentView}-container`) || document.getElementById('vocabulary-list');
             if (targetContainer) targetContainer.innerHTML = html;
        }
    });
}

// Вспомогательная функция для рендеринга Vokabeltrainer'а
function renderExercises(lesson) {
    
    // Если пустой массив, показываем сообщение об ошибке
    if (exerciseWords.length === 0) {
        return `<h2 class="text-2xl font-bold mb-4 text-indigo-700">Begriffe schreiben (Übung 0 / 0)</h2>
                <p class="p-4 bg-yellow-100 rounded">Keine Vokabeln für diese Übung verfügbar.</p>`;
    }

    // Если все задания выполнены
    if (currentExerciseIndex >= exerciseWords.length) {
        return `
            <h2 class="text-2xl font-bold mb-4 text-indigo-700">Begriffe schreiben</h2>
            <div class="p-6 bg-green-100 rounded-lg text-center">
                <h3 class="text-2xl font-bold text-green-700">🎉 Alle ${exerciseWords.length} Vokabeln geübt!</h3>
                <p class="text-gray-600 mt-2">Klicken Sie auf 'Nochmal spielen', um die Vokabeln erneut in zufälliger Reihenfolge zu üben.</p>
                <button onclick="initWritingGame(); updateUI()" class="mt-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition shadow-md">
                    Nochmal spielen 🔁
                </button>
            </div>
        `;
    }

    const currentWord = exerciseWords[currentExerciseIndex];
    const answerKey = currentWord.answerKey;
    const nextButtonHidden = exerciseSubmitted ? '' : 'hidden';
    
    // Рендерим форму для текущего слова
    const formHtml = renderDynamicVocabularyGapFill(currentWord);
    
    // Создаем форму с инпутом и кнопками
    return `
        <h2 class="text-2xl font-bold mb-4 text-indigo-700">Begriffe schreiben (Übung ${currentExerciseIndex + 1} / ${exerciseWords.length})</h2>
        <div class="mb-8 border border-indigo-200 p-4 rounded-lg bg-indigo-50">
            <h3 class="text-xl font-semibold mb-4">Aufgabe: Vokabel #${currentExerciseIndex + 1}</h3>
            
            ${formHtml}
        </div>

        <div class="mt-6 pt-4 border-t border-indigo-200 flex justify-between">
            <button onclick="initWritingGame(); updateUI()" class="bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-500 transition shadow-md">
                Neustart 🔄
            </button>
            <button onclick="nextExercise()" id="next-exercise-btn" class="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition shadow-md ${nextButtonHidden}">
                Nächste Aufgabe ➡️
            </button>
        </div>
    `;
}

// NEU: Функция zum Weiterschalten zur nächsten Aufgabe
function nextExercise() {
    currentExerciseIndex++;
    exerciseSubmitted = false;
    scrambleInput = "";  // ВАЖНО: очистить Eingabe
    updateUI();
}


// --- 6. HILFSFUNKTIONEN FÜR ÜBUNGEN (Dynamische Generierung) ---

// NEU: Generiert Lückentext-Übung für jede Vokabel
function renderDynamicVocabularyGapFill(currentWord) {
    const answerKey = currentWord.answerKey;
    const translation = currentWord.targetLang;
    const emoji = currentWord.emoji;

    let sentenceTemplate;
    
    if (currentLang === 'DE' || !translation || translation === answerKey) {
        // РЕЖИМ DEUTSCH: Просто переписать слово
        sentenceTemplate = `Gib das Wort: <span class="font-bold text-indigo-700">${answerKey}</span> noch einmal ein. ${emoji}`;
    } else {
        // РЕЖИМ ПЕРЕВОДА: Перевести с целевого языка
        sentenceTemplate = `Bitte schreibe das deutsche Wort für: <span class="font-bold text-indigo-700 ${isRTL ? 'rtl' : 'ltr'}">${translation}</span> ${emoji}`;
    }
    
    // Устанавливаем значения для рендеринга
    const inputDisabled = exerciseSubmitted ? 'disabled' : '';
    const inputFieldValue = scrambleInput; // Сохраняем ввод пользователя
    
    return `
        <form onsubmit="checkWritingAnswer(event, '${answerKey}', 'feedback-dynamic')" class="space-y-4">
            <p class="text-lg font-medium ltr mb-4">
                ${sentenceTemplate}
            </p>
            
            <input type="text" oninput="saveInput(this.value)" id="input-dynamic" value="${inputFieldValue}"
                class="inline-block w-full sm:w-64 p-3 border-2 border-indigo-400 rounded-md focus:border-indigo-600 focus:ring focus:ring-indigo-200 transition-colors"
                placeholder="Antwort (DE)" ${inputDisabled} autofocus>
            
            <div id="feedback-dynamic" class="text-lg font-bold mt-3">
                ${exerciseSubmitted ? `<span class="text-green-600">✅ Richtig! Das Wort war: ${answerKey}</span>` : ''}
            </div>

            <div class="flex space-x-3 pt-3">
                <button type="submit" ${inputDisabled} class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition shadow-md ${inputDisabled ? 'opacity-50 cursor-default' : ''}">
                    Antwort prüfen
                </button>

                <button type="button" onclick="showWritingHint('${answerKey}')" ${inputDisabled} class="bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-500 transition shadow-md ${inputDisabled ? 'opacity-50 cursor-default' : ''}">
                    Tipp
                </button>
                
                <!-- NEU: BUTTON FÜR LÖSUNGSANZEIGE -->
                <button type="button" onclick="showWritingSolution()" ${inputDisabled} class="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition shadow-md ${inputDisabled ? 'opacity-50 cursor-default' : ''}">
                    Lösung zeigen 💡
                </button>
            </div>
        </form>
    `;
}

// НЕОБХОДИМЫЕ ГЛОБАЛЬНЫЕ ФУНКЦИИ

function nextExercise() {
    currentExerciseIndex++;
    exerciseSubmitted = false;
    scrambleInput = "";  // ВАЖНО: очистить Eingabe
    updateUI();
}

function saveInput(value) {
    scrambleInput = value;
}

function checkWritingAnswer(e, correctAnswer, feedbackId) {
    e.preventDefault();
    const input = e.target.closest('form').querySelector('#input-dynamic').value.trim().toLowerCase();
    const feedbackDiv = document.getElementById(feedbackId);
    
    const sanitizedInput = input.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    const sanitizedCorrect = correctAnswer.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    
    if (sanitizedInput === sanitizedCorrect) {
        exerciseSubmitted = true;
        speak("Korrekt!");
        scrambleInput = correctAnswer; // Показываем корректный ответ в поле ввода
    } else {
        feedbackDiv.className = "text-lg font-bold mt-3 text-red-600";
        feedbackDiv.textContent = `❌ Falsch. Versuche es noch einmal.`;
        exerciseSubmitted = false;
        speak("Falsch!");
    }
    updateUI(); 
}

function showWritingHint(answerKey) {
    const hintMessage = "Das Wort beginnt mit " + answerKey.charAt(0).toUpperCase();
    const existingMessage = document.getElementById(`hint-box-dynamic`);
    if(existingMessage) existingMessage.remove();

    const form = document.querySelector('#exercises-container form');
    const feedbackDiv = document.getElementById('feedback-dynamic');

    if (!form || !feedbackDiv) return;

    const hintBox = document.createElement('div');
    hintBox.id = `hint-box-dynamic`;
    hintBox.className = "mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm";
    hintBox.textContent = hintMessage;
    
    form.insertBefore(hintBox, feedbackDiv);
}

// Обработчик кнопки "Показать решение"
function showWritingSolution() {
    const currentWord = exerciseWords[currentExerciseIndex];
    if (!currentWord) return;
    
    exerciseSubmitted = true;
    scrambleInput = currentWord.answerKey; // Устанавливаем ввод для отображения в поле
    
    speak("Die Lösung war: " + currentWord.answerKey);
    
    updateUI(); // Перерисовываем, чтобы показать ответ и отключить ввод
}

// --- 7. GLOBALISIERUNG, SPIELE UND EVENT LISTENER ---

function getWordsForGames() {
    const lesson = allLessonData[currentLessonKey];
    if (!lesson || !lesson.vocabulary) return [];

    return lesson.vocabulary.map(v => ({
        de: v.DE,
        targetLang: v[currentLang] || v.DE, 
        emoji_icon: v.emoji_icon
    }));
}

// --- MEMORY GAME LOGIC ---

function initMemoryGame() {
    const pool = getWordsForGames();
    if (pool.length < 3) return; 

    const numPairs = Math.min(6, Math.floor(pool.length / 2));
    let subset = [];
    const poolCopy = [...pool];
    
    for (let i = 0; i < numPairs; i++) {
        const randomIndex = Math.floor(Math.random() * poolCopy.length);
        subset.push(poolCopy[randomIndex]);
        poolCopy.splice(randomIndex, 1);
    }

    let cards = [];
    
    subset.forEach((w, i) => {
        cards.push({ id: i + 'a', type: 'de', text: w.de, matchId: i, emoji_icon: '🇩🇪' });
        cards.push({ id: i + 'b', type: 'target', text: w.targetLang, matchId: i, emoji_icon: w.emoji_icon }); 
    });

    memoryCards = cards.sort(() => 0.5 - Math.random());
    memoryFlipped = [];
    memoryMatched = [];
    memoryLock = false;
    
    clearInterval(timerInterval);
elapsedTime = 0;
startTime = null;   // WICHTIG: Timer ist NICHT gestartet
timerInterval = null;
}

function updateTimer() {
    elapsedTime = Date.now() - startTime;
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        const seconds = Math.floor(elapsedTime / 1000);
        const milliseconds = Math.floor((elapsedTime % 1000) / 100);
        timerDisplay.textContent = `Zeit: ${seconds}.${milliseconds}s`;
    }
}

function flipMemoryCard(idx) {
    // Timer erst starten, wenn erste Karte geklickt wird
if (startTime === null) {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);
}
    if (memoryLock) return;
    if (memoryFlipped.includes(idx)) return;
    if (memoryMatched.includes(memoryCards[idx].matchId)) return;
    if (memoryFlipped.length === 2) return;

    memoryFlipped.push(idx);
    updateUI();

    if (memoryFlipped.length === 2) {
        memoryLock = true;
        const c1 = memoryCards[memoryFlipped[0]];
        const c2 = memoryCards[memoryFlipped[1]];

        if (c1.matchId === c2.matchId && c1.type !== c2.type) {
            memoryMatched.push(c1.matchId);
            memoryFlipped = [];
            memoryLock = false;
            speak("Korrekt!");
            updateUI();

            if (memoryMatched.length === memoryCards.length / 2) {
                 speak("Glückwunsch! Spiel beendet!");
                 clearInterval(timerInterval); 
                 updateUI(); 
            }
        } else {
            speak("Falsch!");
            setTimeout(() => {
                memoryFlipped = [];
                memoryLock = false;
                updateUI();
            }, 1200);
        }
    }
}


function renderMemory(lesson) {
    const cards = memoryCards;
    
    if (cards.length === 0) {
        return `<p class="p-4 bg-yellow-100 rounded text-center">Nicht genug Vokabeln (mindestens 6) für dieses Spiel vorhanden.</p>`;
    }
    
    const finalTime = timerInterval === null && memoryMatched.length === cards.length / 2 
        ? `<div class="text-lg font-bold text-green-600 mt-2">Endzeit: ${(elapsedTime / 1000).toFixed(2)} Sekunden</div>`
        : `<div id="timer-display" class="font-bold text-gray-800">Zeit: 0.0s</div>`;


    return `
        <h2 class="text-2xl font-bold mb-4 text-purple-700">🃏 Wörtermemorie (Matching Game)</h2>
        
        <div class="flex justify-between items-center mb-4 p-2 bg-gray-100 rounded-lg shadow-inner">
            <p class="text-sm text-gray-600">Finde die passenden deutschen und fremdsprachigen Paare.</p>
            
            <!-- TIMER ANZEIGE -->
            ${finalTime}
            
            <button onclick="initMemoryGame(); updateUI()" class="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-purple-700">
                Neustart 🔄
            </button>
        </div>
        
        <div class="grid grid-cols-4 gap-3">
            ${cards.map((card, idx) => {
                const isFlipped = memoryFlipped.includes(idx) || memoryMatched.includes(card.matchId);
                const isMatched = memoryMatched.includes(card.matchId);
                
                const textContent = card.type === 'de' ? card.text : card.text;

                return `
                    <div onclick="flipMemoryCard(${idx})" class="perspective h-24 cursor-pointer group">
                        <div class="relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}" style="transition: transform 0.6s;">
                            <!-- Verdeckte Karte -->
                            <div class="absolute w-full h-full bg-purple-600 rounded-xl flex items-center justify-center text-white text-3xl shadow-md backface-hidden" style="backface-visibility: hidden;">❓</div>
                            <!-- Offene Karte -->
                            <div class="absolute w-full h-full ${isMatched ? 'bg-green-100 border-green-500' : 'bg-white'} border-2 rounded-xl flex flex-col items-center justify-center shadow-md backface-hidden p-1" style="transform: rotateY(180deg); backface-visibility: hidden;">
                                <span class="text-2xl">${card.type === 'de' ? '🇩🇪' : card.emoji_icon || '💡'}</span>
                                <span class="font-bold text-center text-xs sm:text-sm p-1 leading-tight text-gray-800">${textContent}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        ${memoryMatched.length === cards.length / 2 ? '<div class="text-center text-green-600 font-bold text-xl mt-6">🎉 Glückwunsch! Spiel beendet.</div>' : ''}
    `;
}

// --- SCRAMBLE GAME LOGIC ---

function initScrambleGame() {
    const pool = getWordsForGames().filter(w => w.de && w.de.length > 3);
    if (pool.length === 0) return;

    scrambleWord = pool[Math.floor(Math.random() * pool.length)];
    scrambleInput = "";
    scrambleSolved = false; 
}

function showScrambleSolution() {
    scrambleSolved = true;
    speak("Die Lösung war: " + scrambleWord.de);
    
    setTimeout(() => {
        initScrambleGame();
        updateUI();
    }, 2500);
    updateUI(); 
}


function checkScramble(val) {
    scrambleInput = val;
    
    if (val.toLowerCase().trim() === scrambleWord.de.toLowerCase()) {
        scrambleSolved = true;
        speak("Korrekt!");
        setTimeout(() => {
            initScrambleGame();
            updateUI();
        }, 1500);
    } else {
        updateUI(); 
    }
}


function renderScramble(lesson) {
    
    if (!scrambleWord.de) {
         initScrambleGame();
         if (!scrambleWord.de) {
            return `<p class="p-4 bg-yellow-100 rounded text-center">Nicht genug Vokabeln (mindestens 4 Buchstaben) für dieses Spiel vorhanden.</p>`;
         }
    }

    const word = scrambleWord;
    const scrambledLetters = word.de.split('').sort(() => 0.5 - Math.random()).join(' ');
    
    const displayWord = scrambleSolved ? word.de : scrambledLetters;
    const isCorrect = scrambleInput.toLowerCase().trim() === word.de.toLowerCase();
    
    const translationText = word.targetLang;


    return `
        <h2 class="text-2xl font-bold mb-4 text-yellow-700">🧩 Buchstabensalat (Worträtsel)</h2>
        <div class="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl text-center border border-gray-100">
            <div class="text-6xl mb-4">${word.emoji_icon || '💡'}</div>
            
            <div class="bg-yellow-50 p-4 rounded-xl mb-6 border border-yellow-200">
                <p class="text-yellow-800 font-mono text-3xl tracking-widest font-bold">${displayWord}</p>
            </div>
            <p class="text-sm text-gray-600 mb-3">Welches deutsche Wort versteckt sich hier? (${translationText})</p>

            <input type="text" oninput="checkScramble(this.value)" value="${scrambleInput}"
                class="w-full text-center text-2xl p-3 border-b-4 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-300 focus:border-yellow-500'} outline-none transition-all placeholder-gray-300 mb-4"
                placeholder="Geben Sie das Wort hier ein..." ${isCorrect || scrambleSolved ? 'disabled' : 'autofocus'}>
            
            ${isCorrect ? 
                `<div class="text-green-600 font-bold text-xl">✅ Korrekt! Das war: ${word.de}</div>` : 
                scrambleSolved ? 
                `<div class="text-red-600 font-bold text-xl">Die Lösung war: ${word.de}</div>` :
                `<div class="text-gray-400 text-sm flex justify-between px-4"><span>${word.de.length} Buchstaben</span></div>`
            }
            
            <div class="flex justify-between mt-8">
                <button onclick="initScrambleGame(); updateUI()" class="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-blue-200">
                    Nächstes Wort ⏩
                </button>
                <button onclick="showScrambleSolution()" ${isCorrect || scrambleSolved ? 'disabled' : ''}
                        class="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-red-200 disabled:opacity-50">
                    Lösung zeigen 💡
                </button>
            </div>
        </div>
    `;
}

// Вспомогательная функция для рендеринга Vokabel-View
function renderVocabulary(lesson) {
    const listContainer = document.getElementById('vocabulary-list');
    let html = '';
    
    if (!lesson.vocabulary) return html;
    
    lesson.vocabulary.forEach(item => {
        const langText = item[currentLang] || item.DE;
        const emoji = item.emoji_icon || '💡';

        // Fremdsprachliche Texte enthalten manchmal '
        const safeLangText = langText.replace(/'/g, "\\'");
        
        html += `
            <div class="flip-card cursor-pointer" onclick="toggleCard(this)">
                <div class="flip-card-inner">
                    
                    <!-- FRONTSEITE (DEUTSCH) -->
                    <div class="flip-card-front bg-indigo-50 p-4 border border-indigo-200 rounded-lg shadow-md flex items-center justify-between">
                        <div class="flex items-center">
                            <span class="text-2xl w-10 h-10 flex items-center justify-center mr-3">${emoji}</span>
                            <div class="font-bold text-lg text-gray-900">${item.DE}</div>
                        </div>

                        <button onclick="playAudio(event, '${item.DE}')" 
                                class="audio-btn text-blue-500 hover:text-blue-700 transition p-2 rounded-full flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M15.54 8.46a5.99 5.99 0 0 1 0 7.08"></path>
                            </svg>
                        </button>
                    </div>

                    <!-- RÜCKSEITE (FREMDSPRACHE + VORLESEN BUTTON) -->
                    <div class="flip-card-back bg-indigo-200 p-4 border border-indigo-400 rounded-lg shadow-md 
                        flex flex-col items-center justify-center ${isRTL ? 'rtl' : 'ltr'}">

                        <div class="text-xl font-semibold text-gray-800 mb-2">${langText}</div>

                        ${
                            currentLang !== "DE"
                            ? `
                                <button onclick="event.stopPropagation(); speakForeign('${safeLangText}', '${currentLang}')"
                                    class="text-blue-700 hover:text-blue-900 transition text-sm font-semibold 
                                           flex items-center space-x-1 mt-1">
                                    <span>Vorlesen</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                        fill="none" stroke="currentColor" stroke-width="2"
                                        stroke-linecap="round" stroke-linejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                        <path d="M15.54 8.46a5.99 5.99 0 0 1 0 7.08"></path>
                                    </svg>
                                </button>
                              `
                            : ''
                        }

                    </div>
                </div>
            </div>
        `;
    });

    return html;
}


// Вспомогательная функция для рендеринга Writing-View
function renderExercises(lesson) {

    if (exerciseWords.length === 0) {
         return `<p class="p-4 bg-yellow-100 rounded">Keine Vokabeln für diese Übung verfügbar.</p>`;
    }

    if (currentExerciseIndex >= exerciseWords.length) {
        return `
            <div class="p-6 bg-green-100 rounded-lg text-center">
                <h3 class="text-2xl font-bold text-green-700">🎉 Alle ${exerciseWords.length} Vokabeln geübt!</h3>
                <p class="text-gray-600 mt-2">Klicken Sie auf 'Nochmal spielen', um die Vokabeln erneut in zufälliger Reihenfolge zu üben.</p>
                <button onclick="initWritingGame(); updateUI()" class="mt-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition shadow-md">
                    Nochmal spielen 🔁
                </button>
            </div>
        `;
    }

    const currentWord = exerciseWords[currentExerciseIndex];
    const answerKey = currentWord.answerKey;
    const nextButtonHidden = exerciseSubmitted ? '' : 'hidden';
    
    // Рендерим форму для текущего слова
    const formHtml = renderDynamicVocabularyGapFill(currentWord);
    
    // Создаем форму с инпутом и кнопками
    return `
        <h2 class="text-2xl font-bold mb-4 text-indigo-700">Begriffe schreiben (Übung ${currentExerciseIndex + 1} / ${exerciseWords.length})</h2>
        <div class="mb-8 border border-indigo-200 p-4 rounded-lg bg-indigo-50">
            <h3 class="text-xl font-semibold mb-4">Aufgabe: Vokabel #${currentExerciseIndex + 1}</h3>
            
            ${formHtml}
        </div>

        <div class="mt-6 pt-4 border-t border-indigo-200 flex justify-between">
            <button onclick="initWritingGame(); updateUI()" class="bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-500 transition shadow-md">
                Neustart 🔄
            </button>
            <button onclick="nextExercise()" id="next-exercise-btn" class="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition shadow-md ${nextButtonHidden}">
                Nächste Aufgabe ➡️
            </button>
        </div>
    `;
}

function renderDynamicVocabularyGapFill(currentWord) {
    const answerKey = currentWord.answerKey;
    const translation = currentWord.targetLang;
    const emoji = currentWord.emoji;

    let sentenceTemplate;
    
    if (currentLang === 'DE' || !translation || translation === answerKey) {
        // РЕЖИМ DEUTSCH: Просто переписать слово
        sentenceTemplate = `Gib das Wort: <span class="font-bold text-indigo-700">${answerKey}</span> noch einmal ein. ${emoji}`;
    } else {
        // РЕЖИМ ПЕРЕВОДА: Перевести с целевого языка
        sentenceTemplate = `Bitte schreibe das deutsche Wort für: <span class="font-bold text-indigo-700 ${isRTL ? 'rtl' : 'ltr'}">${translation}</span> ${emoji}`;
    }
    
    // Устанавливаем значения для рендеринга
    const inputDisabled = exerciseSubmitted ? 'disabled' : '';
    const inputFieldValue = scrambleInput; // Сохраняем ввод пользователя
    
    return `
        <form onsubmit="checkWritingAnswer(event, '${answerKey}', 'feedback-dynamic')" class="space-y-4">
            <p class="text-lg font-medium ltr mb-4">
                ${sentenceTemplate}
            </p>
            
            <input type="text" oninput="saveInput(this.value)" id="input-dynamic" value="${inputFieldValue}"
                class="inline-block w-full sm:w-64 p-3 border-2 border-indigo-400 rounded-md focus:border-indigo-600 focus:ring focus:ring-indigo-200 transition-colors"
                placeholder="Antwort (DE)" ${inputDisabled} autofocus>
            
            <div id="feedback-dynamic" class="text-lg font-bold mt-3">
                ${exerciseSubmitted ? `<span class="text-green-600">✅ Richtig! Das Wort war: ${answerKey}</span>` : ''}
            </div>

            <div class="flex space-x-3 pt-3">
                <button type="submit" ${inputDisabled} class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition shadow-md ${inputDisabled ? 'opacity-50 cursor-default' : ''}">
                    Antwort prüfen
                </button>

                <button type="button" onclick="showWritingHint('${answerKey}')" ${inputDisabled} class="bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-500 transition shadow-md ${inputDisabled ? 'opacity-50 cursor-default' : ''}">
                    Tipp
                </button>
                
                <!-- NEU: BUTTON FÜR LÖSUNGSANZEIGE -->
                <button type="button" onclick="showWritingSolution()" ${inputDisabled} class="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition shadow-md ${inputDisabled ? 'opacity-50 cursor-default' : ''}">
                    Lösung zeigen 💡
                </button>
            </div>
        </form>
    `;
}

function nextExercise() {
    currentExerciseIndex++;
    exerciseSubmitted = false;
    scrambleInput = "";  // ВАЖНО: очистить Eingabe
    updateUI();
}

function saveInput(value) {
    scrambleInput = value;
}

function checkWritingAnswer(e, correctAnswer, feedbackId) {
    e.preventDefault();
    const input = e.target.closest('form').querySelector('#input-dynamic').value.trim().toLowerCase();
    const feedbackDiv = document.getElementById(feedbackId);
    
    const sanitizedInput = input.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    const sanitizedCorrect = correctAnswer.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    
    if (sanitizedInput === sanitizedCorrect) {
        exerciseSubmitted = true;
        speak("Korrekt!");
    } else {
        feedbackDiv.className = "text-lg font-bold mt-3 text-red-600";
        feedbackDiv.textContent = `❌ Falsch. Versuche es noch einmal.`;
        exerciseSubmitted = false;
        speak("Falsch!");
    }
    updateUI(); 
}

function showWritingHint(answerKey) {
    const hintMessage = "Das Wort beginnt mit " + answerKey.charAt(0).toUpperCase();
    const existingMessage = document.getElementById(`hint-box-dynamic`);
    if(existingMessage) existingMessage.remove();

    const form = document.querySelector('#exercises-container form');
    const feedbackDiv = document.getElementById('feedback-dynamic');

    if (!form || !feedbackDiv) return;

    const hintBox = document.createElement('div');
    hintBox.id = `hint-box-dynamic`;
    hintBox.className = "mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-md text-sm";
    hintBox.textContent = hintMessage;
    
    form.insertBefore(hintBox, feedbackDiv);
}

function showWritingSolution() {
    const currentWord = exerciseWords[currentExerciseIndex];
    if (!currentWord) return;
    
    exerciseSubmitted = true;
    scrambleInput = currentWord.answerKey; // Устанавливаем ввод для отображения в поле
    
    speak("Die Lösung war: " + currentWord.answerKey);
    
    updateUI(); // Перерисовываем, чтобы показать ответ и отключить ввод
}

function bindEventListeners() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentLang = e.target.dataset.lang;
            initMemoryGame();
            initScrambleGame();
            initWritingGame(); 
            updateUI();
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentView = e.target.dataset.view;
            
            document.querySelectorAll('.tab-btn').forEach(t => {
                t.classList.remove('tab-active');
                t.classList.add('tab-inactive');
            });
            e.target.classList.remove('tab-inactive');
            e.target.classList.add('tab-active');
            
            updateUI();
        });
    });
}


// --- 8. ЗАПУСК ПРИЛОЖЕНИЯ ---

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lessonKey = urlParams.get("lesson") || "Lektion1";
    
    document.body.dataset.lessonKey = lessonKey;

    if (lessonKey) {
        initializeLesson(lessonKey);
    } else {
        console.error("Критическая ошибка: Не удалось определить ключ урока.");
        document.getElementById('lesson-title').textContent = "ОШИБКА: Урок не найден.";
    }
});

// --- 9. ГЛОБАЛИЗАЦИЯ ФУНКЦИЙ ---

window.initMemoryGame = initMemoryGame;
window.flipMemoryCard = flipMemoryCard;
window.initScrambleGame = initScrambleGame;
window.checkScramble = checkScramble;
window.updateUI = updateUI; 
window.showScrambleSolution = showScrambleSolution;
window.nextExercise = nextExercise;
window.initWritingGame = initWritingGame;
window.checkWritingAnswer = checkWritingAnswer;
window.showWritingHint = showWritingHint;
window.saveInput = saveInput;
window.showWritingSolution = showWritingSolution;