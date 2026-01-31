let profitCalculatorData = {};
let promotionPlanner = { promotions: [] };

async function initializeAdditionalTools() {
    await loadToolsData();
    setupToolsUI();
}

async function loadToolsData() {
    const data = await chrome.storage.local.get(['fpToolsProfitCalculator', 'fpToolsPromotions']);
    profitCalculatorData = data.fpToolsProfitCalculator || {};
    promotionPlanner = data.fpToolsPromotions || { promotions: [] };
}

async function saveToolsData() {
    await chrome.storage.local.set({
        fpToolsProfitCalculator: profitCalculatorData,
        fpToolsPromotions: promotionPlanner
    });
}

function setupToolsUI() {
    const toolsPage = document.querySelector('.fp-tools-page-content[data-page="tools"]');
    if (!toolsPage) return;

    toolsPage.innerHTML = `
        <h3>Дополнительные инструменты</h3>
        
        <div class="tool-section">
            <h4>Генератор QR-кодов</h4>
            <div class="input-group">
                <input type="text" id="qr-code-input" class="template-input" placeholder="Текст или ссылка для QR-кода">
                <button id="generate-qr-btn" class="btn">Сгенерировать QR</button>
            </div>
            <div id="qr-code-display" style="margin-top: 15px;"></div>
        </div>

        <div class="tool-section">
            <h4>Калькулятор прибыли</h4>
            <div class="profit-calculator">
                <label for="sale-price">Цена продажи (₽):</label>
                <input type="number" id="sale-price" class="template-input" placeholder="0">
                <label for="purchase-price" style="margin-top: 10px;">Цена закупки (₽):</label>
                <input type="number" id="purchase-price" class="template-input" placeholder="0">
                <label for="commission" style="margin-top: 10px;">Комиссия FunPay (%):</label>
                <input type="number" id="commission" class="template-input" value="5" placeholder="5">
                <label for="other-costs" style="margin-top: 10px;">Прочие расходы (₽):</label>
                <input type="number" id="other-costs" class="template-input" value="0" placeholder="0">
                <button id="calculate-profit-btn" class="btn" style="margin-top: 10px;">Рассчитать</button>
                <div id="profit-results" style="margin-top: 15px;"></div>
            </div>
        </div>

        <div class="tool-section">
            <h4>Планировщик акций</h4>
            <button id="add-promotion-btn" class="btn">Добавить акцию</button>
            <div id="promotions-list" style="margin-top: 15px;"></div>
        </div>

        <div class="tool-section">
            <h4>Генератор отчетов</h4>
            <div class="report-generator">
                <label for="report-period">Период отчета:</label>
                <select id="report-period" class="template-input">
                    <option value="week">Неделя</option>
                    <option value="month">Месяц</option>
                    <option value="quarter">Квартал</option>
                    <option value="year">Год</option>
                    <option value="custom">Произвольный</option>
                </select>
                <div id="custom-dates" style="margin-top: 10px; display: none;">
                    <label for="start-date">Начало:</label>
                    <input type="date" id="start-date" class="template-input">
                    <label for="end-date" style="margin-top: 10px;">Конец:</label>
                    <input type="date" id="end-date" class="template-input">
                </div>
                <button id="generate-report-btn" class="btn" style="margin-top: 10px;">Сгенерировать отчет</button>
                <div id="report-results" style="margin-top: 15px;"></div>
            </div>
        </div>
    `;

    setupToolsEventListeners();
    renderPromotions();
}

function setupToolsEventListeners() {
    document.getElementById('generate-qr-btn')?.addEventListener('click', generateQRCode);
    document.getElementById('calculate-profit-btn')?.addEventListener('click', calculateProfit);
    document.getElementById('add-promotion-btn')?.addEventListener('click', showAddPromotionModal);
    document.getElementById('report-period')?.addEventListener('change', (e) => {
        document.getElementById('custom-dates').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    document.getElementById('generate-report-btn')?.addEventListener('click', generateReport);
}

function generateQRCode() {
    const text = document.getElementById('qr-code-input').value.trim();
    if (!text) {
        showNotification('Введите текст или ссылку', true);
        return;
    }

    const display = document.getElementById('qr-code-display');
    if (!display) return;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
    
    display.innerHTML = `
        <div class="qr-code-container">
            <img src="${qrUrl}" alt="QR Code" style="border: 1px solid #ddd; padding: 10px; background: white;">
            <button id="download-qr-btn" class="btn" style="margin-top: 10px;">Скачать QR-код</button>
        </div>
    `;

    document.getElementById('download-qr-btn')?.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = qrUrl;
        a.download = 'qrcode.png';
        a.click();
    });
}

function calculateProfit() {
    const salePrice = parseFloat(document.getElementById('sale-price').value) || 0;
    const purchasePrice = parseFloat(document.getElementById('purchase-price').value) || 0;
    const commission = parseFloat(document.getElementById('commission').value) || 5;
    const otherCosts = parseFloat(document.getElementById('other-costs').value) || 0;

    const commissionAmount = salePrice * (commission / 100);
    const totalCosts = purchasePrice + commissionAmount + otherCosts;
    const profit = salePrice - totalCosts;
    const profitMargin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    const roi = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;

    const results = document.getElementById('profit-results');
    if (!results) return;

    results.innerHTML = `
        <div class="profit-results-card">
            <h5>Результаты расчета</h5>
            <div class="profit-item">
                <span>Выручка:</span>
                <strong>${salePrice.toFixed(2)}₽</strong>
            </div>
            <div class="profit-item">
                <span>Себестоимость:</span>
                <strong>${purchasePrice.toFixed(2)}₽</strong>
            </div>
            <div class="profit-item">
                <span>Комиссия FunPay:</span>
                <strong>${commissionAmount.toFixed(2)}₽</strong>
            </div>
            <div class="profit-item">
                <span>Прочие расходы:</span>
                <strong>${otherCosts.toFixed(2)}₽</strong>
            </div>
            <div class="profit-item profit-total">
                <span>Чистая прибыль:</span>
                <strong style="color: ${profit >= 0 ? '#4CAF50' : '#f44336'}">${profit.toFixed(2)}₽</strong>
            </div>
            <div class="profit-item">
                <span>Маржа прибыли:</span>
                <strong>${profitMargin.toFixed(2)}%</strong>
            </div>
            <div class="profit-item">
                <span>ROI:</span>
                <strong>${roi.toFixed(2)}%</strong>
            </div>
        </div>
    `;

    profitCalculatorData.lastCalculation = {
        salePrice,
        purchasePrice,
        commission,
        otherCosts,
        profit,
        timestamp: Date.now()
    };
    saveToolsData();
}

function showAddPromotionModal() {
    const title = prompt('Название акции:');
    if (!title) return;

    const discount = prompt('Скидка (%):');
    if (!discount) return;

    const startDate = prompt('Дата начала (YYYY-MM-DD):');
    if (!startDate) return;

    const endDate = prompt('Дата окончания (YYYY-MM-DD):');
    if (!endDate) return;

    const lotIds = prompt('ID лотов (через запятую, или "all" для всех):');
    if (!lotIds) return;

    promotionPlanner.promotions.push({
        id: Date.now(),
        title,
        discount: parseFloat(discount),
        startDate,
        endDate,
        lotIds: lotIds === 'all' ? 'all' : lotIds.split(',').map(id => id.trim()),
        active: true
    });

    saveToolsData();
    renderPromotions();
    showNotification('Акция добавлена', false);
}

function renderPromotions() {
    const list = document.getElementById('promotions-list');
    if (!list) return;

    if (promotionPlanner.promotions.length === 0) {
        list.innerHTML = '<p class="template-info">Нет запланированных акций</p>';
        return;
    }

    const now = new Date();
    list.innerHTML = promotionPlanner.promotions.map(promo => {
        const start = new Date(promo.startDate);
        const end = new Date(promo.endDate);
        const status = now < start ? 'Запланирована' : now > end ? 'Завершена' : 'Активна';
        const statusClass = now < start ? 'planned' : now > end ? 'ended' : 'active';

        return `
            <div class="promotion-item">
                <div class="promotion-header">
                    <strong>${promo.title}</strong>
                    <span class="promotion-status ${statusClass}">${status}</span>
                </div>
                <div class="promotion-details">
                    <span>Скидка: ${promo.discount}%</span>
                    <span>Период: ${promo.startDate} - ${promo.endDate}</span>
                    <span>Лоты: ${promo.lotIds === 'all' ? 'Все' : promo.lotIds.length}</span>
                </div>
                <button class="btn btn-small remove-promotion-btn" data-id="${promo.id}">Удалить</button>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.remove-promotion-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            promotionPlanner.promotions = promotionPlanner.promotions.filter(p => p.id !== id);
            await saveToolsData();
            renderPromotions();
        });
    });
}

async function generateReport() {
    const period = document.getElementById('report-period').value;
    const resultsDiv = document.getElementById('report-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="fp-import-loader"></div>';

    try {
        let startDate, endDate;
        
        if (period === 'custom') {
            startDate = new Date(document.getElementById('start-date').value);
            endDate = new Date(document.getElementById('end-date').value);
        } else {
            endDate = new Date();
            startDate = new Date();
            
            switch (period) {
                case 'week':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(endDate.getMonth() - 1);
                    break;
                case 'quarter':
                    startDate.setMonth(endDate.getMonth() - 3);
                    break;
                case 'year':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
            }
        }

        const { fpToolsSalesData } = await chrome.storage.local.get('fpToolsSalesData');
        const sales = Object.values(fpToolsSalesData || {}).filter(order => {
            const orderDate = new Date(order.date);
            return orderDate >= startDate && orderDate <= endDate;
        });

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, order) => sum + (parseFloat(order.price) || 0), 0);
        const avgCheck = totalSales > 0 ? totalRevenue / totalSales : 0;

        const dailySales = {};
        sales.forEach(order => {
            const date = new Date(order.date).toDateString();
            if (!dailySales[date]) {
                dailySales[date] = { count: 0, revenue: 0 };
            }
            dailySales[date].count++;
            dailySales[date].revenue += parseFloat(order.price) || 0;
        });

        resultsDiv.innerHTML = `
            <div class="report-card">
                <h5>Отчет за период: ${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}</h5>
                <div class="report-summary">
                    <div class="report-stat">
                        <strong>Всего продаж:</strong> ${totalSales}
                    </div>
                    <div class="report-stat">
                        <strong>Общая выручка:</strong> ${totalRevenue.toFixed(2)}₽
                    </div>
                    <div class="report-stat">
                        <strong>Средний чек:</strong> ${avgCheck.toFixed(2)}₽
                    </div>
                </div>
                <div class="report-chart">
                    <h6>Продажи по дням:</h6>
                    ${Object.entries(dailySales).map(([date, data]) => `
                        <div class="report-day">
                            <span>${new Date(date).toLocaleDateString('ru-RU')}</span>
                            <span>${data.count} продаж</span>
                            <span>${data.revenue.toFixed(2)}₽</span>
                        </div>
                    `).join('')}
                </div>
                <button id="download-report-btn" class="btn" style="margin-top: 15px;">Скачать отчет (PDF)</button>
            </div>
        `;

        document.getElementById('download-report-btn')?.addEventListener('click', () => {
            downloadReportPDF(startDate, endDate, sales, totalSales, totalRevenue, avgCheck);
        });
    } catch (error) {
        resultsDiv.innerHTML = `<p class="template-info" style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

function downloadReportPDF(startDate, endDate, sales, totalSales, totalRevenue, avgCheck) {
    const reportText = `
ОТЧЕТ О ПРОДАЖАХ FP TOOLS
Период: ${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}

ОБЩАЯ СТАТИСТИКА:
- Всего продаж: ${totalSales}
- Общая выручка: ${totalRevenue.toFixed(2)}₽
- Средний чек: ${avgCheck.toFixed(2)}₽

ДЕТАЛИЗАЦИЯ ПО ДНЯМ:
${Object.entries(sales.reduce((acc, order) => {
    const date = new Date(order.date).toDateString();
    if (!acc[date]) acc[date] = { count: 0, revenue: 0 };
    acc[date].count++;
    acc[date].revenue += parseFloat(order.price) || 0;
    return acc;
}, {})).map(([date, data]) => 
    `${new Date(date).toLocaleDateString('ru-RU')}: ${data.count} продаж, ${data.revenue.toFixed(2)}₽`
).join('\n')}

Сгенерировано: ${new Date().toLocaleString('ru-RU')}
    `;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Отчет скачан', false);
}

if (typeof window !== 'undefined') {
    window.initializeAdditionalTools = initializeAdditionalTools;
}


