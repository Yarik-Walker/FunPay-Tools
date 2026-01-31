let notificationSettings = {
    telegram: { enabled: false, botToken: '', chatId: '' },
    soundFilters: { enabled: true, filters: {} },
    browser: { enabled: true },
    email: { enabled: false, email: '', smtp: {} }
};

async function initializeAdvancedNotifications() {
    await loadNotificationSettings();
    setupNotificationUI();
    setupNotificationListeners();
}

async function loadNotificationSettings() {
    const data = await chrome.storage.local.get('fpToolsNotificationSettings');
    if (data.fpToolsNotificationSettings) {
        notificationSettings = { ...notificationSettings, ...data.fpToolsNotificationSettings };
    }
}

async function saveNotificationSettings() {
    await chrome.storage.local.set({ fpToolsNotificationSettings: notificationSettings });
}

function setupNotificationUI() {
    const notificationsPage = document.querySelector('.fp-tools-page-content[data-page="notifications"]');
    if (!notificationsPage) return;

    notificationsPage.innerHTML = `
        <h3>Расширенные уведомления</h3>
        
        <div class="notification-section">
            <h4>Telegram уведомления</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="telegram-enabled">
                <label for="telegram-enabled">Включить уведомления в Telegram</label>
            </div>
            <div id="telegram-settings" style="margin-top: 15px; display: none;">
                <label for="telegram-bot-token">Bot Token:</label>
                <input type="text" id="telegram-bot-token" class="template-input" placeholder="Получите у @BotFather">
                <label for="telegram-chat-id" style="margin-top: 10px;">Chat ID:</label>
                <input type="text" id="telegram-chat-id" class="template-input" placeholder="Ваш Chat ID">
                <button id="test-telegram-btn" class="btn" style="margin-top: 10px;">Тест уведомления</button>
            </div>
        </div>

        <div class="notification-section">
            <h4>Звуковые фильтры</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="sound-filters-enabled">
                <label for="sound-filters-enabled">Включить фильтрацию звуков</label>
            </div>
            <div id="sound-filters-list" style="margin-top: 15px;"></div>
            <button id="add-sound-filter-btn" class="btn" style="margin-top: 10px;">Добавить фильтр</button>
        </div>

        <div class="notification-section">
            <h4>Браузерные уведомления</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="browser-notifications-enabled">
                <label for="browser-notifications-enabled">Включить системные уведомления</label>
            </div>
            <div class="checkbox-label-inline" style="margin-top: 10px;">
                <input type="checkbox" id="browser-notifications-sound">
                <label for="browser-notifications-sound">Звук в уведомлениях</label>
            </div>
        </div>

        <div class="notification-section">
            <h4>Email уведомления</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="email-enabled">
                <label for="email-enabled">Включить Email уведомления</label>
            </div>
            <div id="email-settings" style="margin-top: 15px; display: none;">
                <label for="email-address">Email адрес:</label>
                <input type="email" id="email-address" class="template-input" placeholder="your@email.com">
                <p class="template-info" style="margin-top: 10px;">
                    Для отправки email требуется настройка SMTP сервера. 
                    Используйте сервисы типа SendGrid, Mailgun или настройте свой SMTP.
                </p>
            </div>
        </div>

        <div class="notification-section">
            <h4>Типы событий</h4>
            <div id="event-types-list"></div>
        </div>
    `;

    setupNotificationEventListeners();
    renderSoundFilters();
    renderEventTypes();
    updateUIFromSettings();
}

function setupNotificationEventListeners() {
    document.getElementById('telegram-enabled')?.addEventListener('change', async (e) => {
        notificationSettings.telegram.enabled = e.target.checked;
        document.getElementById('telegram-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveNotificationSettings();
    });

    document.getElementById('telegram-bot-token')?.addEventListener('change', async (e) => {
        notificationSettings.telegram.botToken = e.target.value;
        await saveNotificationSettings();
    });

    document.getElementById('telegram-chat-id')?.addEventListener('change', async (e) => {
        notificationSettings.telegram.chatId = e.target.value;
        await saveNotificationSettings();
    });

    document.getElementById('test-telegram-btn')?.addEventListener('click', testTelegramNotification);

    document.getElementById('sound-filters-enabled')?.addEventListener('change', async (e) => {
        notificationSettings.soundFilters.enabled = e.target.checked;
        await saveNotificationSettings();
    });

    document.getElementById('browser-notifications-enabled')?.addEventListener('change', async (e) => {
        notificationSettings.browser.enabled = e.target.checked;
        if (e.target.checked) {
            requestNotificationPermission();
        }
        await saveNotificationSettings();
    });

    document.getElementById('browser-notifications-sound')?.addEventListener('change', async (e) => {
        notificationSettings.browser.sound = e.target.checked;
        await saveNotificationSettings();
    });

    document.getElementById('email-enabled')?.addEventListener('change', async (e) => {
        notificationSettings.email.enabled = e.target.checked;
        document.getElementById('email-settings').style.display = e.target.checked ? 'block' : 'none';
        await saveNotificationSettings();
    });

    document.getElementById('email-address')?.addEventListener('change', async (e) => {
        notificationSettings.email.email = e.target.value;
        await saveNotificationSettings();
    });

    document.getElementById('add-sound-filter-btn')?.addEventListener('click', showAddSoundFilterModal);
}

function updateUIFromSettings() {
    document.getElementById('telegram-enabled').checked = notificationSettings.telegram.enabled;
    document.getElementById('telegram-bot-token').value = notificationSettings.telegram.botToken || '';
    document.getElementById('telegram-chat-id').value = notificationSettings.telegram.chatId || '';
    document.getElementById('telegram-settings').style.display = notificationSettings.telegram.enabled ? 'block' : 'none';

    document.getElementById('sound-filters-enabled').checked = notificationSettings.soundFilters.enabled;
    document.getElementById('browser-notifications-enabled').checked = notificationSettings.browser.enabled;
    document.getElementById('browser-notifications-sound').checked = notificationSettings.browser.sound || false;
    document.getElementById('email-enabled').checked = notificationSettings.email.enabled;
    document.getElementById('email-address').value = notificationSettings.email.email || '';
    document.getElementById('email-settings').style.display = notificationSettings.email.enabled ? 'block' : 'none';
}

async function testTelegramNotification() {
    if (!notificationSettings.telegram.botToken || !notificationSettings.telegram.chatId) {
        showNotification('Заполните Bot Token и Chat ID', true);
        return;
    }

    try {
        await sendTelegramNotification('Тестовое уведомление', 'FP Tools работает корректно!');
        showNotification('Тестовое уведомление отправлено', false);
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, true);
    }
}

async function sendTelegramNotification(title, message) {
    if (!notificationSettings.telegram.enabled) return;

    const url = `https://api.telegram.org/bot${notificationSettings.telegram.botToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: notificationSettings.telegram.chatId,
            text: `*${title}*\n${message}`,
            parse_mode: 'Markdown'
        })
    });

    if (!response.ok) {
        throw new Error('Не удалось отправить уведомление');
    }
}

function renderSoundFilters() {
    const list = document.getElementById('sound-filters-list');
    if (!list) return;

    const filters = notificationSettings.soundFilters.filters || {};
    
    if (Object.keys(filters).length === 0) {
        list.innerHTML = '<p class="template-info">Нет настроенных фильтров</p>';
        return;
    }

    list.innerHTML = Object.entries(filters).map(([event, sound]) => `
        <div class="sound-filter-item">
            <span><strong>${getEventName(event)}</strong> → ${sound}</span>
            <button class="btn btn-small remove-filter-btn" data-event="${event}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.remove-filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            delete notificationSettings.soundFilters.filters[btn.dataset.event];
            await saveNotificationSettings();
            renderSoundFilters();
        });
    });
}

function getEventName(event) {
    const names = {
        new_message: 'Новое сообщение',
        new_order: 'Новый заказ',
        order_status_change: 'Изменение статуса',
        price_change: 'Изменение цены',
        review: 'Новый отзыв'
    };
    return names[event] || event;
}

function showAddSoundFilterModal() {
    const event = prompt('Тип события (new_message, new_order, order_status_change, price_change, review):');
    if (!event) return;

    const sounds = ['default', 'vk', 'tg', 'iphone', 'discord', 'whatsapp', 'epic'];
    const sound = prompt(`Выберите звук (${sounds.join(', ')}):`, 'default');
    
    if (event && sound && sounds.includes(sound)) {
        if (!notificationSettings.soundFilters.filters) {
            notificationSettings.soundFilters.filters = {};
        }
        notificationSettings.soundFilters.filters[event] = sound;
        saveNotificationSettings();
        renderSoundFilters();
        showNotification('Фильтр добавлен', false);
    }
}

function renderEventTypes() {
    const list = document.getElementById('event-types-list');
    if (!list) return;

    const eventTypes = [
        { id: 'new_message', name: 'Новое сообщение', default: true },
        { id: 'new_order', name: 'Новый заказ', default: true },
        { id: 'order_status_change', name: 'Изменение статуса заказа', default: true },
        { id: 'price_change', name: 'Изменение цены конкурента', default: false },
        { id: 'review', name: 'Новый отзыв', default: true },
        { id: 'bump_reminder', name: 'Напоминание о поднятии лота', default: false }
    ];

    if (!notificationSettings.eventTypes) {
        notificationSettings.eventTypes = {};
        eventTypes.forEach(et => {
            notificationSettings.eventTypes[et.id] = et.default;
        });
        saveNotificationSettings();
    }

    list.innerHTML = eventTypes.map(et => `
        <div class="checkbox-label-inline">
            <input type="checkbox" id="event-${et.id}" data-event="${et.id}" 
                   ${notificationSettings.eventTypes[et.id] ? 'checked' : ''}>
            <label for="event-${et.id}">${et.name}</label>
        </div>
    `).join('');

    list.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const eventId = e.target.dataset.event;
            notificationSettings.eventTypes[eventId] = e.target.checked;
            await saveNotificationSettings();
        });
    });
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

async function sendBrowserNotification(title, message, icon = null) {
    if (!notificationSettings.browser.enabled) return;
    if (Notification.permission !== 'granted') {
        requestNotificationPermission();
        return;
    }

    const notification = new Notification(title, {
        body: message,
        icon: icon || chrome.runtime.getURL('icons/icon128.png'),
        tag: 'fptools-notification'
    });

    if (notificationSettings.browser.sound) {
        const audio = new Audio(chrome.runtime.getURL('sounds/telegram.mp3'));
        audio.play().catch(() => {});
    }

    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

async function sendEmailNotification(subject, message) {
    if (!notificationSettings.email.enabled || !notificationSettings.email.email) return;
    
    showNotification('Email уведомления требуют настройки серверной части', true);
}

function playNotificationSound(eventType) {
    if (!notificationSettings.soundFilters.enabled) return;

    const filters = notificationSettings.soundFilters.filters || {};
    const sound = filters[eventType] || 'default';

    if (sound === 'default') return;

    const audio = new Audio(chrome.runtime.getURL(`sounds/${sound}.mp3`));
    audio.play().catch(() => {});
}

function setupNotificationListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'sendNotification') {
            const { type, title, message } = request;
            
            if (notificationSettings.eventTypes && !notificationSettings.eventTypes[type]) {
                return;
            }

            sendTelegramNotification(title, message).catch(() => {});
            sendBrowserNotification(title, message).catch(() => {});
            sendEmailNotification(title, message).catch(() => {});
            playNotificationSound(type);
        }
    });
}

if (typeof window !== 'undefined') {
    window.initializeAdvancedNotifications = initializeAdvancedNotifications;
    window.sendBrowserNotification = sendBrowserNotification;
    window.sendTelegramNotification = sendTelegramNotification;
    window.playNotificationSound = playNotificationSound;
}


