// C:\Users\AlliSighs\Desktop\◘FUNPAY ◘\FunPay Tools 2.6\content\features\fpt_identifier.js

function initializeFPTIdentifier() {
    'use strict';

    // Запускаем скрипт только на страницах чата
    if (!window.location.pathname.startsWith('/chat/')) {
        return;
    }

    const FPT_SIGNATURE = '\u200B\u200D\u200C'; // Невидимая подпись
    const FPT_LABEL_CLASS = 'fpt-status-label';
    const identifiedUsers = new Set();
    let currentChatUserId = null;
    let lastSeenAuthorId = null; // "Память" о последнем авторе для сообщений без "головы"

    /**
     * Добавляет необходимые стили на страницу.
     */
    function addIdentifierStyles() {
        const styleId = 'fpt-identifier-styles';
        if (document.getElementById(styleId)) return; // Не добавлять стили повторно

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .${FPT_LABEL_CLASS} {
                color: #8a2be2;
                font-weight: 600;
                margin-left: 5px;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Извлекает ID пользователя из URL его профиля.
     * @param {string} url - URL профиля.
     * @returns {string|null} ID пользователя или null.
     */
    function getUserIdFromUrl(url) {
        if (!url) return null;
        const match = url.match(/users\/(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Обновляет статус "FunPay Tools" в шапке чата для текущего собеседника.
     */
    function updateHeaderStatus() {
        const header = document.querySelector('.chat-header');
        if (!header) return;
        const statusElement = header.querySelector('.media-user-status');
        const userLink = header.querySelector('.media-user-name a');
        if (!statusElement || !userLink) return;

        // Удаляем старую метку, если она есть
        const existingLabel = statusElement.querySelector(`.${FPT_LABEL_CLASS}`);
        if (existingLabel) existingLabel.remove();

        const userIdInHeader = getUserIdFromUrl(userLink.href);
        currentChatUserId = userIdInHeader;

        // Если пользователь опознан, добавляем новую метку
        if (userIdInHeader && identifiedUsers.has(userIdInHeader)) {
            const label = document.createElement('span');
            label.className = FPT_LABEL_CLASS;
            label.innerHTML = '&middot; FunPay Tools';
            statusElement.appendChild(label);
        }
    }

    /**
     * "Умная" обработка сообщения для определения автора и поиска подписи.
     * @param {HTMLElement} messageNode - DOM-элемент сообщения.
     */
    function processMessage(messageNode) {
        let authorId = null;
        // Если у сообщения есть "голова", это новый автор (или первый в серии).
        if (messageNode.classList.contains('chat-msg-with-head')) {
            const authorLink = messageNode.querySelector('.chat-msg-author-link');
            if (authorLink) {
                authorId = getUserIdFromUrl(authorLink.href);
                lastSeenAuthorId = authorId; // Запоминаем его
            }
        } else {
            // Если "головы" нет, автор - тот же, что и у предыдущего сообщения.
            authorId = lastSeenAuthorId;
        }

        if (!authorId) return;

        const textElement = messageNode.querySelector('.chat-msg-text');
        if (textElement && textElement.textContent.includes(FPT_SIGNATURE)) {
            if (!identifiedUsers.has(authorId)) {
                identifiedUsers.add(authorId);
                // Если мы опознали пользователя, с которым открыт чат, обновляем шапку.
                if (authorId === currentChatUserId) {
                    updateHeaderStatus();
                }
            }
        }
    }

    /**
     * Основная функция инициализации логики.
     */
    async function initializeLogic() {
        addIdentifierStyles();
        
        // Инжектор подписи в исходящие сообщения
        const form = await waitForElement('.chat-form form');
        const textarea = form.querySelector('textarea[name="content"]');
        const sendButton = form.querySelector('button[type="submit"]');
        if (textarea && sendButton) {
            const injectSignature = () => {
                if (textarea.value && !textarea.value.endsWith(FPT_SIGNATURE)) {
                    textarea.value += FPT_SIGNATURE;
                }
            };
            sendButton.addEventListener('click', injectSignature, true);
            textarea.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) injectSignature();
            }, true);
        }

        const chatContainer = await waitForElement('.chat.chat-float');

        // Первичный скан всех видимых сообщений
        chatContainer.querySelectorAll('.chat-msg-item').forEach(processMessage);
        updateHeaderStatus();

        // Наблюдатель за новыми сообщениями и сменой чата
        const observer = new MutationObserver(() => {
            const headerUserLink = document.querySelector('.chat-header .media-user-name a');
            const newUserId = headerUserLink ? getUserIdFromUrl(headerUserLink.href) : null;

            // Если сменили чат, сбрасываем "память" и пересканируем
            if (newUserId !== currentChatUserId) {
                lastSeenAuthorId = null;
                chatContainer.querySelectorAll('.chat-msg-item').forEach(processMessage);
                updateHeaderStatus();
            }

            // Обрабатываем только новые, еще не обработанные сообщения
            chatContainer.querySelectorAll('.chat-msg-item:not(.fpt-processed)').forEach(node => {
                node.classList.add('fpt-processed');
                processMessage(node);
            });
        });

        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('FunPay Tools Identifier: Скрипт запущен.');
    }

    /**
     * Утилита для ожидания появления элемента на странице.
     * @param {string} selector - CSS-селектор элемента.
     * @returns {Promise<HTMLElement>}
     */
    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }
            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    initializeLogic();
}