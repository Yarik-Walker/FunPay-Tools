// offscreen/offscreen.js

// --- КОД ДЛЯ СТАТИСТИКИ ---

const RUSSIAN_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function parseFunPayDate(dateString) {
    const now = new Date();
    let year = now.getFullYear();
    const normalizedDate = dateString.trim().toLowerCase().replace(/\s+/g, ' ');
    let day, monthIndex, hours, minutes;
    let match = normalizedDate.match(/(\d{1,2})\s(.+?)\s(\d{4}),\s(\d{1,2}):(\d{2})/);
    if (match) {
        day = parseInt(match[1], 10);
        monthIndex = RUSSIAN_MONTHS.indexOf(match[2]);
        year = parseInt(match[3], 10);
        hours = parseInt(match[4], 10);
        minutes = parseInt(match[5], 10);
    } else {
        match = normalizedDate.match(/(\d{1,2})\s(.+?),\s(\d{1,2}):(\d{2})/);
        if (match) {
            day = parseInt(match[1], 10);
            monthIndex = RUSSIAN_MONTHS.indexOf(match[2]);
            hours = parseInt(match[3], 10);
            minutes = parseInt(match[4], 10);
        } else if (normalizedDate.startsWith("сегодня,")) {
            match = normalizedDate.match(/сегодня,\s(\d{1,2}):(\d{2})/);
            day = now.getDate();
            monthIndex = now.getMonth();
            hours = parseInt(match[1], 10);
            minutes = parseInt(match[2], 10);
        } else if (normalizedDate.startsWith("вчера,")) {
             match = normalizedDate.match(/вчера,\s(\d{1,2}):(\d{2})/);
             const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
             day = yesterday.getDate();
             monthIndex = yesterday.getMonth();
             year = yesterday.getFullYear();
             hours = parseInt(match[1], 10);
             minutes = parseInt(match[2], 10);
        } else {
            console.warn("Неизвестный формат даты:", dateString);
            return Date.now();
        }
    }
    if (monthIndex === -1) {
        console.warn("Не удалось распознать месяц:", dateString);
        return Date.now();
    }
    return new Date(Date.UTC(year, monthIndex, day, hours, minutes)).getTime();
}

function parseSalesPage(html) {
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const continueInput = doc.querySelector("input[type='hidden'][name='continue']");
        const nextOrderId = continueInput ? continueInput.value : null;
        const orderRows = doc.querySelectorAll("a.tc-item");
        if (!orderRows || orderRows.length === 0) {
            return { nextOrderId: null, orders: [] };
        }
        const orders = [];
        orderRows.forEach(row => {
            try {
                const classList = row.classList;
                let orderStatus;
                if (classList.contains("warning")) orderStatus = "refunded";
                else if (classList.contains("info")) orderStatus = "paid";
                else orderStatus = "closed";
                const orderId = row.querySelector(".tc-order")?.textContent?.substring(1);
                if (!orderId) return;
                const description = row.querySelector(".order-desc div")?.textContent.trim() || "";
                const subcategoryName = row.querySelector(".text-muted")?.textContent.trim() || "";
                const priceText = row.querySelector(".tc-price")?.textContent || "";
                const priceRaw = priceText.replace(/\s/g, "");
                const price = parseFloat(priceRaw) || 0;
                let currency = "UNKNOWN";
                if (priceText.includes("₽")) currency = "RUB";
                else if (priceText.includes("$")) currency = "USD";
                else if (priceText.includes("€")) currency = "EUR";
                const buyerEl = row.querySelector(".media-user-name span");
                const buyerUsername = buyerEl?.textContent.trim() || "";
                const buyerHref = buyerEl?.getAttribute("data-href")?.split("/");
                const buyerId = buyerHref ? parseInt(buyerHref[buyerHref.length - 2] || "0", 10) : 0;
                const orderDateText = row.querySelector(".tc-date-time")?.textContent.trim() || "";
                const orderDate = parseFunPayDate(orderDateText);
                orders.push({ orderId, description, subcategoryName, price, currency, buyerUsername, buyerId, orderStatus, orderDate, orderDateText });
            } catch (e) {
                console.error("FP Tools Offscreen: Ошибка при парсинге одного заказа:", e, row);
            }
        });
        return { nextOrderId, orders };
    } catch (e) {
        console.error("FP Tools Offscreen: Глобальная ошибка парсинга страницы продаж:", e);
        return { nextOrderId: null, orders: [] };
    }
}

function parseLotEditPage(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const form = doc.querySelector('form.form-offer-editor');
        if (!form) {
            throw new Error('Форма редактирования лота не найдена на странице.');
        }

        const formData = new FormData(form);
        const dataObject = {};
        
        for (const [key, value] of formData.entries()) {
            dataObject[key] = value;
        }

        delete dataObject.csrf_token;
        delete dataObject.location;

        return dataObject;
    } catch (e) {
        console.error("FP Tools Offscreen: Error in parseLotEditPage", e);
        return null;
    }
}

function parseChatList(html) {
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const chatItems = doc.querySelectorAll('a.contact-item');
        return Array.from(chatItems).map(item => {
            const nameEl = item.querySelector('.media-user-name');
            const avatarEl = item.querySelector('.avatar-photo');
            return {
                chatId: item.dataset.id,
                chatName: nameEl ? nameEl.textContent.trim() : 'Unknown',
                msgId: item.dataset.nodeMsg,
                messageText: item.querySelector('.contact-item-message')?.textContent.trim() || '',
                isUnread: item.classList.contains('unread'),
                avatarUrl: avatarEl ? avatarEl.style.backgroundImage.slice(5, -2) : null
            };
        });
    } catch (e) {
        console.error("FP Tools Offscreen: Error parsing chat list.", e);
        return [];
    }
}

function parseUserLotsList(html) {
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const allLots = [];
        const lotRows = doc.querySelectorAll("a.tc-item");

        lotRows.forEach(row => {
            const offerBlock = row.closest('.offer');
            if (!offerBlock) return;
            const categoryLink = offerBlock.querySelector('.offer-list-title a');
            const categoryName = categoryLink?.textContent.trim() || "Без категории";
            const nodeIdMatch = categoryLink?.getAttribute('href')?.match(/\/(?:lots|chips)\/(\d+)/);
            const nodeId = nodeIdMatch ? nodeIdMatch[1] : null;

            if (!nodeId) return;

            const title = row.querySelector(".tc-desc-text")?.textContent?.trim() || "Без названия";
            const idMatch = row.getAttribute('href')?.match(/(?:offer=|id=)(\d+)/);
            const id = idMatch ? idMatch[1] : null;

            if (id) {
                allLots.push({ id, title, nodeId, categoryName });
            }
        });
        
        return allLots;
    } catch (e) {
        console.error("FP Tools Offscreen: Error in parseUserLotsList", e);
        return [];
    }
}

function parseGameSearchResults(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.promo-game-item');
        return Array.from(items).map(item => {
            const link = item.querySelector('.game-title a');
            const img = item.querySelector('img');
            return {
                name: link ? link.textContent.trim() : 'Unknown',
                url: link ? link.href : '#',
                img: img ? img.src : ''
            };
        });
    } catch (e) {
        return [];
    }
}

function parseCategoryPage(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.counter-item');
        return Array.from(items).map(item => {
            const url = item.href;
            const nodeIdMatch = url.match(/\/lots\/(\d+)/);
            return {
                name: item.querySelector('.counter-param')?.textContent.trim() || 'Unknown',
                count: item.querySelector('.counter-value')?.textContent.trim() || '0',
                url: url,
                nodeId: nodeIdMatch ? nodeIdMatch[1] : null
            };
        });
    } catch (e) {
        return [];
    }
}

function parseLotListPage(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('a.tc-item');
        return Array.from(items).map(item => {
            const offerIdMatch = item.getAttribute('href')?.match(/id=(\d+)/);
            return {
                offerId: offerIdMatch ? offerIdMatch[1] : null,
                description: item.querySelector('.tc-desc-text')?.textContent.trim() || 'No description',
                seller: item.querySelector('.media-user-name span')?.textContent.trim() || 'Unknown',
                price: item.querySelector('.tc-price div')?.textContent.trim() || 'N/A'
            };
        });
    } catch (e) {
        return [];
    }
}

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ---
function parseUserCategories(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const categories = [];
        const offerBlocks = doc.querySelectorAll('.offer');
        
        offerBlocks.forEach(block => {
            // Ищем правильную ссылку для поднятия (`.../trade`)
            const managementLink = block.querySelector('a.btn-plus');
            // Ищем ссылку с названием для отображения
            const titleLink = block.querySelector('.offer-list-title h3 a');

            if (managementLink && titleLink) {
                const name = titleLink.textContent.trim();
                const url = new URL(managementLink.href, 'https://funpay.com/');
                
                // Проверяем наличие иконки автовыдачи ВНУТРИ этого блока `.offer`
                const categoryHasAutoDelivery = !!block.querySelector('i.auto-dlv-icon');

                const lotItems = block.querySelectorAll('.tc-item');
                const lots = Array.from(lotItems).map(item => {
                    const idMatch = item.getAttribute('href')?.match(/id=(\d+)/);
                    // Для nodeId используем ссылку на категорию, а не на управление
                    const publicUrl = new URL(titleLink.href, 'https://funpay.com/');
                    const nodeIdMatch = publicUrl.pathname.match(/\/lots\/(\d+)/);
                    return {
                        id: idMatch ? idMatch[1] : null,
                        nodeId: nodeIdMatch ? nodeIdMatch[1] : null,
                        title: item.querySelector('.tc-desc-text')?.textContent.trim() || 'Без названия'
                    };
                }).filter(lot => lot.id && lot.nodeId);
                
                // Сохраняем pathname от `managementLink` как ID
                categories.push({ id: url.pathname, name: name, lots: lots, hasAutoDelivery: categoryHasAutoDelivery });
            }
        });
        return categories;
    } catch (e) {
        console.error("FP Tools Offscreen: Error in parseUserCategories", e);
        return [];
    }
}
// --- КОНЕЦ ИСПРАВЛЕНИЯ ---

function parseOrderPageForReview(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const reviewAuthorLink = doc.querySelector('.review-item-head .media-user-name a');
        const reviewAuthorId = reviewAuthorLink ? reviewAuthorLink.href.split('/').filter(Boolean).pop() : null;

        const currentUserLink = doc.querySelector('.user-link-dropdown');
        const currentUserId = currentUserLink ? currentUserLink.href.split('/').filter(Boolean).pop() : null;

        if (reviewAuthorId && currentUserId && reviewAuthorId === currentUserId) {
            return null;
        }
        
        const ratingDiv = doc.querySelector('.order-review .rating > div');
        if (!ratingDiv) return null;
        
        const ratingClass = Array.from(ratingDiv.classList).find(c => c.startsWith('rating'));
        if (!ratingClass) return null;

        const stars = parseInt(ratingClass.replace('rating', ''), 10);
        return isNaN(stars) ? null : stars;
    } catch (e) {
        console.error("FP Tools Offscreen: Error in parseOrderPageForReview", e);
        return null;
    }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return true;
    
    switch (message.action) {
        case 'parseSalesPage':
            sendResponse(parseSalesPage(message.html));
            break;
        case 'parseLotEditPage':
            sendResponse(parseLotEditPage(message.html));
            break;
        case 'parseChatList':
            sendResponse(parseChatList(message.html));
            break;
        case 'parseUserLotsList':
            sendResponse(parseUserLotsList(message.html));
            break;
        case 'parseGameSearchResults':
            sendResponse(parseGameSearchResults(message.html));
            break;
        case 'parseCategoryPage':
            sendResponse(parseCategoryPage(message.html));
            break;
        case 'parseLotListPage':
            sendResponse(parseLotListPage(message.html));
            break;
        case 'parseUserCategories':
            sendResponse(parseUserCategories(message.html));
            break;
        case 'parseOrderPageForReview':
            sendResponse(parseOrderPageForReview(message.html));
            break;
    }

    return true; 
});