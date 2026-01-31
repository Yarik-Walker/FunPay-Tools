let orderTemplates = {};
let orderHistory = {};
let qualityCheckRules = [];

async function initializeOrderEnhancements() {
    await loadOrderData();
    setupOrderUI();
    startOrderStatusTracking();
}

async function loadOrderData() {
    const data = await chrome.storage.local.get([
        'fpToolsOrderTemplates',
        'fpToolsOrderHistory',
        'fpToolsQualityCheckRules'
    ]);
    orderTemplates = data.fpToolsOrderTemplates || {};
    orderHistory = data.fpToolsOrderHistory || {};
    qualityCheckRules = data.fpToolsQualityCheckRules || [];
}

async function saveOrderData() {
    await chrome.storage.local.set({
        fpToolsOrderTemplates: orderTemplates,
        fpToolsOrderHistory: orderHistory,
        fpToolsQualityCheckRules: qualityCheckRules
    });
}

function setupOrderUI() {
    const orderPage = document.querySelector('.fp-tools-page-content[data-page="orders"]');
    if (!orderPage) return;

    orderPage.innerHTML = `
        <h3>Улучшения для заказов</h3>
        
        <div class="order-section">
            <h4>Шаблоны для разных типов заказов</h4>
            <div class="input-group">
                <select id="order-category-select" class="template-input">
                    <option value="">Выберите категорию</option>
                    <option value="account">Игровой аккаунт</option>
                    <option value="currency">Игровая валюта</option>
                    <option value="item">Игровой предмет</option>
                    <option value="service">Услуга</option>
                    <option value="other">Другое</option>
                </select>
                <button id="add-order-template-btn" class="btn">Добавить шаблон</button>
            </div>
            <div id="order-templates-list" style="margin-top: 15px;"></div>
        </div>

        <div class="order-section">
            <h4>Проверка качества товара</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="enable-quality-check">
                <label for="enable-quality-check">Включить автоматическую проверку</label>
            </div>
            <div id="quality-check-rules" style="margin-top: 15px;"></div>
            <button id="add-quality-rule-btn" class="btn" style="margin-top: 10px;">Добавить правило проверки</button>
        </div>

        <div class="order-section">
            <h4>История общения с покупателем</h4>
            <div class="input-group">
                <input type="text" id="search-buyer-history" class="template-input" placeholder="Поиск по имени покупателя">
                <button id="search-history-btn" class="btn">Найти</button>
            </div>
            <div id="buyer-history-results" style="margin-top: 15px;"></div>
        </div>

        <div class="order-section">
            <h4>Отслеживание статуса заказа</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="enable-status-tracking">
                <label for="enable-status-tracking">Включить автоматическое отслеживание</label>
            </div>
            <div id="order-status-list" style="margin-top: 15px;"></div>
        </div>
    `;

    setupOrderEventListeners();
    renderOrderTemplates();
    renderQualityCheckRules();
    updateOrderStatusList();
}

function setupOrderEventListeners() {
    document.getElementById('add-order-template-btn')?.addEventListener('click', showAddTemplateModal);
    document.getElementById('add-quality-rule-btn')?.addEventListener('click', showAddQualityRuleModal);
    document.getElementById('search-history-btn')?.addEventListener('click', searchBuyerHistory);
    document.getElementById('enable-quality-check')?.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ fpToolsQualityCheckEnabled: e.target.checked });
    });
    document.getElementById('enable-status-tracking')?.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ fpToolsStatusTrackingEnabled: e.target.checked });
    });
}

function renderOrderTemplates() {
    const list = document.getElementById('order-templates-list');
    if (!list) return;

    if (Object.keys(orderTemplates).length === 0) {
        list.innerHTML = '<p class="template-info">Нет сохраненных шаблонов</p>';
        return;
    }

    list.innerHTML = Object.entries(orderTemplates).map(([category, template]) => `
        <div class="order-template-item">
            <div class="template-header">
                <strong>${getCategoryName(category)}</strong>
                <button class="btn btn-small use-template-btn" data-category="${category}">Использовать</button>
                <button class="btn btn-small edit-template-btn" data-category="${category}">Редактировать</button>
                <button class="btn btn-small remove-template-btn" data-category="${category}">Удалить</button>
            </div>
            <div class="template-preview">${template.substring(0, 100)}...</div>
        </div>
    `).join('');

    list.querySelectorAll('.use-template-btn').forEach(btn => {
        btn.addEventListener('click', () => useOrderTemplate(btn.dataset.category));
    });

    list.querySelectorAll('.edit-template-btn').forEach(btn => {
        btn.addEventListener('click', () => editOrderTemplate(btn.dataset.category));
    });

    list.querySelectorAll('.remove-template-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            delete orderTemplates[btn.dataset.category];
            await saveOrderData();
            renderOrderTemplates();
        });
    });
}

function getCategoryName(category) {
    const names = {
        account: 'Игровой аккаунт',
        currency: 'Игровая валюта',
        item: 'Игровой предмет',
        service: 'Услуга',
        other: 'Другое'
    };
    return names[category] || category;
}

function showAddTemplateModal() {
    const category = document.getElementById('order-category-select').value;
    if (!category) {
        showNotification('Выберите категорию', true);
        return;
    }

    const template = prompt('Введите шаблон сообщения (можно использовать {buyername}, {lotname}, {orderid}):');
    if (template) {
        orderTemplates[category] = template;
        saveOrderData();
        renderOrderTemplates();
        showNotification('Шаблон сохранен', false);
    }
}

function editOrderTemplate(category) {
    const currentTemplate = orderTemplates[category] || '';
    const newTemplate = prompt('Редактировать шаблон:', currentTemplate);
    if (newTemplate !== null) {
        orderTemplates[category] = newTemplate;
        saveOrderData();
        renderOrderTemplates();
        showNotification('Шаблон обновлен', false);
    }
}

function useOrderTemplate(category) {
    const template = orderTemplates[category];
    if (!template) return;

    const chatInput = document.querySelector('.chat-form-input .form-control');
    if (!chatInput) {
        showNotification('Откройте чат с покупателем', true);
        return;
    }

    const buyerName = document.querySelector('.chat-full-header .user-link-name')?.textContent.trim() || '{buyername}';
    const lotName = document.querySelector('.lot-title')?.textContent.trim() || '{lotname}';
    const orderId = window.location.pathname.match(/\/orders\/(\d+)/)?.[1] || '{orderid}';

    let message = template
        .replace(/{buyername}/g, buyerName)
        .replace(/{lotname}/g, lotName)
        .replace(/{orderid}/g, orderId);

    chatInput.value = message;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    showNotification('Шаблон применен', false);
}

function renderQualityCheckRules() {
    const container = document.getElementById('quality-check-rules');
    if (!container) return;

    if (qualityCheckRules.length === 0) {
        container.innerHTML = '<p class="template-info">Нет правил проверки</p>';
        return;
    }

    container.innerHTML = qualityCheckRules.map((rule, index) => `
        <div class="quality-rule-item">
            <div class="rule-header">
                <strong>${rule.name}</strong>
                <span class="rule-type">${rule.type}</span>
            </div>
            <div class="rule-description">${rule.description}</div>
            <button class="btn btn-small remove-rule-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    container.querySelectorAll('.remove-rule-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            qualityCheckRules.splice(index, 1);
            await saveOrderData();
            renderQualityCheckRules();
        });
    });
}

function showAddQualityRuleModal() {
    const name = prompt('Название правила:');
    if (!name) return;

    const type = prompt('Тип проверки (manual/auto):', 'manual');
    const description = prompt('Описание проверки:');

    if (name && type && description) {
        qualityCheckRules.push({ name, type, description });
        saveOrderData();
        renderQualityCheckRules();
        showNotification('Правило добавлено', false);
    }
}

async function performQualityCheck(orderId) {
    const { fpToolsQualityCheckEnabled } = await chrome.storage.local.get('fpToolsQualityCheckEnabled');
    if (!fpToolsQualityCheckEnabled) return;

    const checkList = qualityCheckRules.map(rule => ({
        name: rule.name,
        status: 'pending',
        description: rule.description
    }));

    showQualityCheckModal(checkList, orderId);
}

function showQualityCheckModal(checkList, orderId) {
    const modal = document.createElement('div');
    modal.className = 'fp-tools-modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="fp-tools-modal-content">
            <div class="fp-tools-modal-header">
                <h3>Проверка качества товара</h3>
                <button class="fp-tools-modal-close">&times;</button>
            </div>
            <div class="fp-tools-modal-body">
                <p>Проверьте все пункты перед отправкой заказа #${orderId}</p>
                <div id="quality-check-list">
                    ${checkList.map((item, index) => `
                        <div class="quality-check-item">
                            <input type="checkbox" id="check-${index}" data-index="${index}">
                            <label for="check-${index}">
                                <strong>${item.name}</strong>
                                <span class="check-description">${item.description}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="fp-tools-modal-footer">
                <button id="quality-check-complete" class="btn">Завершить проверку</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.fp-tools-modal-close').addEventListener('click', () => {
        modal.remove();
    });

    modal.querySelector('#quality-check-complete').addEventListener('click', () => {
        const allChecked = checkList.every((_, index) => 
            modal.querySelector(`#check-${index}`).checked
        );

        if (allChecked) {
            showNotification('Проверка качества завершена', false);
            modal.remove();
        } else {
            showNotification('Проверьте все пункты', true);
        }
    });
}

async function searchBuyerHistory() {
    const buyerName = document.getElementById('search-buyer-history').value.trim();
    if (!buyerName) {
        showNotification('Введите имя покупателя', true);
        return;
    }

    const resultsDiv = document.getElementById('buyer-history-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const history = orderHistory[buyerName] || [];
        
        if (history.length === 0) {
            resultsDiv.innerHTML = '<p class="template-info">История общения не найдена</p>';
            return;
        }

        resultsDiv.innerHTML = `
            <div class="buyer-history-card">
                <h5>История с ${buyerName}</h5>
                <div class="history-stats">
                    <span>Заказов: ${history.length}</span>
                    <span>Последний: ${history[history.length - 1]?.date || 'Неизвестно'}</span>
                </div>
                <div class="history-list">
                    ${history.map(order => `
                        <div class="history-item">
                            <div class="history-order-id">Заказ #${order.orderId}</div>
                            <div class="history-date">${order.date}</div>
                            <div class="history-status">${order.status}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

function saveBuyerHistory(buyerName, orderId, status) {
    if (!orderHistory[buyerName]) {
        orderHistory[buyerName] = [];
    }

    orderHistory[buyerName].push({
        orderId,
        date: new Date().toLocaleString('ru-RU'),
        status
    });

    saveOrderData();
}

function startOrderStatusTracking() {
    const observer = new MutationObserver(() => {
        checkOrderStatusChanges();
    });

    const checkOrderStatusChanges = async () => {
        const { fpToolsStatusTrackingEnabled } = await chrome.storage.local.get('fpToolsStatusTrackingEnabled');
        if (!fpToolsStatusTrackingEnabled) return;

        if (window.location.pathname.includes('/orders/')) {
            const orderId = window.location.pathname.match(/\/orders\/(\d+)/)?.[1];
            if (!orderId) return;

            const statusElement = document.querySelector('.order-status, .status-badge');
            if (!statusElement) return;

            const currentStatus = statusElement.textContent.trim();
            const storedStatus = await chrome.storage.local.get(`fpToolsOrderStatus_${orderId}`);

            if (storedStatus[`fpToolsOrderStatus_${orderId}`] !== currentStatus) {
                await chrome.storage.local.set({ [`fpToolsOrderStatus_${orderId}`]: currentStatus });
                
                if (storedStatus[`fpToolsOrderStatus_${orderId}`]) {
                    showNotification(`Статус заказа #${orderId} изменился: ${currentStatus}`, false);
                    
                    const buyerName = document.querySelector('.user-link-name')?.textContent.trim();
                    if (buyerName) {
                        saveBuyerHistory(buyerName, orderId, currentStatus);
                    }
                }
            }
        }
    };

    observer.observe(document.body, { childList: true, subtree: true });
    checkOrderStatusChanges();
}

function updateOrderStatusList() {
    const list = document.getElementById('order-status-list');
    if (!list) return;

    chrome.storage.local.get(null, (items) => {
        const orders = Object.entries(items)
            .filter(([key]) => key.startsWith('fpToolsOrderStatus_'))
            .map(([key, status]) => ({
                orderId: key.replace('fpToolsOrderStatus_', ''),
                status
            }));

        if (orders.length === 0) {
            list.innerHTML = '<p class="template-info">Нет отслеживаемых заказов</p>';
            return;
        }

        list.innerHTML = orders.map(order => `
            <div class="order-status-item">
                <span>Заказ #${order.orderId}</span>
                <span class="status-badge">${order.status}</span>
            </div>
        `).join('');
    });
}

if (window.location.pathname.includes('/orders/')) {
    const orderId = window.location.pathname.match(/\/orders\/(\d+)/)?.[1];
    if (orderId) {
        setTimeout(() => {
            performQualityCheck(orderId);
        }, 2000);
    }
}

if (typeof window !== 'undefined') {
    window.initializeOrderEnhancements = initializeOrderEnhancements;
}


