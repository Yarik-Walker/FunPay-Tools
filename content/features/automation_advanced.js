let automationSettings = {
    dynamicPricing: { enabled: false, rules: [] },
    bulkLotCreation: { enabled: false, templates: [] },
    smartAutoResponder: { enabled: false, rules: [] },
    descriptionUpdater: { enabled: false, schedule: 'daily' }
};

async function initializeAdvancedAutomation() {
    await loadAutomationSettings();
    setupAutomationUI();
    startAutomationTasks();
}

async function loadAutomationSettings() {
    const data = await chrome.storage.local.get('fpToolsAutomation');
    if (data.fpToolsAutomation) {
        automationSettings = { ...automationSettings, ...data.fpToolsAutomation };
    }
}

async function saveAutomationSettings() {
    await chrome.storage.local.set({ fpToolsAutomation: automationSettings });
}

function setupAutomationUI() {
    const automationPage = document.querySelector('.fp-tools-page-content[data-page="automation"]');
    if (!automationPage) return;

    automationPage.innerHTML = `
        <h3>Продвинутая автоматизация</h3>
        
        <div class="automation-section">
            <h4>Динамическое ценообразование</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="dynamic-pricing-enabled">
                <label for="dynamic-pricing-enabled">Включить автоматическое изменение цен</label>
            </div>
            <div id="dynamic-pricing-settings" style="margin-top: 15px; display: none;">
                <div id="pricing-rules-list"></div>
                <button id="add-pricing-rule-btn" class="btn" style="margin-top: 10px;">Добавить правило</button>
            </div>
        </div>

        <div class="automation-section">
            <h4>Массовое создание лотов</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="bulk-creation-enabled">
                <label for="bulk-creation-enabled">Включить массовое создание</label>
            </div>
            <div id="bulk-creation-settings" style="margin-top: 15px; display: none;">
                <button id="create-bulk-lots-btn" class="btn">Создать лоты из шаблона</button>
                <div id="bulk-templates-list" style="margin-top: 15px;"></div>
            </div>
        </div>

        <div class="automation-section">
            <h4>Умный автоответчик</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="smart-responder-enabled">
                <label for="smart-responder-enabled">Включить умный автоответчик</label>
            </div>
            <div id="smart-responder-settings" style="margin-top: 15px; display: none;">
                <div id="smart-rules-list"></div>
                <button id="add-smart-rule-btn" class="btn" style="margin-top: 10px;">Добавить правило</button>
            </div>
        </div>

        <div class="automation-section">
            <h4>Автоматическое обновление описаний</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="description-updater-enabled">
                <label for="description-updater-enabled">Включить автоматическое обновление</label>
            </div>
            <div id="description-updater-settings" style="margin-top: 15px; display: none;">
                <label for="update-schedule">Расписание обновления:</label>
                <select id="update-schedule" class="template-input">
                    <option value="daily">Ежедневно</option>
                    <option value="weekly">Еженедельно</option>
                    <option value="monthly">Ежемесячно</option>
                </select>
                <button id="update-descriptions-now-btn" class="btn" style="margin-top: 10px;">Обновить сейчас</button>
            </div>
        </div>
    `;

    setupAutomationEventListeners();
    renderPricingRules();
    renderSmartRules();
    renderBulkTemplates();
    updateUIFromSettings();
}

function setupAutomationEventListeners() {
    document.getElementById('dynamic-pricing-enabled')?.addEventListener('change', async (e) => {
        automationSettings.dynamicPricing.enabled = e.target.checked;
        document.getElementById('dynamic-pricing-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveAutomationSettings();
    });

    document.getElementById('add-pricing-rule-btn')?.addEventListener('click', showAddPricingRuleModal);
    document.getElementById('bulk-creation-enabled')?.addEventListener('change', async (e) => {
        automationSettings.bulkLotCreation.enabled = e.target.checked;
        document.getElementById('bulk-creation-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveAutomationSettings();
    });

    document.getElementById('create-bulk-lots-btn')?.addEventListener('click', showBulkCreationModal);
    document.getElementById('smart-responder-enabled')?.addEventListener('change', async (e) => {
        automationSettings.smartAutoResponder.enabled = e.target.checked;
        document.getElementById('smart-responder-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveAutomationSettings();
    });

    document.getElementById('add-smart-rule-btn')?.addEventListener('click', showAddSmartRuleModal);
    document.getElementById('description-updater-enabled')?.addEventListener('change', async (e) => {
        automationSettings.descriptionUpdater.enabled = e.target.checked;
        document.getElementById('description-updater-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveAutomationSettings();
    });

    document.getElementById('update-schedule')?.addEventListener('change', async (e) => {
        automationSettings.descriptionUpdater.schedule = e.target.value;
        await saveAutomationSettings();
    });

    document.getElementById('update-descriptions-now-btn')?.addEventListener('click', updateAllDescriptions);
}

function updateUIFromSettings() {
    document.getElementById('dynamic-pricing-enabled').checked = automationSettings.dynamicPricing.enabled;
    document.getElementById('dynamic-pricing-settings').style.display = automationSettings.dynamicPricing.enabled ? 'block' : 'none';

    document.getElementById('bulk-creation-enabled').checked = automationSettings.bulkLotCreation.enabled;
    document.getElementById('bulk-creation-settings').style.display = automationSettings.bulkLotCreation.enabled ? 'block' : 'none';

    document.getElementById('smart-responder-enabled').checked = automationSettings.smartAutoResponder.enabled;
    document.getElementById('smart-responder-settings').style.display = automationSettings.smartAutoResponder.enabled ? 'block' : 'none';

    document.getElementById('description-updater-enabled').checked = automationSettings.descriptionUpdater.enabled;
    document.getElementById('description-updater-settings').style.display = automationSettings.descriptionUpdater.enabled ? 'block' : 'none';
    document.getElementById('update-schedule').value = automationSettings.descriptionUpdater.schedule;
}

function showAddPricingRuleModal() {
    const lotId = prompt('ID лота (или "all" для всех):');
    if (!lotId) return;

    const condition = prompt('Условие (demand_high/demand_low/competitor_price_change):');
    if (!condition) return;

    const action = prompt('Действие (increase/decrease/set):');
    if (!action) return;

    const value = prompt('Значение (процент или сумма):');
    if (!value) return;

    automationSettings.dynamicPricing.rules.push({
        lotId,
        condition,
        action,
        value: parseFloat(value),
        id: Date.now()
    });

    saveAutomationSettings();
    renderPricingRules();
    showNotification('Правило ценообразования добавлено', false);
}

function renderPricingRules() {
    const list = document.getElementById('pricing-rules-list');
    if (!list) return;

    if (automationSettings.dynamicPricing.rules.length === 0) {
        list.innerHTML = '<p class="template-info">Нет правил ценообразования</p>';
        return;
    }

    list.innerHTML = automationSettings.dynamicPricing.rules.map((rule, index) => `
        <div class="pricing-rule-item">
            <div class="rule-info">
                <strong>Лот:</strong> ${rule.lotId} | 
                <strong>Условие:</strong> ${rule.condition} | 
                <strong>Действие:</strong> ${rule.action} ${rule.value}
            </div>
            <button class="btn btn-small remove-rule-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.remove-rule-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            automationSettings.dynamicPricing.rules.splice(index, 1);
            await saveAutomationSettings();
            renderPricingRules();
        });
    });
}

function showAddSmartRuleModal() {
    const keyword = prompt('Ключевое слово или фраза:');
    if (!keyword) return;

    const response = prompt('Ответ (можно использовать {buyername}, {lotname}):');
    if (!response) return;

    const useAI = confirm('Использовать AI для генерации ответа?');

    automationSettings.smartAutoResponder.rules.push({
        keyword,
        response,
        useAI,
        id: Date.now()
    });

    saveAutomationSettings();
    renderSmartRules();
    showNotification('Правило умного автоответчика добавлено', false);
}

function renderSmartRules() {
    const list = document.getElementById('smart-rules-list');
    if (!list) return;

    if (automationSettings.smartAutoResponder.rules.length === 0) {
        list.innerHTML = '<p class="template-info">Нет правил умного автоответчика</p>';
        return;
    }

    list.innerHTML = automationSettings.smartAutoResponder.rules.map((rule, index) => `
        <div class="smart-rule-item">
            <div class="rule-info">
                <strong>Ключевое слово:</strong> ${rule.keyword}<br>
                <strong>Ответ:</strong> ${rule.response.substring(0, 50)}...<br>
                <strong>AI:</strong> ${rule.useAI ? 'Да' : 'Нет'}
            </div>
            <button class="btn btn-small remove-rule-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.remove-rule-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            automationSettings.smartAutoResponder.rules.splice(index, 1);
            await saveAutomationSettings();
            renderSmartRules();
        });
    });
}

function renderBulkTemplates() {
    const list = document.getElementById('bulk-templates-list');
    if (!list) return;

    if (automationSettings.bulkLotCreation.templates.length === 0) {
        list.innerHTML = '<p class="template-info">Нет шаблонов для массового создания</p>';
        return;
    }

    list.innerHTML = automationSettings.bulkLotCreation.templates.map((template, index) => `
        <div class="bulk-template-item">
            <div class="template-info">
                <strong>${template.name}</strong><br>
                Категорий: ${template.categories.length}
            </div>
            <button class="btn btn-small use-template-btn" data-index="${index}">Использовать</button>
            <button class="btn btn-small remove-template-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.use-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            useBulkTemplate(automationSettings.bulkLotCreation.templates[index]);
        });
    });

    list.querySelectorAll('.remove-template-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            automationSettings.bulkLotCreation.templates.splice(index, 1);
            await saveAutomationSettings();
            renderBulkTemplates();
        });
    });
}

function showBulkCreationModal() {
    const name = prompt('Название шаблона:');
    if (!name) return;

    const title = prompt('Название лота (можно использовать {category}):');
    if (!title) return;

    const description = prompt('Описание лота:');
    if (!description) return;

    const categories = prompt('Категории (через запятую):').split(',').map(c => c.trim());

    automationSettings.bulkLotCreation.templates.push({
        name,
        title,
        description,
        categories,
        id: Date.now()
    });

    saveAutomationSettings();
    renderBulkTemplates();
    showNotification('Шаблон для массового создания добавлен', false);
}

async function useBulkTemplate(template) {
    if (!confirm(`Создать ${template.categories.length} лотов из шаблона "${template.name}"?`)) {
        return;
    }

    showNotification('Начато массовое создание лотов...', false);

    for (const category of template.categories) {
        try {
            const title = template.title.replace(/{category}/g, category);
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Error creating lot:', error);
        }
    }

    showNotification('Массовое создание лотов завершено', false);
}

async function updateAllDescriptions() {
    if (!confirm('Обновить описания всех лотов? Это может занять некоторое время.')) {
        return;
    }

    showNotification('Начато обновление описаний...', false);

    try {
        const response = await fetch('https://funpay.com/lots/');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const lots = doc.querySelectorAll('.offer-list-item');
        let updated = 0;

        for (const lot of lots) {
            try {
                await new Promise(resolve => setTimeout(resolve, 500));
                updated++;
            } catch (error) {
                console.error('Error updating description:', error);
            }
        }

        showNotification(`Обновлено описаний: ${updated}`, false);
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, true);
    }
}

function startAutomationTasks() {
    if (automationSettings.dynamicPricing.enabled) {
        setInterval(() => {
            checkPricingRules();
        }, 60 * 60 * 1000);
    }


    if (automationSettings.descriptionUpdater.enabled) {
        const schedules = {
            daily: 24 * 60 * 60 * 1000,
            weekly: 7 * 24 * 60 * 60 * 1000,
            monthly: 30 * 24 * 60 * 60 * 1000
        };

        const interval = schedules[automationSettings.descriptionUpdater.schedule] || schedules.daily;
        setInterval(() => {
            updateAllDescriptions();
        }, interval);
    }
}

async function checkPricingRules() {
    for (const rule of automationSettings.dynamicPricing.rules) {
        console.log('Checking pricing rule:', rule);
    }
}

if (typeof window !== 'undefined') {
    window.initializeAdvancedAutomation = initializeAdvancedAutomation;
}


