let scammerDatabase = {};
let securityLogs = [];
let backupSettings = { enabled: false, frequency: 'daily' };

async function initializeSecurityFeatures() {
    await loadSecurityData();
    setupSecurityUI();
    startSecurityMonitoring();
}

async function loadSecurityData() {
    const data = await chrome.storage.local.get([
        'fpToolsScammerDatabase',
        'fpToolsSecurityLogs',
        'fpToolsBackupSettings'
    ]);
    scammerDatabase = data.fpToolsScammerDatabase || {};
    securityLogs = data.fpToolsSecurityLogs || [];
    backupSettings = data.fpToolsBackupSettings || backupSettings;
}

async function saveSecurityData() {
    await chrome.storage.local.set({
        fpToolsScammerDatabase: scammerDatabase,
        fpToolsSecurityLogs: securityLogs,
        fpToolsBackupSettings: backupSettings
    });
}

function setupSecurityUI() {
    const securityPage = document.querySelector('.fp-tools-page-content[data-page="security"]');
    if (!securityPage) return;

    securityPage.innerHTML = `
        <h3>Безопасность и защита</h3>
        
        <div class="security-section">
            <h4>Защита от мошенников</h4>
            <div class="input-group">
                <input type="text" id="scammer-username" class="template-input" placeholder="Имя пользователя">
                <input type="text" id="scammer-reason" class="template-input" placeholder="Причина (опционально)">
                <button id="add-scammer-btn" class="btn">Добавить в базу</button>
            </div>
            <div id="scammer-database-list" style="margin-top: 15px;"></div>
            <div class="checkbox-label-inline" style="margin-top: 15px;">
                <input type="checkbox" id="enable-scammer-warnings">
                <label for="enable-scammer-warnings">Показывать предупреждения о мошенниках</label>
            </div>
        </div>

        <div class="security-section">
            <h4>Двухфакторная аутентификация</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="enable-2fa">
                <label for="enable-2fa">Включить 2FA для критичных настроек</label>
            </div>
            <div id="2fa-settings" style="margin-top: 15px; display: none;">
                <p class="template-info">2FA будет запрашиваться при изменении важных настроек (автоответчик, авто-поднятие, экспорт лотов)</p>
                <button id="setup-2fa-btn" class="btn">Настроить 2FA</button>
            </div>
        </div>

        <div class="security-section">
            <h4>Резервное копирование</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="enable-backup">
                <label for="enable-backup">Включить автоматическое резервное копирование</label>
            </div>
            <div id="backup-settings" style="margin-top: 15px; display: none;">
                <label for="backup-frequency">Частота копирования:</label>
                <select id="backup-frequency" class="template-input">
                    <option value="hourly">Каждый час</option>
                    <option value="daily">Ежедневно</option>
                    <option value="weekly">Еженедельно</option>
                </select>
                <button id="manual-backup-btn" class="btn" style="margin-top: 10px;">Создать резервную копию сейчас</button>
                <button id="restore-backup-btn" class="btn" style="margin-top: 10px;">Восстановить из копии</button>
                <div id="backup-history" style="margin-top: 15px;"></div>
            </div>
        </div>

        <div class="security-section">
            <h4>Логирование действий</h4>
            <div class="checkbox-label-inline">
                <input type="checkbox" id="enable-logging">
                <label for="enable-logging">Включить логирование всех действий</label>
            </div>
            <div id="security-logs" style="margin-top: 15px;"></div>
            <button id="clear-logs-btn" class="btn" style="margin-top: 10px;">Очистить логи</button>
            <button id="export-logs-btn" class="btn" style="margin-top: 10px;">Экспортировать логи</button>
        </div>
    `;

    setupSecurityEventListeners();
    renderScammerDatabase();
    renderSecurityLogs();
    updateBackupHistory();
}

function setupSecurityEventListeners() {
    document.getElementById('add-scammer-btn')?.addEventListener('click', addScammer);
    document.getElementById('enable-scammer-warnings')?.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ fpToolsScammerWarningsEnabled: e.target.checked });
    });
    document.getElementById('enable-2fa')?.addEventListener('change', async (e) => {
        const settingsDiv = document.getElementById('2fa-settings');
        settingsDiv.style.display = e.target.checked ? 'block' : 'none';
        await chrome.storage.local.set({ fpTools2FAEnabled: e.target.checked });
    });
    document.getElementById('setup-2fa-btn')?.addEventListener('click', setup2FA);
    document.getElementById('enable-backup')?.addEventListener('change', async (e) => {
        const settingsDiv = document.getElementById('backup-settings');
        settingsDiv.style.display = e.target.checked ? 'block' : 'none';
        backupSettings.enabled = e.target.checked;
        await saveSecurityData();
    });
    document.getElementById('backup-frequency')?.addEventListener('change', async (e) => {
        backupSettings.frequency = e.target.value;
        await saveSecurityData();
    });
    document.getElementById('manual-backup-btn')?.addEventListener('click', createBackup);
    document.getElementById('restore-backup-btn')?.addEventListener('click', restoreBackup);
    document.getElementById('enable-logging')?.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ fpToolsLoggingEnabled: e.target.checked });
    });
    document.getElementById('clear-logs-btn')?.addEventListener('click', clearLogs);
    document.getElementById('export-logs-btn')?.addEventListener('click', exportLogs);
}

async function addScammer() {
    const username = document.getElementById('scammer-username').value.trim();
    const reason = document.getElementById('scammer-reason').value.trim();

    if (!username) {
        showNotification('Введите имя пользователя', true);
        return;
    }

    scammerDatabase[username] = {
        username,
        reason: reason || 'Мошенник',
        addedDate: Date.now(),
        reportedBy: document.querySelector('.user-link-name')?.textContent.trim() || 'Unknown'
    };

    await saveSecurityData();
    logSecurityAction('scammer_added', { username, reason });
    renderScammerDatabase();
    showNotification(`Пользователь ${username} добавлен в базу мошенников`, false);
    
    document.getElementById('scammer-username').value = '';
    document.getElementById('scammer-reason').value = '';
}

function renderScammerDatabase() {
    const list = document.getElementById('scammer-database-list');
    if (!list) return;

    if (Object.keys(scammerDatabase).length === 0) {
        list.innerHTML = '<p class="template-info">База мошенников пуста</p>';
        return;
    }

    list.innerHTML = Object.values(scammerDatabase).map(scammer => `
        <div class="scammer-item">
            <div class="scammer-info">
                <strong>${scammer.username}</strong>
                <span class="scammer-reason">${scammer.reason}</span>
                <span class="scammer-date">Добавлен: ${new Date(scammer.addedDate).toLocaleString('ru-RU')}</span>
            </div>
            <button class="btn btn-small remove-scammer-btn" data-username="${scammer.username}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.remove-scammer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            delete scammerDatabase[btn.dataset.username];
            await saveSecurityData();
            logSecurityAction('scammer_removed', { username: btn.dataset.username });
            renderScammerDatabase();
        });
    });
}

function checkScammer(username) {
    if (scammerDatabase[username]) {
        const scammer = scammerDatabase[username];
        showScammerWarning(username, scammer.reason);
        logSecurityAction('scammer_detected', { username, reason: scammer.reason });
        return true;
    }
    return false;
}

function showScammerWarning(username, reason) {
    const { fpToolsScammerWarningsEnabled } = chrome.storage.local.get('fpToolsScammerWarningsEnabled');
    if (!fpToolsScammerWarningsEnabled) return;

    const warning = document.createElement('div');
    warning.className = 'scammer-warning';
    warning.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
    `;
    warning.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">⚠️</span>
            <div>
                <strong>ВНИМАНИЕ: Мошенник!</strong>
                <p style="margin: 5px 0 0 0;">Пользователь ${username} находится в базе мошенников.</p>
                <p style="margin: 5px 0 0 0; font-size: 12px;">Причина: ${reason}</p>
            </div>
            <button class="close-warning" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
    `;

    document.body.appendChild(warning);

    warning.querySelector('.close-warning').addEventListener('click', () => {
        warning.remove();
    });

    setTimeout(() => {
        if (warning.parentElement) {
            warning.remove();
        }
    }, 10000);
}

async function setup2FA() {
    const password = prompt('Введите пароль для 2FA (будет использоваться для защиты настроек):');
    if (!password) return;

    const hashedPassword = await hashPassword(password);
    await chrome.storage.local.set({ fpTools2FAPassword: hashedPassword });
    showNotification('2FA настроен', false);
    logSecurityAction('2fa_setup', {});
}

async function verify2FA() {
    const { fpTools2FAEnabled, fpTools2FAPassword } = await chrome.storage.local.get(['fpTools2FAEnabled', 'fpTools2FAPassword']);
    if (!fpTools2FAEnabled || !fpTools2FAPassword) return true;

    const password = prompt('Введите пароль 2FA:');
    if (!password) return false;

    const hashedPassword = await hashPassword(password);
    return hashedPassword === fpTools2FAPassword;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function createBackup() {
    try {
        const allData = await chrome.storage.local.get(null);
        const backup = {
            timestamp: Date.now(),
            data: allData,
            version: chrome.runtime.getManifest().version
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fptools-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        const backups = (await chrome.storage.local.get('fpToolsBackupHistory')).fpToolsBackupHistory || [];
        backups.push({ timestamp: backup.timestamp, size: blob.size });
        await chrome.storage.local.set({ fpToolsBackupHistory: backups });

        logSecurityAction('backup_created', { timestamp: backup.timestamp });
        showNotification('Резервная копия создана', false);
        updateBackupHistory();
    } catch (error) {
        showNotification(`Ошибка создания копии: ${error.message}`, true);
    }
}

async function restoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.data) {
                throw new Error('Неверный формат файла резервной копии');
            }

            if (!confirm('Восстановление перезапишет все текущие настройки. Продолжить?')) {
                return;
            }

            await chrome.storage.local.clear();
            await chrome.storage.local.set(backup.data);

            logSecurityAction('backup_restored', { timestamp: backup.timestamp });
            showNotification('Резервная копия восстановлена. Перезагрузите страницу.', false);
        } catch (error) {
            showNotification(`Ошибка восстановления: ${error.message}`, true);
        }
    };

    input.click();
}

function updateBackupHistory() {
    const historyDiv = document.getElementById('backup-history');
    if (!historyDiv) return;

    chrome.storage.local.get('fpToolsBackupHistory', ({ fpToolsBackupHistory }) => {
        const backups = fpToolsBackupHistory || [];
        
        if (backups.length === 0) {
            historyDiv.innerHTML = '<p class="template-info">Нет созданных копий</p>';
            return;
        }

        historyDiv.innerHTML = `
            <h5>История копий:</h5>
            <ul>
                ${backups.slice(-5).reverse().map(backup => `
                    <li>${new Date(backup.timestamp).toLocaleString('ru-RU')} (${(backup.size / 1024).toFixed(2)} KB)</li>
                `).join('')}
            </ul>
        `;
    });
}

function logSecurityAction(action, details) {
    const { fpToolsLoggingEnabled } = chrome.storage.local.get('fpToolsLoggingEnabled');
    if (!fpToolsLoggingEnabled) return;

    const logEntry = {
        timestamp: Date.now(),
        action,
        details,
        user: document.querySelector('.user-link-name')?.textContent.trim() || 'Unknown',
        url: window.location.href
    };

    securityLogs.push(logEntry);

    if (securityLogs.length > 1000) {
        securityLogs = securityLogs.slice(-1000);
    }

    saveSecurityData();
}

function renderSecurityLogs() {
    const logsDiv = document.getElementById('security-logs');
    if (!logsDiv) return;

    if (securityLogs.length === 0) {
        logsDiv.innerHTML = '<p class="template-info">Логи пусты</p>';
        return;
    }

    logsDiv.innerHTML = `
        <div class="logs-container" style="max-height: 400px; overflow-y: auto;">
            ${securityLogs.slice(-50).reverse().map(log => `
                <div class="log-entry">
                    <div class="log-header">
                        <strong>${getActionName(log.action)}</strong>
                        <span class="log-date">${new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                    </div>
                    <div class="log-details">${JSON.stringify(log.details, null, 2)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function getActionName(action) {
    const names = {
        scammer_added: 'Добавлен мошенник',
        scammer_removed: 'Удален мошенник',
        scammer_detected: 'Обнаружен мошенник',
        '2fa_setup': 'Настроена 2FA',
        backup_created: 'Создана резервная копия',
        backup_restored: 'Восстановлена резервная копия',
        settings_changed: 'Изменены настройки'
    };
    return names[action] || action;
}

function clearLogs() {
    if (!confirm('Очистить все логи?')) return;
    
    securityLogs = [];
    saveSecurityData();
    renderSecurityLogs();
    showNotification('Логи очищены', false);
}

function exportLogs() {
    const blob = new Blob([JSON.stringify(securityLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fptools-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Логи экспортированы', false);
}

function startSecurityMonitoring() {
    const observer = new MutationObserver(() => {
        const userLinks = document.querySelectorAll('.user-link-name, .chat-full-header .user-link-name');
        userLinks.forEach(link => {
            const username = link.textContent.trim();
            if (username && scammerDatabase[username]) {
                checkScammer(username);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function startBackupSchedule() {
    if (!backupSettings.enabled) return;

    const intervals = {
        hourly: 60 * 60 * 1000,
        daily: 24 * 60 * 60 * 1000,
        weekly: 7 * 24 * 60 * 60 * 1000
    };

    const interval = intervals[backupSettings.frequency] || intervals.daily;
    
    setInterval(() => {
        createBackup();
    }, interval);
}

if (typeof window !== 'undefined') {
    window.initializeSecurityFeatures = initializeSecurityFeatures;
    window.checkScammer = checkScammer;
    window.verify2FA = verify2FA;
    window.logSecurityAction = logSecurityAction;
}


