let hotkeySettings = {};
let widgetSettings = {};

async function initializeUIImprovements() {
    await loadUISettings();
    setupHotkeys();
    setupDarkTheme();
    setupWidgets();
    setupResponsiveDesign();
}

async function loadUISettings() {
    const data = await chrome.storage.local.get(['fpToolsHotkeys', 'fpToolsWidgets']);
    hotkeySettings = data.fpToolsHotkeys || getDefaultHotkeys();
    widgetSettings = data.fpToolsWidgets || {};
}

function getDefaultHotkeys() {
    return {
        'open-popup': 'Ctrl+Shift+F',
        'quick-template': 'Ctrl+T',
        'ai-chat': 'Ctrl+Shift+A',
        'toggle-theme': 'Ctrl+Shift+D'
    };
}

function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
        const key = getKeyCombo(e);
        
        Object.entries(hotkeySettings).forEach(([action, combo]) => {
            if (key === combo) {
                e.preventDefault();
                executeHotkeyAction(action);
            }
        });
    });
}

function getKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    
    return parts.join('+');
}

function executeHotkeyAction(action) {
    switch (action) {
        case 'open-popup':
            const popup = document.querySelector('.fp-tools-popup');
            if (popup) {
                popup.classList.toggle('active');
            }
            break;
        case 'quick-template':
            const chatInput = document.querySelector('.chat-form-input .form-control');
            if (chatInput) {
                chatInput.focus();
                showNotification('Горячая клавиша: Быстрый шаблон', false);
            }
            break;
        case 'ai-chat':
            const aiButton = document.getElementById('aiModeToggleBtn');
            if (aiButton) {
                aiButton.click();
            }
            break;
        case 'toggle-theme':
            toggleDarkTheme();
            break;
    }
}

function setupDarkTheme() {
    const { fpToolsDarkTheme } = chrome.storage.local.get('fpToolsDarkTheme');
    if (fpToolsDarkTheme) {
        applyDarkTheme();
    }
}

function applyDarkTheme() {
    if (!document.getElementById('fp-tools-dark-theme')) {
        const style = document.createElement('style');
        style.id = 'fp-tools-dark-theme';
        style.textContent = `
            .fp-tools-popup {
                background: #1e1e1e;
                color: #e0e0e0;
            }
            .fp-tools-nav li {
                color: #e0e0e0;
            }
            .fp-tools-nav li:hover {
                background: #2d2d2d;
            }
            .template-input {
                background: #2d2d2d;
                color: #e0e0e0;
                border-color: #444;
            }
            .btn {
                background: #3d3d3d;
                color: #e0e0e0;
            }
            .btn:hover {
                background: #4d4d4d;
            }
        `;
        document.head.appendChild(style);
    }
}

function toggleDarkTheme() {
    const style = document.getElementById('fp-tools-dark-theme');
    if (style) {
        style.remove();
        chrome.storage.local.set({ fpToolsDarkTheme: false });
        showNotification('Темная тема отключена', false);
    } else {
        applyDarkTheme();
        chrome.storage.local.set({ fpToolsDarkTheme: true });
        showNotification('Темная тема включена', false);
    }
}

function setupWidgets() {
    const widgetsContainer = document.getElementById('fp-tools-widgets');
    if (!widgetsContainer) {
        const container = document.createElement('div');
        container.id = 'fp-tools-widgets';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 300px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    createSalesWidget();
    createQuickActionsWidget();
    createStatsWidget();
}

function createSalesWidget() {
    const widget = document.createElement('div');
    widget.className = 'fp-tools-widget';
    widget.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    widget.innerHTML = `
        <div class="widget-header">
            <strong>Продажи сегодня</strong>
            <button class="widget-close">&times;</button>
        </div>
        <div class="widget-content" id="sales-widget-content">
            Загрузка...
        </div>
    `;

    document.getElementById('fp-tools-widgets').appendChild(widget);
    updateSalesWidget();

    widget.querySelector('.widget-close').addEventListener('click', () => {
        widget.remove();
    });
}

async function updateSalesWidget() {
    const content = document.getElementById('sales-widget-content');
    if (!content) return;

    try {
        const { fpToolsSalesData } = await chrome.storage.local.get('fpToolsSalesData');
        const today = new Date().toDateString();
        const todaySales = Object.values(fpToolsSalesData || {}).filter(order => 
            new Date(order.date).toDateString() === today
        ).length;

        content.innerHTML = `
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">
                ${todaySales}
            </div>
            <div style="color: #666; font-size: 12px;">
                заказов сегодня
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<span style="color: red;">Ошибка загрузки</span>';
    }
}

function createQuickActionsWidget() {
    const widget = document.createElement('div');
    widget.className = 'fp-tools-widget';
    widget.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    widget.innerHTML = `
        <div class="widget-header">
            <strong>Быстрые действия</strong>
            <button class="widget-close">&times;</button>
        </div>
        <div class="widget-content">
            <button class="widget-action-btn" data-action="bump-all">Поднять все лоты</button>
            <button class="widget-action-btn" data-action="open-chat">Открыть чаты</button>
            <button class="widget-action-btn" data-action="view-stats">Статистика</button>
        </div>
    `;

    document.getElementById('fp-tools-widgets').appendChild(widget);

    widget.querySelectorAll('.widget-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            executeWidgetAction(action);
        });
    });

    widget.querySelector('.widget-close').addEventListener('click', () => {
        widget.remove();
    });
}

function executeWidgetAction(action) {
    switch (action) {
        case 'bump-all':
            showNotification('Функция поднятия всех лотов', false);
            break;
        case 'open-chat':
            window.location.href = 'https://funpay.com/chats/';
            break;
        case 'view-stats':
            const popup = document.querySelector('.fp-tools-popup');
            if (popup) {
                popup.classList.add('active');
            }
            break;
    }
}

function createStatsWidget() {
    const widget = document.createElement('div');
    widget.className = 'fp-tools-widget';
    widget.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    widget.innerHTML = `
        <div class="widget-header">
            <strong>Статистика</strong>
            <button class="widget-close">&times;</button>
        </div>
        <div class="widget-content" id="stats-widget-content">
            Загрузка...
        </div>
    `;

    document.getElementById('fp-tools-widgets').appendChild(widget);
    updateStatsWidget();

    widget.querySelector('.widget-close').addEventListener('click', () => {
        widget.remove();
    });
}

async function updateStatsWidget() {
    const content = document.getElementById('stats-widget-content');
    if (!content) return;

    try {
        const { fpToolsSalesData } = await chrome.storage.local.get('fpToolsSalesData');
        const totalSales = Object.keys(fpToolsSalesData || {}).length;
        
        const totalAmount = Object.values(fpToolsSalesData || {}).reduce((sum, order) => 
            sum + (parseFloat(order.price) || 0), 0
        );
        const avgCheck = totalSales > 0 ? totalAmount / totalSales : 0;

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Всего продаж:</span>
                <strong>${totalSales}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Средний чек:</span>
                <strong>${avgCheck.toFixed(0)}₽</strong>
            </div>
        `;
    } catch (error) {
        content.innerHTML = '<span style="color: red;">Ошибка загрузки</span>';
    }
}

function setupResponsiveDesign() {
    if (!document.getElementById('fp-tools-responsive')) {
        const style = document.createElement('style');
        style.id = 'fp-tools-responsive';
        style.textContent = `
            @media (max-width: 768px) {
                .fp-tools-popup {
                    width: 100% !important;
                    height: 100% !important;
                    max-width: none !important;
                }
                .fp-tools-nav {
                    flex-direction: column;
                }
                #fp-tools-widgets {
                    width: 100% !important;
                    right: 0 !important;
                    top: 60px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

function setupUISettingsUI() {
    const uiPage = document.querySelector('.fp-tools-page-content[data-page="ui_settings"]');
    if (!uiPage) return;

    uiPage.innerHTML = `
        <h3>Настройки интерфейса</h3>
        
        <div class="ui-section">
            <h4>Горячие клавиши</h4>
            <div id="hotkeys-list"></div>
            <button id="reset-hotkeys-btn" class="btn" style="margin-top: 10px;">Сбросить к умолчанию</button>
        </div>

        <div class="ui-section">
            <h4>Темная тема</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="dark-theme-toggle">
                <label for="dark-theme-toggle">Включить темную тему</label>
            </div>
        </div>

        <div class="ui-section">
            <h4>Виджеты</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="show-widgets-toggle">
                <label for="show-widgets-toggle">Показывать виджеты на странице</label>
            </div>
        </div>
    `;

    renderHotkeys();
    setupUISettingsListeners();
}

function renderHotkeys() {
    const list = document.getElementById('hotkeys-list');
    if (!list) return;

    list.innerHTML = Object.entries(hotkeySettings).map(([action, combo]) => `
        <div class="hotkey-item">
            <span>${getActionName(action)}</span>
            <input type="text" class="hotkey-input" data-action="${action}" value="${combo}" readonly>
            <button class="btn btn-small edit-hotkey-btn" data-action="${action}">Изменить</button>
        </div>
    `).join('');

    list.querySelectorAll('.edit-hotkey-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const input = list.querySelector(`.hotkey-input[data-action="${action}"]`);
            input.removeAttribute('readonly');
            input.focus();
            input.addEventListener('keydown', (e) => {
                e.preventDefault();
                const combo = getKeyCombo(e);
                input.value = combo;
                hotkeySettings[action] = combo;
                chrome.storage.local.set({ fpToolsHotkeys: hotkeySettings });
                input.setAttribute('readonly', '');
                showNotification('Горячая клавиша сохранена', false);
            }, { once: true });
        });
    });
}

function getActionName(action) {
    const names = {
        'open-popup': 'Открыть меню FP Tools',
        'quick-template': 'Быстрый шаблон',
        'ai-chat': 'AI-чат',
        'toggle-theme': 'Переключить тему'
    };
    return names[action] || action;
}

function setupUISettingsListeners() {
    document.getElementById('dark-theme-toggle')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            applyDarkTheme();
        } else {
            document.getElementById('fp-tools-dark-theme')?.remove();
        }
        chrome.storage.local.set({ fpToolsDarkTheme: e.target.checked });
    });

    document.getElementById('show-widgets-toggle')?.addEventListener('change', (e) => {
        const widgets = document.getElementById('fp-tools-widgets');
        if (widgets) {
            widgets.style.display = e.target.checked ? 'flex' : 'none';
        }
        chrome.storage.local.set({ fpToolsShowWidgets: e.target.checked });
    });

    document.getElementById('reset-hotkeys-btn')?.addEventListener('click', () => {
        hotkeySettings = getDefaultHotkeys();
        chrome.storage.local.set({ fpToolsHotkeys: hotkeySettings });
        renderHotkeys();
        showNotification('Горячие клавиши сброшены', false);
    });
}

if (typeof window !== 'undefined') {
    window.initializeUIImprovements = initializeUIImprovements;
    window.setupUISettingsUI = setupUISettingsUI;
}


