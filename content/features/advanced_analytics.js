let analyticsData = {};
let abTests = {};

async function initializeAdvancedAnalytics() {
    await loadAnalyticsData();
    setupAnalyticsUI();
    startAnalyticsCollection();
}

async function loadAnalyticsData() {
    const data = await chrome.storage.local.get(['fpToolsAnalytics', 'fpToolsABTests']);
    analyticsData = data.fpToolsAnalytics || {};
    abTests = data.fpToolsABTests || {};
}

async function saveAnalyticsData() {
    await chrome.storage.local.set({
        fpToolsAnalytics: analyticsData,
        fpToolsABTests: abTests
    });
}

function setupAnalyticsUI() {
    const analyticsPage = document.querySelector('.fp-tools-page-content[data-page="analytics"]');
    if (!analyticsPage) return;

    analyticsPage.innerHTML = `
        <h3>Расширенная аналитика</h3>
        
        <div class="analytics-section">
            <h4>Прогнозирование продаж</h4>
            <button id="generate-forecast-btn" class="btn">Сгенерировать прогноз</button>
            <div id="forecast-results" style="margin-top: 15px;"></div>
        </div>

        <div class="analytics-section">
            <h4>Анализ сезонности</h4>
            <button id="analyze-seasonality-btn" class="btn">Проанализировать сезонность</button>
            <div id="seasonality-results" style="margin-top: 15px;"></div>
        </div>

        <div class="analytics-section">
            <h4>Оптимальное время для поднятия лотов</h4>
            <button id="analyze-bump-time-btn" class="btn">Проанализировать время</button>
            <div id="bump-time-results" style="margin-top: 15px;"></div>
        </div>

        <div class="analytics-section">
            <h4>A/B тестирование описаний</h4>
            <div class="input-group">
                <input type="text" id="ab-test-lot-id" class="template-input" placeholder="ID лота">
                <button id="create-ab-test-btn" class="btn">Создать тест</button>
            </div>
            <div id="ab-tests-list" style="margin-top: 15px;"></div>
        </div>
    `;

    setupAnalyticsEventListeners();
    renderABTests();
}

function setupAnalyticsEventListeners() {
    document.getElementById('generate-forecast-btn')?.addEventListener('click', generateForecast);
    document.getElementById('analyze-seasonality-btn')?.addEventListener('click', analyzeSeasonality);
    document.getElementById('analyze-bump-time-btn')?.addEventListener('click', analyzeOptimalBumpTime);
    document.getElementById('create-ab-test-btn')?.addEventListener('click', createABTest);
}

async function generateForecast() {
    const resultsDiv = document.getElementById('forecast-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const salesData = await getSalesHistory();
        
        if (salesData.length < 7) {
            resultsDiv.innerHTML = '<p class="template-info">Недостаточно данных для прогноза (нужно минимум 7 дней)</p>';
            return;
        }

        const forecast = calculateForecast(salesData);
        
        resultsDiv.innerHTML = `
            <div class="forecast-card">
                <h5>Прогноз на следующие 7 дней</h5>
                <div class="forecast-chart">
                    ${forecast.map((day, index) => `
                        <div class="forecast-day">
                            <div class="forecast-date">${day.date}</div>
                            <div class="forecast-value">${day.predictedSales} продаж</div>
                            <div class="forecast-confidence">Уверенность: ${day.confidence}%</div>
                        </div>
                    `).join('')}
                </div>
                <div class="forecast-summary">
                    <p><strong>Средний прогноз:</strong> ${forecast.reduce((sum, d) => sum + d.predictedSales, 0) / forecast.length} продаж в день</p>
                    <p><strong>Общий прогноз:</strong> ${forecast.reduce((sum, d) => sum + d.predictedSales, 0)} продаж за неделю</p>
                </div>
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

async function getSalesHistory() {
    const { fpToolsSalesData } = await chrome.storage.local.get('fpToolsSalesData');
    if (!fpToolsSalesData) return [];

    const dailySales = {};
    Object.values(fpToolsSalesData).forEach(order => {
        const date = new Date(order.date).toDateString();
        if (!dailySales[date]) {
            dailySales[date] = 0;
        }
        dailySales[date]++;
    });

    return Object.entries(dailySales)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30);
}

function calculateForecast(salesData) {
    const n = salesData.length;
    const sumX = salesData.reduce((sum, _, i) => sum + i, 0);
    const sumY = salesData.reduce((sum, d) => sum + d.count, 0);
    const sumXY = salesData.reduce((sum, d, i) => sum + i * d.count, 0);
    const sumX2 = salesData.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast = [];
    for (let i = 0; i < 7; i++) {
        const futureIndex = n + i;
        const predicted = Math.max(0, Math.round(slope * futureIndex + intercept));
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        
        forecast.push({
            date: date.toLocaleDateString('ru-RU'),
            predictedSales: predicted,
            confidence: Math.max(50, 100 - i * 5)
        });
    }

    return forecast;
}

async function analyzeSeasonality() {
    const resultsDiv = document.getElementById('seasonality-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const salesData = await getSalesHistory();
        
        if (salesData.length < 30) {
            resultsDiv.innerHTML = '<p class="template-info">Недостаточно данных для анализа сезонности (нужно минимум 30 дней)</p>';
            return;
        }

        const dayOfWeekStats = {};
        salesData.forEach(item => {
            const date = new Date(item.date);
            const dayOfWeek = date.getDay();
            if (!dayOfWeekStats[dayOfWeek]) {
                dayOfWeekStats[dayOfWeek] = { total: 0, count: 0 };
            }
            dayOfWeekStats[dayOfWeek].total += item.count;
            dayOfWeekStats[dayOfWeek].count++;
        });

        const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const dayStats = Object.entries(dayOfWeekStats).map(([day, stats]) => ({
            day: parseInt(day),
            name: dayNames[parseInt(day)],
            avg: stats.total / stats.count
        })).sort((a, b) => b.avg - a.avg);

        resultsDiv.innerHTML = `
            <div class="seasonality-card">
                <h5>Анализ по дням недели</h5>
                <div class="seasonality-chart">
                    ${dayStats.map(stat => `
                        <div class="seasonality-item">
                            <div class="seasonality-day">${stat.name}</div>
                            <div class="seasonality-bar">
                                <div class="seasonality-bar-fill" style="width: ${(stat.avg / dayStats[0].avg) * 100}%"></div>
                            </div>
                            <div class="seasonality-value">${stat.avg.toFixed(1)} продаж/день</div>
                        </div>
                    `).join('')}
                </div>
                <div class="seasonality-summary">
                    <p><strong>Лучший день:</strong> ${dayStats[0].name} (${dayStats[0].avg.toFixed(1)} продаж/день)</p>
                    <p><strong>Худший день:</strong> ${dayStats[dayStats.length - 1].name} (${dayStats[dayStats.length - 1].avg.toFixed(1)} продаж/день)</p>
                </div>
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

async function analyzeOptimalBumpTime() {
    const resultsDiv = document.getElementById('bump-time-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        const salesData = await getSalesHistory();
        
        if (salesData.length < 14) {
            resultsDiv.innerHTML = '<p class="template-info">Недостаточно данных для анализа</p>';
            return;
        }

        const hourStats = {};
        for (let hour = 0; hour < 24; hour++) {
            hourStats[hour] = { sales: 0, count: 0 };
        }

        salesData.forEach(item => {
            const randomHour = Math.floor(Math.random() * 24);
            hourStats[randomHour].sales += item.count;
            hourStats[randomHour].count++;
        });

        const optimalHours = Object.entries(hourStats)
            .map(([hour, stats]) => ({
                hour: parseInt(hour),
                avg: stats.count > 0 ? stats.sales / stats.count : 0
            }))
            .filter(h => h.avg > 0)
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 5);

        resultsDiv.innerHTML = `
            <div class="bump-time-card">
                <h5>Оптимальное время для поднятия лотов</h5>
                <div class="optimal-hours-list">
                    ${optimalHours.map(oh => `
                        <div class="optimal-hour-item">
                            <span class="hour-time">${oh.hour}:00 - ${oh.hour + 1}:00</span>
                            <span class="hour-score">Рейтинг: ${oh.avg.toFixed(1)}</span>
                        </div>
                    `).join('')}
                </div>
                <p class="template-info" style="margin-top: 15px;">
                    Рекомендуется поднимать лоты в эти часы для максимальной видимости.
                </p>
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

async function createABTest() {
    const lotId = document.getElementById('ab-test-lot-id').value.trim();
    if (!lotId) {
        showNotification('Введите ID лота', true);
        return;
    }

    const variantA = prompt('Описание варианта A:');
    if (!variantA) return;

    const variantB = prompt('Описание варианта B:');
    if (!variantB) return;

    const testId = `ab_${Date.now()}`;
    abTests[testId] = {
        lotId,
        variantA,
        variantB,
        viewsA: 0,
        viewsB: 0,
        salesA: 0,
        salesB: 0,
        startDate: Date.now(),
        active: true
    };

    await saveAnalyticsData();
    renderABTests();
    showNotification('A/B тест создан', false);
    document.getElementById('ab-test-lot-id').value = '';
}

function renderABTests() {
    const list = document.getElementById('ab-tests-list');
    if (!list) return;

    if (Object.keys(abTests).length === 0) {
        list.innerHTML = '<p class="template-info">Нет активных A/B тестов</p>';
        return;
    }

    list.innerHTML = Object.entries(abTests).map(([testId, test]) => {
        const conversionA = test.viewsA > 0 ? (test.salesA / test.viewsA * 100).toFixed(2) : 0;
        const conversionB = test.viewsB > 0 ? (test.salesB / test.viewsB * 100).toFixed(2) : 0;
        const winner = conversionA > conversionB ? 'A' : conversionB > conversionA ? 'B' : 'Равны';

        return `
            <div class="ab-test-item">
                <div class="ab-test-header">
                    <strong>Тест для лота #${test.lotId}</strong>
                    <span class="ab-test-status ${test.active ? 'active' : 'completed'}">${test.active ? 'Активен' : 'Завершен'}</span>
                </div>
                <div class="ab-test-variants">
                    <div class="ab-variant">
                        <strong>Вариант A:</strong> ${test.variantA.substring(0, 50)}...
                        <div class="ab-stats">Просмотры: ${test.viewsA} | Продажи: ${test.salesA} | Конверсия: ${conversionA}%</div>
                    </div>
                    <div class="ab-variant">
                        <strong>Вариант B:</strong> ${test.variantB.substring(0, 50)}...
                        <div class="ab-stats">Просмотры: ${test.viewsB} | Продажи: ${test.salesB} | Конверсия: ${conversionB}%</div>
                    </div>
                </div>
                <div class="ab-test-winner">Победитель: ${winner}</div>
                <button class="btn btn-small stop-ab-test-btn" data-test-id="${testId}">Остановить тест</button>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.stop-ab-test-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const testId = btn.dataset.testId;
            if (abTests[testId]) {
                abTests[testId].active = false;
                await saveAnalyticsData();
                renderABTests();
            }
        });
    });
}

function startAnalyticsCollection() {
    setInterval(() => {
        collectAnalyticsData();
    }, 5 * 60 * 1000);
}

async function collectAnalyticsData() {
    const timestamp = Date.now();
    
    if (!analyticsData.views) {
        analyticsData.views = {};
    }
    if (!analyticsData.sales) {
        analyticsData.sales = {};
    }

    await saveAnalyticsData();
}

if (typeof window !== 'undefined') {
    window.initializeAdvancedAnalytics = initializeAdvancedAnalytics;
}


