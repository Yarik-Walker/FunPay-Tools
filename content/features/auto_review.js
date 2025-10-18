// content/features/auto_review.js

/**
 * Инициализирует UI для всех функций авто-ответов в настройках FP Tools
 * @param {object} settings - Загруженные настройки из storage (этот параметр больше не нужен, функция сама загрузит)
 */
async function initializeAutoReviewUI() {
    const page = document.querySelector('.fp-tools-page-content[data-page="auto_review"]');
    if (!page || page.dataset.initialized) return;

    // Загружаем сохраненные настройки
    const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
    
    // Устанавливаем значения по умолчанию, если их нет
    const settings = {
        autoReviewEnabled: fpToolsAutoReplies.autoReviewEnabled || false,
        reviewTemplates: fpToolsAutoReplies.reviewTemplates || {},
        greetingEnabled: fpToolsAutoReplies.greetingEnabled || false,
        greetingText: fpToolsAutoReplies.greetingText || 'Здравствуйте! Чем могу помочь?',
        keywordsEnabled: fpToolsAutoReplies.keywordsEnabled || false,
        keywords: fpToolsAutoReplies.keywords || []
    };

    // Заполняем поля в UI
    document.getElementById('autoReviewEnabled').checked = settings.autoReviewEnabled;
    for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`fpt-review-${i}`);
        if (input) input.value = settings.reviewTemplates[i] || '';
    }
    document.getElementById('greetingEnabled').checked = settings.greetingEnabled;
    document.getElementById('greetingText').value = settings.greetingText;
    document.getElementById('keywordsEnabled').checked = settings.keywordsEnabled;
    
    renderKeywordsList(settings.keywords);

    // --- Обработчики для сохранения настроек ---
    
    // Общий обработчик для всех простых полей с задержкой (debounce)
    let saveTimeout;
    const saveOnChange = async () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const currentKeywords = (await chrome.storage.local.get('fpToolsAutoReplies')).fpToolsAutoReplies?.keywords || [];
            const newSettings = {
                autoReviewEnabled: document.getElementById('autoReviewEnabled').checked,
                reviewTemplates: {
                    '5': document.getElementById('fpt-review-5').value,
                    '4': document.getElementById('fpt-review-4').value,
                    '3': document.getElementById('fpt-review-3').value,
                    '2': document.getElementById('fpt-review-2').value,
                    '1': document.getElementById('fpt-review-1').value
                },
                greetingEnabled: document.getElementById('greetingEnabled').checked,
                greetingText: document.getElementById('greetingText').value,
                keywordsEnabled: document.getElementById('keywordsEnabled').checked,
                keywords: currentKeywords 
            };
            await chrome.storage.local.set({ fpToolsAutoReplies: newSettings });
            console.log("FP Tools: Auto-reply settings saved.");
        }, 500); // Сохраняем через 500мс после последнего изменения
    };

    // Привязываем обработчик ко всем полям
    page.querySelectorAll('input[type="checkbox"], textarea').forEach(el => {
        el.addEventListener('change', saveOnChange);
        el.addEventListener('input', saveOnChange);
    });

    // Обработчики для ключевых слов (сохраняют сразу)
    document.getElementById('addKeywordBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('newKeyword').value.trim().toLowerCase();
        const response = document.getElementById('newKeywordResponse').value.trim();

        if (!keyword || !response) {
            showNotification('Заполните оба поля для нового правила.', true);
            return;
        }

        const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
        const keywords = fpToolsAutoReplies.keywords || [];
        keywords.push({ keyword, response });
        fpToolsAutoReplies.keywords = keywords;

        await chrome.storage.local.set({ fpToolsAutoReplies });
        renderKeywordsList(keywords);

        document.getElementById('newKeyword').value = '';
        document.getElementById('newKeywordResponse').value = '';
    });

    document.getElementById('keywords-list-container').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-keyword-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
            const keywords = fpToolsAutoReplies.keywords || [];
            keywords.splice(index, 1);
            fpToolsAutoReplies.keywords = keywords;
            
            await chrome.storage.local.set({ fpToolsAutoReplies });
            renderKeywordsList(keywords);
        }
    });

    page.dataset.initialized = 'true';
}

function renderKeywordsList(keywords) {
    const listContainer = document.getElementById('keywords-list-container');
    if (!listContainer) return;
    
    if (keywords.length === 0) {
        listContainer.innerHTML = '<p class="template-info" style="text-align:center;">Нет правил для ключевых слов.</p>';
        return;
    }

    listContainer.innerHTML = keywords.map((item, index) => `
        <div class="keyword-item">
            <div class="keyword-pair">
                <span class="keyword-key">${item.keyword}</span>
                <span class="keyword-arrow">→</span>
                <span class="keyword-value">${item.response}</span>
            </div>
            <button class="btn btn-default delete-keyword-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');
}

/**
 * Старая логика наблюдателя удалена. Теперь все происходит в background.
 * Эта функция оставлена пустой, чтобы не вызывать ошибок в других частях кода, если они ее вызывают.
 */
async function initializeAutoReview() {
    // Эта функция больше не нужна, так как вся логика перенесена в background.js
}

/**
 * Старая логика наблюдателя удалена.
 */
async function startReviewMonitoring() {
    // Эта функция больше не нужна
}

/**
 * Старая логика наблюдателя удалена.
 */
function checkForNewReviews(reviewTemplates) {
    // Эта функция больше не нужна
}

/**
 * Старая логика наблюдателя удалена.
 */
function detectReviewRating(reviewElement) {
    // Эта функция больше не нужна
}

/**
 * Старая логика наблюдателя удалена.
 */
function generateReviewId(reviewElement) {
    // Эта функция больше не нужна
}

/**
 * Старая логика автоответчика в чате удалена.
 */
async function handleChatAutoResponder(messageText, messageId) {
    // Эта функция больше не нужна
    return false;
}
