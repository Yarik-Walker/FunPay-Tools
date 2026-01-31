let integrationSettings = {
    googleSheets: { enabled: false, apiKey: '', spreadsheetId: '' },
    notion: { enabled: false, apiKey: '', databaseId: '' },
    calendar: { enabled: false }
};

async function initializeIntegrations() {
    await loadIntegrationSettings();
    setupIntegrationsUI();
}

async function loadIntegrationSettings() {
    const data = await chrome.storage.local.get('fpToolsIntegrations');
    if (data.fpToolsIntegrations) {
        integrationSettings = { ...integrationSettings, ...data.fpToolsIntegrations };
    }
}

async function saveIntegrationSettings() {
    await chrome.storage.local.set({ fpToolsIntegrations: integrationSettings });
}

function setupIntegrationsUI() {
    const integrationsPage = document.querySelector('.fp-tools-page-content[data-page="integrations"]');
    if (!integrationsPage) return;

    integrationsPage.innerHTML = `
        <h3>Интеграции</h3>
        
        <div class="integration-section">
            <h4>Google Sheets</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="google-sheets-enabled">
                <label for="google-sheets-enabled">Включить экспорт в Google Sheets</label>
            </div>
            <div id="google-sheets-settings" style="margin-top: 15px; display: none;">
                <label for="google-sheets-api-key">API Key:</label>
                <input type="text" id="google-sheets-api-key" class="template-input" placeholder="Ваш Google API Key">
                <label for="google-sheets-spreadsheet-id" style="margin-top: 10px;">Spreadsheet ID:</label>
                <input type="text" id="google-sheets-spreadsheet-id" class="template-input" placeholder="ID таблицы">
                <button id="test-google-sheets-btn" class="btn" style="margin-top: 10px;">Тест экспорта</button>
            </div>
        </div>

        <div class="integration-section">
            <h4>Notion</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="notion-enabled">
                <label for="notion-enabled">Включить интеграцию с Notion</label>
            </div>
            <div id="notion-settings" style="margin-top: 15px; display: none;">
                <label for="notion-api-key">API Key:</label>
                <input type="text" id="notion-api-key" class="template-input" placeholder="Ваш Notion API Key">
                <label for="notion-database-id" style="margin-top: 10px;">Database ID:</label>
                <input type="text" id="notion-database-id" class="template-input" placeholder="ID базы данных">
                <button id="test-notion-btn" class="btn" style="margin-top: 10px;">Тест интеграции</button>
            </div>
        </div>

        <div class="integration-section">
            <h4>Календарь</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="calendar-enabled">
                <label for="calendar-enabled">Включить планирование задач</label>
            </div>
            <div id="calendar-settings" style="margin-top: 15px; display: none;">
                <button id="add-calendar-event-btn" class="btn">Добавить событие</button>
                <div id="calendar-events-list" style="margin-top: 15px;"></div>
            </div>
        </div>

        <div class="integration-section">
            <h4>API для разработчиков</h4>
            <p class="template-info">Используйте API для создания собственных плагинов и интеграций</p>
            <button id="generate-api-key-btn" class="btn">Сгенерировать API ключ</button>
            <div id="api-key-display" style="margin-top: 15px;"></div>
        </div>
    `;

    setupIntegrationEventListeners();
    updateUIFromSettings();
    renderCalendarEvents();
}

function setupIntegrationEventListeners() {
    document.getElementById('google-sheets-enabled')?.addEventListener('change', async (e) => {
        integrationSettings.googleSheets.enabled = e.target.checked;
        document.getElementById('google-sheets-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveIntegrationSettings();
    });

    document.getElementById('google-sheets-api-key')?.addEventListener('change', async (e) => {
        integrationSettings.googleSheets.apiKey = e.target.value;
        await saveIntegrationSettings();
    });

    document.getElementById('google-sheets-spreadsheet-id')?.addEventListener('change', async (e) => {
        integrationSettings.googleSheets.spreadsheetId = e.target.value;
        await saveIntegrationSettings();
    });

    document.getElementById('test-google-sheets-btn')?.addEventListener('click', testGoogleSheets);

    document.getElementById('notion-enabled')?.addEventListener('change', async (e) => {
        integrationSettings.notion.enabled = e.target.checked;
        document.getElementById('notion-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveIntegrationSettings();
    });

    document.getElementById('notion-api-key')?.addEventListener('change', async (e) => {
        integrationSettings.notion.apiKey = e.target.value;
        await saveIntegrationSettings();
    });

    document.getElementById('notion-database-id')?.addEventListener('change', async (e) => {
        integrationSettings.notion.databaseId = e.target.value;
        await saveIntegrationSettings();
    });

    document.getElementById('test-notion-btn')?.addEventListener('click', testNotion);

    document.getElementById('calendar-enabled')?.addEventListener('change', async (e) => {
        integrationSettings.calendar.enabled = e.target.checked;
        document.getElementById('calendar-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveIntegrationSettings();
    });

    document.getElementById('add-calendar-event-btn')?.addEventListener('click', showAddCalendarEventModal);
    document.getElementById('generate-api-key-btn')?.addEventListener('click', generateAPIKey);
}

function updateUIFromSettings() {
    document.getElementById('google-sheets-enabled').checked = integrationSettings.googleSheets.enabled;
    document.getElementById('google-sheets-api-key').value = integrationSettings.googleSheets.apiKey || '';
    document.getElementById('google-sheets-spreadsheet-id').value = integrationSettings.googleSheets.spreadsheetId || '';
    document.getElementById('google-sheets-settings').style.display = integrationSettings.googleSheets.enabled ? 'block' : 'none';

    document.getElementById('notion-enabled').checked = integrationSettings.notion.enabled;
    document.getElementById('notion-api-key').value = integrationSettings.notion.apiKey || '';
    document.getElementById('notion-database-id').value = integrationSettings.notion.databaseId || '';
    document.getElementById('notion-settings').style.display = integrationSettings.notion.enabled ? 'block' : 'none';

    document.getElementById('calendar-enabled').checked = integrationSettings.calendar.enabled;
    document.getElementById('calendar-settings').style.display = integrationSettings.calendar.enabled ? 'block' : 'none';
}

async function testGoogleSheets() {
    if (!integrationSettings.googleSheets.apiKey || !integrationSettings.googleSheets.spreadsheetId) {
        showNotification('Заполните API Key и Spreadsheet ID', true);
        return;
    }

    try {
        const testData = {
            date: new Date().toLocaleString('ru-RU'),
            sales: 0,
            revenue: 0
        };

        await exportToGoogleSheets([testData]);
        showNotification('Тестовый экспорт выполнен успешно', false);
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, true);
    }
}

async function exportToGoogleSheets(data) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${integrationSettings.googleSheets.spreadsheetId}/values/A1:append`;
    
    const values = data.map(item => [
        item.date,
        item.sales || '',
        item.revenue || ''
    ]);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${integrationSettings.googleSheets.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: values,
            majorDimension: 'ROWS'
        })
    });

    if (!response.ok) {
        throw new Error('Не удалось экспортировать данные');
    }
}

async function testNotion() {
    if (!integrationSettings.notion.apiKey || !integrationSettings.notion.databaseId) {
        showNotification('Заполните API Key и Database ID', true);
        return;
    }

    try {
        await createNotionPage('Тестовая страница', 'Это тестовая страница из FP Tools');
        showNotification('Тестовая страница создана в Notion', false);
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, true);
    }
}

async function createNotionPage(title, content) {
    const url = 'https://api.notion.com/v1/pages';
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${integrationSettings.notion.apiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
            parent: { database_id: integrationSettings.notion.databaseId },
            properties: {
                title: {
                    title: [{ text: { content: title } }]
                }
            },
            children: [{
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ text: { content: content } }]
                }
            }]
        })
    });

    if (!response.ok) {
        throw new Error('Не удалось создать страницу в Notion');
    }
}

function showAddCalendarEventModal() {
    const title = prompt('Название события:');
    if (!title) return;

    const date = prompt('Дата (YYYY-MM-DD):');
    if (!date) return;

    const time = prompt('Время (HH:MM):', '12:00');
    if (!time) return;

    const description = prompt('Описание (опционально):');

    addCalendarEvent({
        title,
        date,
        time,
        description: description || ''
    });
}

async function addCalendarEvent(event) {
    const events = (await chrome.storage.local.get('fpToolsCalendarEvents')).fpToolsCalendarEvents || [];
    events.push({
        ...event,
        id: Date.now(),
        createdAt: Date.now()
    });
    await chrome.storage.local.set({ fpToolsCalendarEvents: events });
    renderCalendarEvents();
    showNotification('Событие добавлено в календарь', false);
}

function renderCalendarEvents() {
    const list = document.getElementById('calendar-events-list');
    if (!list) return;

    chrome.storage.local.get('fpToolsCalendarEvents', ({ fpToolsCalendarEvents }) => {
        const events = fpToolsCalendarEvents || [];
        
        if (events.length === 0) {
            list.innerHTML = '<p class="template-info">Нет запланированных событий</p>';
            return;
        }

        const upcomingEvents = events
            .filter(e => new Date(`${e.date} ${e.time}`) >= new Date())
            .sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`))
            .slice(0, 10);

        list.innerHTML = upcomingEvents.map(event => `
            <div class="calendar-event-item">
                <div class="event-header">
                    <strong>${event.title}</strong>
                    <span class="event-date">${event.date} ${event.time}</span>
                </div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                <button class="btn btn-small remove-event-btn" data-id="${event.id}">Удалить</button>
            </div>
        `).join('');

        list.querySelectorAll('.remove-event-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const events = (await chrome.storage.local.get('fpToolsCalendarEvents')).fpToolsCalendarEvents || [];
                const filtered = events.filter(e => e.id !== id);
                await chrome.storage.local.set({ fpToolsCalendarEvents: filtered });
                renderCalendarEvents();
            });
        });
    });
}

function generateAPIKey() {
    const apiKey = 'fpt_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    chrome.storage.local.set({ fpToolsAPIKey: apiKey });
    
    const display = document.getElementById('api-key-display');
    if (display) {
        display.innerHTML = `
            <div class="api-key-display">
                <strong>Ваш API ключ:</strong>
                <code style="display: block; margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; word-break: break-all;">${apiKey}</code>
                <p class="template-info">Сохраните этот ключ в безопасном месте. Он больше не будет показан.</p>
            </div>
        `;
    }

    showNotification('API ключ сгенерирован', false);
}

async function autoExportToGoogleSheets() {
    if (!integrationSettings.googleSheets.enabled) return;

    const { fpToolsSalesData } = await chrome.storage.local.get('fpToolsSalesData');
    if (!fpToolsSalesData) return;

    const today = new Date().toDateString();
    const todaySales = Object.values(fpToolsSalesData).filter(order => 
        new Date(order.date).toDateString() === today
    );

    if (todaySales.length > 0) {
        await exportToGoogleSheets(todaySales.map(order => ({
            date: order.date,
            sales: 1,
            revenue: parseFloat(order.price) || 0
        })));
    }
}


setInterval(() => {
    autoExportToGoogleSheets();
}, 60 * 60 * 1000);

if (typeof window !== 'undefined') {
    window.initializeIntegrations = initializeIntegrations;
    window.exportToGoogleSheets = exportToGoogleSheets;
    window.createNotionPage = createNotionPage;
}


