// content/features/auto_review.js

/**
 * Инициализирует UI для всех функций авто-ответов в настройках FP Tools
 */
async function initializeAutoReviewUI() {
    const page = document.querySelector('.fp-tools-page-content[data-page="auto_review"]');
    if (!page || page.dataset.initialized) return;

    const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
    
    const settings = {
        autoReviewEnabled: fpToolsAutoReplies.autoReviewEnabled || false,
        reviewTemplates: fpToolsAutoReplies.reviewTemplates || {},
        greetingEnabled: fpToolsAutoReplies.greetingEnabled || false,
        greetingText: fpToolsAutoReplies.greetingText || 'Здравствуйте! Чем могу помочь?',
        keywordsEnabled: fpToolsAutoReplies.keywordsEnabled || false,
        keywords: fpToolsAutoReplies.keywords || [],
        bonusForReviewEnabled: fpToolsAutoReplies.bonusForReviewEnabled || false,
        bonusMode: fpToolsAutoReplies.bonusMode || 'single',
        singleBonusText: fpToolsAutoReplies.singleBonusText || '',
        randomBonuses: fpToolsAutoReplies.randomBonuses || []
    };

    document.getElementById('bonusForReviewEnabled').checked = settings.bonusForReviewEnabled;
    const bonusModeRadio = document.querySelector(`input[name="bonusMode"][value="${settings.bonusMode}"]`);
    if (bonusModeRadio) bonusModeRadio.checked = true;
    document.getElementById('singleBonusText').value = settings.singleBonusText;
    
    const singleBonusContainer = document.getElementById('singleBonusContainer');
    const randomBonusContainer = document.getElementById('randomBonusContainer');
    
    const toggleBonusContainers = () => {
        const mode = document.querySelector('input[name="bonusMode"]:checked').value;
        singleBonusContainer.style.display = mode === 'single' ? 'block' : 'none';
        randomBonusContainer.style.display = mode === 'random' ? 'block' : 'none';
    };
    
    document.querySelectorAll('input[name="bonusMode"]').forEach(radio => {
        radio.addEventListener('change', toggleBonusContainers);
    });
    
    toggleBonusContainers();
    renderBonusesList(settings.randomBonuses);

    document.getElementById('autoReviewEnabled').checked = settings.autoReviewEnabled;
    for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`fpt-review-${i}`);
        if (input) input.value = settings.reviewTemplates[i] || '';
    }
    document.getElementById('greetingEnabled').checked = settings.greetingEnabled;
    document.getElementById('greetingText').value = settings.greetingText;
    document.getElementById('keywordsEnabled').checked = settings.keywordsEnabled;
    
    renderKeywordsList(settings.keywords);

    let saveTimeout;
    const saveOnChange = async () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const storedData = await chrome.storage.local.get('fpToolsAutoReplies');
            const currentSettings = storedData.fpToolsAutoReplies || {};
            
            const newSettings = {
                ...currentSettings,
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
                bonusForReviewEnabled: document.getElementById('bonusForReviewEnabled').checked,
                bonusMode: document.querySelector('input[name="bonusMode"]:checked').value,
                singleBonusText: document.getElementById('singleBonusText').value,
            };
            await chrome.storage.local.set({ fpToolsAutoReplies: newSettings });
            console.log("FP Tools: Auto-reply settings saved.");
        }, 500);
    };

    page.querySelectorAll('input[type="checkbox"], textarea, input[name="bonusMode"]').forEach(el => {
        el.addEventListener('change', saveOnChange);
        el.addEventListener('input', saveOnChange);
    });

    // === НОВАЯ ЛОГИКА ДЛЯ КНОПОК ИЗОБРАЖЕНИЙ ===
    page.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-image-btn')) {
            const textarea = e.target.previousElementSibling;
            if (textarea && textarea.tagName === 'TEXTAREA') {
                handleImageAddClick(textarea);
            }
        }
    });
    // === КОНЕЦ НОВОЙ ЛОГИКИ ===

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
    
    document.getElementById('addBonusBtn').addEventListener('click', async () => {
        const bonusText = document.getElementById('newBonusText').value.trim();
        if (!bonusText) {
            showNotification('Текст бонуса не может быть пустым.', true);
            return;
        }
        
        const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
        const bonuses = fpToolsAutoReplies.randomBonuses || [];
        bonuses.push(bonusText);
        fpToolsAutoReplies.randomBonuses = bonuses;

        await chrome.storage.local.set({ fpToolsAutoReplies });
        renderBonusesList(bonuses);
        document.getElementById('newBonusText').value = '';
    });

    document.getElementById('bonus-list-container').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-bonus-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
            const bonuses = fpToolsAutoReplies.randomBonuses || [];
            bonuses.splice(index, 1);
            fpToolsAutoReplies.randomBonuses = bonuses;
            
            await chrome.storage.local.set({ fpToolsAutoReplies });
            renderBonusesList(bonuses);
        }
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

function renderBonusesList(bonuses) {
    const listContainer = document.getElementById('bonus-list-container');
    if (!listContainer) return;
    
    if (!bonuses || bonuses.length === 0) {
        listContainer.innerHTML = '<p class="template-info" style="text-align:center;">Добавьте хотя бы один бонус.</p>';
        return;
    }

    listContainer.innerHTML = bonuses.map((text, index) => `
        <div class="bonus-item">
            <span class="bonus-text">${text}</span>
            <button class="btn btn-default delete-bonus-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');
}

async function initializeAutoReview() {
    // This function is no longer needed as all logic is in background.js
}
