// background/autoresponder.js

// Регулярные выражения для определения системных сообщений
const REGEX = {
    ORDER_ID: /#([A-Z0-9]{8})/,
    NEW_FEEDBACK: /написал отзыв к заказу/,
    FEEDBACK_CHANGED: /изменил отзыв к заказу/
};

// --- ФУНКЦИИ-ПОМОЩНИКИ ДЛЯ ОТПРАВКИ ЗАПРОСОВ ---

async function getAuthDetailsForBackground() {
    const goldenKeyCookie = await chrome.cookies.get({ url: 'https://funpay.com', name: 'golden_key' });
    if (!goldenKeyCookie || !goldenKeyCookie.value) {
        console.error("FP Tools: golden_key не найден. Пользователь не авторизован.");
        return {};
    }
    const golden_key = goldenKeyCookie.value;

    try {
        const response = await fetch("https://funpay.com/", { headers: { "cookie": `golden_key=${golden_key}` } });
        if (!response.ok) throw new Error(`Статус ответа: ${response.status}`);
        const text = await response.text();
        const appDataMatch = text.match(/<body[^>]*data-app-data="([^"]+)"/);
        if (appDataMatch && appDataMatch[1]) {
            const appDataString = appDataMatch[1].replace(/&quot;/g, '"');
            const appData = JSON.parse(appDataString);
            const userData = Array.isArray(appData) ? appData[0] : appData;
            if (userData && userData['csrf-token'] && userData.userId) {
                return {
                    golden_key: golden_key,
                    csrf_token: userData['csrf-token'],
                    userId: userData.userId,
                    username: userData.userName,
                };
            }
        }
        throw new Error("Не удалось найти data-app-data в HTML страницы.");
    } catch (e) {
        console.error("FP Tools: Прямой запрос для получения appData провалился.", e.message);
        return { golden_key };
    }
}

async function parseHtmlViaOffscreen(html, action) {
    const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    if (!existingContexts.length) {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['DOM_PARSER'],
            justification: 'Parsing FunPay page HTML',
        });
    }
    return await chrome.runtime.sendMessage({ target: 'offscreen', action, html });
}

async function sendMessage(chatId, text, auth) {
    const payload = {
        objects: JSON.stringify([{ type: "chat_node", id: chatId, tag: "0", data: { node: chatId, last_message: -1, content: "" } }]),
        request: JSON.stringify({ action: "chat_message", data: { node: chatId, content: text } }),
        csrf_token: auth.csrf_token
    };
    const response = await fetch("https://funpay.com/runner/", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest",
            "cookie": `golden_key=${auth.golden_key}`
        },
        body: new URLSearchParams(payload)
    });
    if (!response.ok) throw new Error(`Ошибка отправки сообщения: ${response.status}`);
    console.log(`FP Tools: Сообщение отправлено в чат ${chatId}`);
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ
async function sendReviewReply(orderId, text, auth) {
    const payload = new URLSearchParams({
        orderId: orderId,
        text: text,
        rating: 5, // Для ответа это поле не важно, но его нужно отправить
        authorId: auth.userId, // <-- ДОБАВЛЕНО ID АВТОРА
        csrf_token: auth.csrf_token
    });
    const response = await fetch("https://funpay.com/orders/review", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest",
            "cookie": `golden_key=${auth.golden_key}`
        },
        body: payload
    });
    if (!response.ok) throw new Error(`Ошибка ответа на отзыв: ${response.status}`);
    console.log(`FP Tools: Отправлен ответ на отзыв к заказу ${orderId}`);
}


// --- ОСНОВНЫЕ ЛОГИЧЕСКИЕ ФУНКЦИИ ---

async function handleGreeting(messageData, auth, settings) {
    if (!settings.greetingEnabled || !settings.greetingText) return;

    let greetedUsers = settings.greetedUsers || [];
    if (greetedUsers.includes(messageData.chatId)) return; // Уже здоровались

    let greeting = settings.greetingText.replace(/{buyername}/g, messageData.buyerName);
    
    try {
        await sendMessage(messageData.chatId, greeting, auth);
        greetedUsers.push(messageData.chatId);
        settings.greetedUsers = greetedUsers;
        await chrome.storage.local.set({ fpToolsAutoReplies: settings });
    } catch (e) {
        console.error("FP Tools: Ошибка отправки приветствия:", e);
    }
}

async function handleKeywords(messageData, auth, settings) {
    if (!settings.keywordsEnabled || !settings.keywords || settings.keywords.length === 0) return;

    const lowerCaseMessage = messageData.messageText.toLowerCase();
    
    for (const rule of settings.keywords) {
        if (lowerCaseMessage === rule.keyword.toLowerCase()) {
            let responseText = rule.response.replace(/{buyername}/g, messageData.buyerName);
            try {
                await sendMessage(messageData.chatId, responseText, auth);
                return; // Отправляем только один ответ
            } catch (e) {
                console.error("FP Tools: Ошибка отправки ответа по ключу:", e);
            }
        }
    }
}

async function handleReview(messageData, auth, settings) {
    if (!settings.autoReviewEnabled) return;

    if (!REGEX.NEW_FEEDBACK.test(messageData.messageText) && !REGEX.FEEDBACK_CHANGED.test(messageData.messageText)) {
        return;
    }

    const orderIdMatch = messageData.messageText.match(REGEX.ORDER_ID);
    if (!orderIdMatch) return;
    const orderId = orderIdMatch[1]; // <-- ИСПРАВЛЕНО: [1] чтобы получить чистый ID без #

    try {
        const orderPageResponse = await fetch(`https://funpay.com/orders/${orderId}/`, {
            headers: { "cookie": `golden_key=${auth.golden_key}` }
        });
        if (!orderPageResponse.ok) throw new Error("Не удалось загрузить страницу заказа.");
        
        const orderPageHtml = await orderPageResponse.text();
        const stars = await parseHtmlViaOffscreen(orderPageHtml, 'parseOrderPageForReview');

        if (stars && settings.reviewTemplates && settings.reviewTemplates[stars]) {
            const replyText = settings.reviewTemplates[stars];
            if (replyText.trim()) { // Проверяем, что шаблон не пустой
                await sendReviewReply(orderId, replyText, auth);
            }
        }
    } catch (e) {
        console.error(`FP Tools: Ошибка при обработке отзыва для заказа #${orderId}:`, e);
    }
}

// --- ГЛАВНЫЙ ЦИКЛ (АНАЛОГ RUNNER) ---
let lastRunnerTag = null;

export async function runAutoResponderCycle() {
    console.log("FP Tools: Запуск цикла автоответчика...");
    
    const { fpToolsAutoReplies = {} } = await chrome.storage.local.get('fpToolsAutoReplies');
    const isAnyFeatureEnabled = fpToolsAutoReplies.greetingEnabled || fpToolsAutoReplies.keywordsEnabled || fpToolsAutoReplies.autoReviewEnabled;
    
    if (!isAnyFeatureEnabled) {
        // console.log("FP Tools: Все функции автоответчика отключены. Цикл пропущен.");
        return;
    }

    const auth = await getAuthDetailsForBackground();
    if (!auth.golden_key || !auth.csrf_token || !auth.userId) {
        console.error("FP Tools: Нет данных авторизации для цикла автоответчика.");
        return;
    }

    try {
        const runnerPayload = {
            objects: JSON.stringify([{
                type: "chat_bookmarks",
                id: auth.userId,
                tag: lastRunnerTag || "0",
                data: false
            }]),
            request: false,
            csrf_token: auth.csrf_token
        };

        const response = await fetch("https://funpay.com/runner/", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "cookie": `golden_key=${auth.golden_key}`
            },
            body: new URLSearchParams(runnerPayload)
        });

        if (!response.ok) throw new Error(`Runner-запрос провалился: ${response.status}`);

        const data = await response.json();
        const chatObject = data.objects.find(o => o.type === "chat_bookmarks");

        if (!chatObject || !chatObject.data || !chatObject.data.html) {
            // console.log("FP Tools: Нет обновлений в чатах.");
            if(chatObject) lastRunnerTag = chatObject.tag;
            return;
        }

        lastRunnerTag = chatObject.tag;
        const parsedChats = await parseHtmlViaOffscreen(chatObject.data.html, 'parseChatList');
        
        let processedMessageIds = fpToolsAutoReplies.processedMessageIds || [];
        
        for (const chat of parsedChats) {
            // Пропускаем, если сообщение не новое/непрочитанное или уже обработано
            if (!chat.isUnread || processedMessageIds.includes(chat.msgId)) {
                continue;
            }

            const messageData = {
                chatId: chat.chatId,
                messageId: chat.msgId,
                messageText: chat.messageText,
                buyerName: chat.chatName
            };

            // Запускаем обработчики
            await handleGreeting(messageData, auth, fpToolsAutoReplies);
            await handleKeywords(messageData, auth, fpToolsAutoReplies);
            await handleReview(messageData, auth, fpToolsAutoReplies);

            // Помечаем сообщение как обработанное
            processedMessageIds.push(chat.msgId);
        }

        // Очищаем старые ID, чтобы не засорять хранилище
        if (processedMessageIds.length > 200) {
            processedMessageIds = processedMessageIds.slice(-200);
        }
        fpToolsAutoReplies.processedMessageIds = processedMessageIds;
        await chrome.storage.local.set({ fpToolsAutoReplies });

    } catch (e) {
        console.error(`FP Tools: Ошибка в цикле автоответчика: ${e.message}`);
    }
}