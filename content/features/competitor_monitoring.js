let competitorData = {};
let priceAlerts = [];

async function initializeCompetitorMonitoring() {
    await loadCompetitorData();
    setupCompetitorUI();
    startPriceMonitoring();
}

async function loadCompetitorData() {
    const data = await chrome.storage.local.get(['fpToolsCompetitors', 'fpToolsPriceAlerts']);
    competitorData = data.fpToolsCompetitors || {};
    priceAlerts = data.fpToolsPriceAlerts || [];
}

async function saveCompetitorData() {
    await chrome.storage.local.set({
        fpToolsCompetitors: competitorData,
        fpToolsPriceAlerts: priceAlerts
    });
}

function setupCompetitorUI() {
    const competitorPage = document.querySelector('.fp-tools-page-content[data-page="competitors"]');
    if (!competitorPage) return;

    competitorPage.innerHTML = `
        <h3>Мониторинг конкурентов</h3>
        
        <div class="competitor-section">
            <h4>Добавить конкурента</h4>
            <div class="input-group">
                <input type="text" id="competitor-username" class="template-input" placeholder="Имя пользователя конкурента">
                <button id="add-competitor-btn" class="btn">Добавить</button>
            </div>
        </div>

        <div class="competitor-section">
            <h4>Отслеживаемые конкуренты</h4>
            <div id="competitors-list"></div>
        </div>

        <div class="competitor-section">
            <h4>Анализ описаний</h4>
            <button id="analyze-competitors-btn" class="btn">Проанализировать описания конкурентов</button>
            <div id="competitor-analysis-results" style="margin-top: 15px;"></div>
        </div>

        <div class="competitor-section">
            <h4>Трекинг позиций в поиске</h4>
            <div class="input-group">
                <input type="text" id="search-keyword" class="template-input" placeholder="Ключевое слово для поиска">
                <button id="track-position-btn" class="btn">Начать отслеживание</button>
            </div>
            <div id="position-tracking-results" style="margin-top: 15px;"></div>
        </div>

        <div class="competitor-section">
            <h4>Сравнение цен</h4>
            <button id="compare-prices-btn" class="btn">Сравнить цены с рынком</button>
            <div id="price-comparison-results" style="margin-top: 15px;"></div>
        </div>

        <div class="competitor-section">
            <h4>Уведомления об изменении цен</h4>
            <div id="price-alerts-list"></div>
            <button id="add-price-alert-btn" class="btn" style="margin-top: 10px;">Добавить уведомление</button>
        </div>
    `;

    setupCompetitorEventListeners();
    renderCompetitorsList();
    renderPriceAlerts();
}

function setupCompetitorEventListeners() {
    document.getElementById('add-competitor-btn')?.addEventListener('click', async () => {
        const username = document.getElementById('competitor-username').value.trim();
        if (!username) {
            showNotification('Введите имя пользователя', true);
            return;
        }
        await addCompetitor(username);
    });

    document.getElementById('analyze-competitors-btn')?.addEventListener('click', analyzeCompetitorDescriptions);
    document.getElementById('track-position-btn')?.addEventListener('click', trackSearchPosition);
    document.getElementById('compare-prices-btn')?.addEventListener('click', compareMarketPrices);
    document.getElementById('add-price-alert-btn')?.addEventListener('click', showAddPriceAlertModal);
}

async function addCompetitor(username) {
    try {
        const profileUrl = `https://funpay.com/users/${username}/`;
        const response = await fetch(profileUrl);
        if (!response.ok) throw new Error('Пользователь не найден');

        competitorData[username] = {
            username,
            addedDate: Date.now(),
            lots: [],
            lastUpdate: null
        };

        await saveCompetitorData();
        await updateCompetitorLots(username);
        renderCompetitorsList();
        showNotification(`Конкурент ${username} добавлен`, false);
        document.getElementById('competitor-username').value = '';
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, true);
    }
}

async function updateCompetitorLots(username) {
    try {
        const profileUrl = `https://funpay.com/users/${username}/`;
        const response = await fetch(profileUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const lots = [];
        doc.querySelectorAll('.offer-list-item').forEach(item => {
            const title = item.querySelector('.offer-title')?.textContent.trim();
            const price = item.querySelector('.price')?.textContent.trim();
            const lotId = item.querySelector('a')?.href.match(/\/lots\/(\d+)/)?.[1];
            
            if (title && price && lotId) {
                lots.push({
                    id: lotId,
                    title,
                    price: parsePrice(price),
                    url: `https://funpay.com/lots/offer?id=${lotId}`
                });
            }
        });

        if (competitorData[username]) {
            const oldLots = competitorData[username].lots || [];
            competitorData[username].lots = lots;
            competitorData[username].lastUpdate = Date.now();

            checkPriceChanges(username, oldLots, lots);
        }

        await saveCompetitorData();
    } catch (error) {
        console.error('Error updating competitor lots:', error);
    }
}

function parsePrice(priceStr) {
    const match = priceStr.match(/([\d\s,]+)/);
    return match ? parseFloat(match[1].replace(/\s/g, '').replace(',', '.')) : 0;
}

function checkPriceChanges(username, oldLots, newLots) {
    oldLots.forEach(oldLot => {
        const newLot = newLots.find(l => l.id === oldLot.id);
        if (newLot && newLot.price !== oldLot.price) {
            const change = newLot.price - oldLot.price;
            const percent = ((change / oldLot.price) * 100).toFixed(1);
            
            priceAlerts.forEach(alert => {
                if (alert.competitor === username && alert.lotId === oldLot.id) {
                    if (Math.abs(change) >= alert.threshold) {
                        showPriceAlertNotification(username, oldLot.title, oldLot.price, newLot.price, change);
                    }
                }
            });

            showNotification(
                `Цена изменилась: ${oldLot.title} - ${oldLot.price}₽ → ${newLot.price}₽ (${change > 0 ? '+' : ''}${percent}%)`,
                false
            );
        }
    });
}

function showPriceAlertNotification(username, title, oldPrice, newPrice, change) {
    const message = `🚨 Изменение цены!\n${username}: ${title}\n${oldPrice}₽ → ${newPrice}₽ (${change > 0 ? '+' : ''}${change}₽)`;
    
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Изменение цены конкурента',
        message: message
    });
}

function renderCompetitorsList() {
    const list = document.getElementById('competitors-list');
    if (!list) return;

    if (Object.keys(competitorData).length === 0) {
        list.innerHTML = '<p class="template-info">Нет отслеживаемых конкурентов</p>';
        return;
    }

    list.innerHTML = Object.values(competitorData).map(comp => `
        <div class="competitor-item" data-username="${comp.username}">
            <div class="competitor-info">
                <strong>${comp.username}</strong>
                <span class="competitor-meta">
                    Лотов: ${comp.lots?.length || 0} | 
                    Обновлено: ${comp.lastUpdate ? new Date(comp.lastUpdate).toLocaleString('ru-RU') : 'Никогда'}
                </span>
            </div>
            <div class="competitor-actions">
                <button class="btn btn-small update-competitor-btn" data-username="${comp.username}">Обновить</button>
                <button class="btn btn-small view-competitor-btn" data-username="${comp.username}">Просмотр</button>
                <button class="btn btn-small remove-competitor-btn" data-username="${comp.username}">Удалить</button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.update-competitor-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const username = btn.dataset.username;
            await updateCompetitorLots(username);
            renderCompetitorsList();
            showNotification('Данные обновлены', false);
        });
    });

    list.querySelectorAll('.view-competitor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.dataset.username;
            window.open(`https://funpay.com/users/${username}/`, '_blank');
        });
    });

    list.querySelectorAll('.remove-competitor-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const username = btn.dataset.username;
            delete competitorData[username];
            await saveCompetitorData();
            renderCompetitorsList();
            showNotification('Конкурент удален', false);
        });
    });
}

async function analyzeCompetitorDescriptions() {
    const resultsDiv = document.getElementById('competitor-analysis-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const myLots = await getMyLots();
        const competitorLots = Object.values(competitorData).flatMap(c => c.lots || []);

        if (competitorLots.length === 0) {
            resultsDiv.innerHTML = '<p class="template-info">Нет данных о конкурентах. Добавьте конкурентов и обновите их данные.</p>';
            return;
        }

        const analysis = {
            avgTitleLength: competitorLots.reduce((sum, l) => sum + (l.title?.length || 0), 0) / competitorLots.length,
            commonWords: findCommonWords(competitorLots.map(l => l.title)),
            recommendations: generateRecommendations(myLots, competitorLots)
        };

        resultsDiv.innerHTML = `
            <div class="analysis-card">
                <h5>Статистика описаний конкурентов</h5>
                <p>Средняя длина названия: ${Math.round(analysis.avgTitleLength)} символов</p>
                <p>Популярные слова: ${analysis.commonWords.slice(0, 10).join(', ')}</p>
            </div>
            <div class="analysis-card">
                <h5>Рекомендации</h5>
                <ul>
                    ${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

function findCommonWords(titles) {
    const words = {};
    titles.forEach(title => {
        title.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 3) {
                words[word] = (words[word] || 0) + 1;
            }
        });
    });
    return Object.entries(words)
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word);
}

function generateRecommendations(myLots, competitorLots) {
    const recommendations = [];
    const myAvgTitleLength = myLots.reduce((sum, l) => sum + (l.title?.length || 0), 0) / myLots.length;
    const compAvgTitleLength = competitorLots.reduce((sum, l) => sum + (l.title?.length || 0), 0) / competitorLots.length;

    if (myAvgTitleLength < compAvgTitleLength * 0.8) {
        recommendations.push('Ваши названия короче, чем у конкурентов. Попробуйте добавить больше деталей.');
    }

    if (myLots.length < competitorLots.length / Object.keys(competitorData).length) {
        recommendations.push('У вас меньше лотов, чем в среднем у конкурентов. Рассмотрите расширение ассортимента.');
    }

    return recommendations.length > 0 ? recommendations : ['Ваши лоты выглядят конкурентоспособно!'];
}

async function getMyLots() {
    const response = await fetch('https://funpay.com/lots/');
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const lots = [];
    doc.querySelectorAll('.offer-list-item').forEach(item => {
        const title = item.querySelector('.offer-title')?.textContent.trim();
        const price = item.querySelector('.price')?.textContent.trim();
        if (title && price) {
            lots.push({ title, price: parsePrice(price) });
        }
    });

    return lots;
}

async function trackSearchPosition() {
    const keyword = document.getElementById('search-keyword').value.trim();
    if (!keyword) {
        showNotification('Введите ключевое слово', true);
        return;
    }

    const resultsDiv = document.getElementById('position-tracking-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const searchUrl = `https://funpay.com/search?query=${encodeURIComponent(keyword)}`;
        const response = await fetch(searchUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const myLots = [];
        doc.querySelectorAll('.offer-list-item').forEach((item, index) => {
            const seller = item.querySelector('.user-link-name')?.textContent.trim();
            const myUsername = document.querySelector('.user-link-name')?.textContent.trim();
            
            if (seller === myUsername) {
                myLots.push({
                    position: index + 1,
                    title: item.querySelector('.offer-title')?.textContent.trim(),
                    price: item.querySelector('.price')?.textContent.trim()
                });
            }
        });

        if (myLots.length === 0) {
            resultsDiv.innerHTML = '<p class="template-info">Ваши лоты не найдены в результатах поиска</p>';
        } else {
            resultsDiv.innerHTML = `
                <div class="analysis-card">
                    <h5>Позиции ваших лотов по запросу "${keyword}"</h5>
                    <ul>
                        ${myLots.map(lot => `<li>Позиция ${lot.position}: ${lot.title} - ${lot.price}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

async function compareMarketPrices() {
    const resultsDiv = document.getElementById('price-comparison-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const myLots = await getMyLots();
        const competitorLots = Object.values(competitorData).flatMap(c => c.lots || []);

        if (competitorLots.length === 0) {
            resultsDiv.innerHTML = '<p class="template-info">Нет данных о конкурентах</p>';
            return;
        }

        const comparison = myLots.map(myLot => {
            const similarLots = competitorLots.filter(cl => 
                calculateSimilarity(myLot.title.toLowerCase(), cl.title?.toLowerCase() || '') > 0.5
            );

            if (similarLots.length === 0) return null;

            const avgPrice = similarLots.reduce((sum, l) => sum + l.price, 0) / similarLots.length;
            const minPrice = Math.min(...similarLots.map(l => l.price));
            const maxPrice = Math.max(...similarLots.map(l => l.price));

            return {
                title: myLot.title,
                myPrice: myLot.price,
                avgPrice,
                minPrice,
                maxPrice,
                recommendation: myLot.price > avgPrice * 1.1 ? 'Снизить цену' : 
                               myLot.price < avgPrice * 0.9 ? 'Можно повысить' : 'Цена оптимальна'
            };
        }).filter(Boolean);

        if (comparison.length === 0) {
            resultsDiv.innerHTML = '<p class="template-info">Не найдено похожих лотов для сравнения</p>';
            return;
        }

        resultsDiv.innerHTML = `
            <div class="analysis-card">
                <h5>Сравнение цен</h5>
                <table class="price-comparison-table">
                    <thead>
                        <tr>
                            <th>Лот</th>
                            <th>Ваша цена</th>
                            <th>Средняя</th>
                            <th>Диапазон</th>
                            <th>Рекомендация</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparison.map(c => `
                            <tr>
                                <td>${c.title}</td>
                                <td>${c.myPrice}₽</td>
                                <td>${c.avgPrice.toFixed(0)}₽</td>
                                <td>${c.minPrice}₽ - ${c.maxPrice}₽</td>
                                <td class="${c.recommendation.includes('Снизить') ? 'price-high' : 
                                           c.recommendation.includes('повысить') ? 'price-low' : 'price-ok'}">
                                    ${c.recommendation}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

function calculateSimilarity(str1, str2) {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
}

function renderPriceAlerts() {
    const list = document.getElementById('price-alerts-list');
    if (!list) return;

    if (priceAlerts.length === 0) {
        list.innerHTML = '<p class="template-info">Нет настроенных уведомлений</p>';
        return;
    }

    list.innerHTML = priceAlerts.map((alert, index) => `
        <div class="price-alert-item">
            <span>${alert.competitor} - ${alert.lotTitle || 'Лот #' + alert.lotId}</span>
            <span>Порог: ${alert.threshold}₽</span>
            <button class="btn btn-small remove-alert-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.remove-alert-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            priceAlerts.splice(index, 1);
            await saveCompetitorData();
            renderPriceAlerts();
        });
    });
}

function showAddPriceAlertModal() {
    const competitor = prompt('Имя конкурента:');
    const lotId = prompt('ID лота:');
    const threshold = parseFloat(prompt('Порог изменения цены (₽):'));

    if (competitor && lotId && threshold) {
        priceAlerts.push({
            competitor,
            lotId,
            threshold,
            lotTitle: competitorData[competitor]?.lots?.find(l => l.id === lotId)?.title
        });
        saveCompetitorData();
        renderPriceAlerts();
        showNotification('Уведомление добавлено', false);
    }
}

function startPriceMonitoring() {
    setInterval(async () => {
        for (const username of Object.keys(competitorData)) {
            await updateCompetitorLots(username);
        }
        await saveCompetitorData();
    }, 30 * 60 * 1000);
}

if (typeof window !== 'undefined') {
    window.initializeCompetitorMonitoring = initializeCompetitorMonitoring;
}


