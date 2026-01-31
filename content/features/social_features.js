let sellerRatings = {};
let blacklist = [];
let recommendations = [];

async function initializeSocialFeatures() {
    await loadSocialData();
    setupSocialUI();
    calculateSellerRatings();
}

async function loadSocialData() {
    const data = await chrome.storage.local.get([
        'fpToolsSellerRatings',
        'fpToolsBlacklist',
        'fpToolsRecommendations'
    ]);
    sellerRatings = data.fpToolsSellerRatings || {};
    blacklist = data.fpToolsBlacklist || [];
    recommendations = data.fpToolsRecommendations || [];
}

async function saveSocialData() {
    await chrome.storage.local.set({
        fpToolsSellerRatings: sellerRatings,
        fpToolsBlacklist: blacklist,
        fpToolsRecommendations: recommendations
    });
}

function setupSocialUI() {
    const socialPage = document.querySelector('.fp-tools-page-content[data-page="social"]');
    if (!socialPage) return;

    socialPage.innerHTML = `
        <h3>Социальные функции</h3>
        
        <div class="social-section">
            <h4>Рейтинг продавцов</h4>
            <p class="template-info">Внутренний рейтинг на основе отзывов и статистики</p>
            <div id="seller-ratings-list" style="margin-top: 15px;"></div>
            <button id="refresh-ratings-btn" class="btn" style="margin-top: 10px;">Обновить рейтинги</button>
        </div>

        <div class="social-section">
            <h4>Черный список покупателей</h4>
            <div class="input-group">
                <input type="text" id="blacklist-username" class="template-input" placeholder="Имя пользователя">
                <input type="text" id="blacklist-reason" class="template-input" placeholder="Причина (опционально)">
                <button id="add-blacklist-btn" class="btn">Добавить</button>
            </div>
            <div id="blacklist-list" style="margin-top: 15px;"></div>
        </div>

        <div class="social-section">
            <h4>Рекомендации по улучшению профиля</h4>
            <div id="recommendations-list" style="margin-top: 15px;"></div>
            <button id="generate-recommendations-btn" class="btn" style="margin-top: 10px;">Сгенерировать рекомендации</button>
        </div>
    `;

    setupSocialEventListeners();
    renderSellerRatings();
    renderBlacklist();
    renderRecommendations();
}

function setupSocialEventListeners() {
    document.getElementById('add-blacklist-btn')?.addEventListener('click', addToBlacklist);
    document.getElementById('refresh-ratings-btn')?.addEventListener('click', async () => {
        await calculateSellerRatings();
        renderSellerRatings();
        showNotification('Рейтинги обновлены', false);
    });
    document.getElementById('generate-recommendations-btn')?.addEventListener('click', generateRecommendations);
}

async function addToBlacklist() {
    const username = document.getElementById('blacklist-username').value.trim();
    const reason = document.getElementById('blacklist-reason').value.trim();

    if (!username) {
        showNotification('Введите имя пользователя', true);
        return;
    }

    if (blacklist.find(u => u.username === username)) {
        showNotification('Пользователь уже в черном списке', true);
        return;
    }

    blacklist.push({
        username,
        reason: reason || 'Добавлен в черный список',
        addedDate: Date.now()
    });

    await saveSocialData();
    renderBlacklist();
    showNotification(`Пользователь ${username} добавлен в черный список`, false);
    
    document.getElementById('blacklist-username').value = '';
    document.getElementById('blacklist-reason').value = '';
}

function renderBlacklist() {
    const list = document.getElementById('blacklist-list');
    if (!list) return;

    if (blacklist.length === 0) {
        list.innerHTML = '<p class="template-info">Черный список пуст</p>';
        return;
    }

    list.innerHTML = blacklist.map((user, index) => `
        <div class="blacklist-item">
            <div class="blacklist-info">
                <strong>${user.username}</strong>
                <span class="blacklist-reason">${user.reason}</span>
                <span class="blacklist-date">Добавлен: ${new Date(user.addedDate).toLocaleString('ru-RU')}</span>
            </div>
            <button class="btn btn-small remove-blacklist-btn" data-index="${index}">Удалить</button>
        </div>
    `).join('');

    list.querySelectorAll('.remove-blacklist-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            blacklist.splice(index, 1);
            await saveSocialData();
            renderBlacklist();
        });
    });
}

function checkBlacklist(username) {
    return blacklist.some(user => user.username === username);
}

async function calculateSellerRatings() {
    try {

        const myUsername = document.querySelector('.user-link-name')?.textContent.trim();
        if (!myUsername) return;


        const profileUrl = `https://funpay.com/users/${myUsername}/`;
        const response = await fetch(profileUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const reviews = [];
        doc.querySelectorAll('.review-item').forEach(item => {
            const rating = item.querySelector('.rating')?.textContent.trim();
            const text = item.querySelector('.review-text')?.textContent.trim();
            if (rating && text) {
                reviews.push({
                    rating: parseInt(rating.match(/\d+/)?.[0] || '0'),
                    text
                });
            }
        });

        const avgRating = reviews.length > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
            : 0;

        const positiveReviews = reviews.filter(r => r.rating >= 4).length;
        const totalReviews = reviews.length;

        sellerRatings[myUsername] = {
            username: myUsername,
            averageRating: avgRating,
            totalReviews,
            positiveReviews,
            rating: calculateOverallRating(avgRating, totalReviews, positiveReviews),
            lastUpdate: Date.now()
        };

        await saveSocialData();
    } catch (error) {
        console.error('Error calculating seller ratings:', error);
    }
}

function calculateOverallRating(avgRating, totalReviews, positiveReviews) {
    let rating = avgRating;
    
    if (totalReviews > 50) rating += 0.5;
    if (totalReviews > 100) rating += 0.5;
    
    if (totalReviews > 0) {
        const positivePercent = (positiveReviews / totalReviews) * 100;
        if (positivePercent > 95) rating += 0.3;
        if (positivePercent > 90) rating += 0.2;
    }

    return Math.min(5, Math.max(0, rating));
}

function renderSellerRatings() {
    const list = document.getElementById('seller-ratings-list');
    if (!list) return;

    if (Object.keys(sellerRatings).length === 0) {
        list.innerHTML = '<p class="template-info">Нет данных о рейтингах</p>';
        return;
    }

    list.innerHTML = Object.values(sellerRatings).map(rating => `
        <div class="seller-rating-item">
            <div class="rating-header">
                <strong>${rating.username}</strong>
                <span class="rating-badge">${rating.rating.toFixed(1)}/5.0</span>
            </div>
            <div class="rating-details">
                <span>Средняя оценка: ${rating.averageRating.toFixed(1)}</span>
                <span>Всего отзывов: ${rating.totalReviews}</span>
                <span>Положительных: ${rating.positiveReviews}</span>
            </div>
            <div class="rating-date">Обновлено: ${new Date(rating.lastUpdate).toLocaleString('ru-RU')}</div>
        </div>
    `).join('');
}

async function generateRecommendations() {
    const recommendationsDiv = document.getElementById('recommendations-list');
    if (!recommendationsDiv) return;

    recommendationsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const myUsername = document.querySelector('.user-link-name')?.textContent.trim();
        if (!myUsername) {
            recommendationsDiv.innerHTML = '<p class="template-info">Не удалось определить пользователя</p>';
            return;
        }

        const profileUrl = `https://funpay.com/users/${myUsername}/`;
        const response = await fetch(profileUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const lots = doc.querySelectorAll('.offer-list-item').length;
        const reviews = doc.querySelectorAll('.review-item').length;
        const avgRating = sellerRatings[myUsername]?.averageRating || 0;

        const newRecommendations = [];

        if (lots < 10) {
            newRecommendations.push({
                type: 'info',
                text: 'У вас мало лотов. Рассмотрите расширение ассортимента для увеличения продаж.'
            });
        }

        if (avgRating < 4.5 && reviews > 0) {
            newRecommendations.push({
                type: 'warning',
                text: 'Средний рейтинг ниже 4.5. Обратите внимание на качество обслуживания клиентов.'
            });
        }

        if (reviews < 20) {
            newRecommendations.push({
                type: 'info',
                text: 'Мало отзывов. Попросите довольных покупателей оставить отзыв.'
            });
        }

        const lotTitles = Array.from(doc.querySelectorAll('.offer-title')).map(el => el.textContent.trim());
        const avgTitleLength = lotTitles.reduce((sum, t) => sum + t.length, 0) / lotTitles.length;
        
        if (avgTitleLength < 30) {
            newRecommendations.push({
                type: 'suggestion',
                text: 'Названия лотов слишком короткие. Добавьте больше деталей для привлечения внимания.'
            });
        }

        recommendations = newRecommendations;
        await saveSocialData();
        renderRecommendations();
    } catch (error) {
        recommendationsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

function renderRecommendations() {
    const list = document.getElementById('recommendations-list');
    if (!list) return;

    if (recommendations.length === 0) {
        list.innerHTML = '<p class="template-info">Нет рекомендаций. Нажмите "Сгенерировать рекомендации"</p>';
        return;
    }

    list.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item recommendation-${rec.type}">
            <div class="recommendation-icon">
                ${rec.type === 'warning' ? '⚠️' : rec.type === 'suggestion' ? '💡' : 'ℹ️'}
            </div>
            <div class="recommendation-text">${rec.text}</div>
        </div>
    `).join('');
}

function checkBlacklistOnChatOpen() {
    const observer = new MutationObserver(() => {
        const buyerName = document.querySelector('.chat-full-header .user-link-name')?.textContent.trim();
        if (buyerName && checkBlacklist(buyerName)) {
            showBlacklistWarning(buyerName);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function showBlacklistWarning(username) {
    const warning = document.createElement('div');
    warning.className = 'blacklist-warning';
    warning.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff9800;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
    `;
    warning.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">🚫</span>
            <div>
                <strong>Пользователь в черном списке</strong>
                <p style="margin: 5px 0 0 0;">${username} находится в вашем черном списке.</p>
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

if (typeof window !== 'undefined') {
    window.initializeSocialFeatures = initializeSocialFeatures;
    window.checkBlacklist = checkBlacklist;
    checkBlacklistOnChatOpen();
}


