// content/features/lot_cloning.js

// --- НОВЫЙ БЛОК: Логика для копирования данных с публичной страницы лота ---
const COPIED_LOT_STORAGE_KEY = 'fpToolsCopiedLotData';

async function handlePublicLotCopy() {
    const copyButton = document.getElementById('fp-tools-public-clone-btn');
    if (!copyButton) return;

    copyButton.disabled = true;
    copyButton.textContent = 'Копирование...';

    try {
        const offerId = new URLSearchParams(window.location.search).get('id');
        if (!offerId) {
            throw new Error('Не удалось найти ID лота на странице.');
        }
        
        // Используем улучшенную функцию парсинга
        const lotData = await fetchPublicLotDataForImport(offerId);

        if (!lotData.summary && !lotData.description) {
            throw new Error('Не удалось скопировать данные. Возможно, структура страницы изменилась.');
        }
        
        // Сохраняем данные в хранилище расширения
        await chrome.storage.local.set({
            [COPIED_LOT_STORAGE_KEY]: {
                summary: lotData.summary,
                description: lotData.description,
                timestamp: Date.now()
            }
        });

        showNotification('Лот скопирован! Теперь создайте новый лот в нужной категории, и вам будет предложено вставить данные.', false);

    } catch (error) {
        showNotification(`Ошибка копирования: ${error.message}`, true);
        console.error('FP Tools Public Lot Copy Error:', error);
    } finally {
        copyButton.disabled = false;
        copyButton.textContent = 'Копировать лот';
    }
}

// --- НОВЫЙ БЛОК: Проверка и вставка скопированных данных через панель ---
async function checkForCopiedLotData() {
    const isEditPage = window.location.pathname.includes('/lots/offerEdit');
    const isAddPage = window.location.pathname.includes('/lots/offer/add');

    if (!isEditPage && !isAddPage) {
        return;
    }

    const result = await chrome.storage.local.get(COPIED_LOT_STORAGE_KEY);
    const copiedData = result[COPIED_LOT_STORAGE_KEY];

    // Если данных нет или они старше 10 минут, ничего не делаем и чистим хранилище
    if (!copiedData || (Date.now() - copiedData.timestamp > 10 * 60 * 1000)) {
        await chrome.storage.local.remove(COPIED_LOT_STORAGE_KEY);
        return;
    }

    // Создаем панель-уведомление
    const pasteBar = createElement('div', { id: 'fp-tools-paste-bar' });
    pasteBar.innerHTML = `
        <span class="paste-bar-icon">📋</span>
        <span class="paste-bar-text">Найдены скопированные данные лота. Вставить их в форму?</span>
        <div class="paste-bar-actions">
            <button id="paste-lot-data-btn" class="btn btn-sm btn-primary">Вставить</button>
            <button id="decline-paste-btn" class="btn btn-sm btn-default">&times;</button>
        </div>
    `;
    
    const header = document.querySelector('h1.page-header');
    if (header) {
        header.insertAdjacentElement('afterend', pasteBar);
    }

    // Обработчик кнопки "Вставить"
    document.getElementById('paste-lot-data-btn').addEventListener('click', () => {
        const summaryInput = document.querySelector('input[name="fields[summary][ru]"]');
        const descTextarea = document.querySelector('textarea[name="fields[desc][ru]"]');

        if (summaryInput && copiedData.summary) {
            summaryInput.value = copiedData.summary;
            summaryInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (descTextarea && copiedData.description) {
            descTextarea.value = copiedData.description;
            descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        showNotification('Данные вставлены!', false);
        chrome.storage.local.remove(COPIED_LOT_STORAGE_KEY);
        pasteBar.remove();
    });

    // Обработчик кнопки "Отклонить"
    document.getElementById('decline-paste-btn').addEventListener('click', () => {
        chrome.storage.local.remove(COPIED_LOT_STORAGE_KEY);
        pasteBar.remove();
    });
}


// --- Остальной код файла остается без изменений ---

async function submitForm(formData) {
    const nodeId = new URLSearchParams(window.location.search).get('node');
    formData.set('node_id', nodeId); formData.set('offer_id', '0');
    try {
        const response = await fetch('https://funpay.com/lots/offerSave', { method: 'POST', body: new URLSearchParams(formData) });
        if (response.ok) showNotification('Лот успешно продублирован!');
        else { console.error('Ошибка при копировании лота', response); showNotification('Ошибка при копировании лота', true); }
    } catch (error) { console.error('Ошибка при выполнении запроса', error); showNotification('Ошибка при выполнении запроса', true); }
}

async function fetchLotDataForImport(nodeId, offerId) {
    if (!nodeId || !offerId) {
        throw new Error('Не найден ID лота или категории.');
    }
    const editUrl = `https://funpay.com/lots/offerEdit?node=${nodeId}&offer=${offerId}&location=offer`;
    const response = await fetch(editUrl);
    if (!response.ok) {
        throw new Error(`Ошибка сети: ${response.status}`);
    }
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const getValue = (selector) => doc.querySelector(selector)?.value || '';
        
    return {
        summary: {
            ru: getValue('input[name="fields[summary][ru]"]'),
            en: getValue('input[name="fields[summary][en]"]')
        },
        desc: {
            ru: getValue('textarea[name="fields[desc][ru]"]'),
            en: getValue('textarea[name="fields[desc][en]"]')
        },
        payment_msg: {
            ru: getValue('textarea[name="fields[payment_msg][ru]"]'),
            en: getValue('textarea[name="fields[payment_msg][en]"]')
        },
        secrets: getValue('textarea[name="secrets"]')
    };
}

// --- ИЗМЕНЕННАЯ ФУНКЦИЯ (улучшенная для поддержки разных языков) ---
async function fetchPublicLotDataForImport(offerId) {
    if (!offerId) {
        throw new Error('Не найден ID лота.');
    }
    const publicUrl = `${window.location.origin}/lots/offer?id=${offerId}`;
    const response = await fetch(publicUrl);
    if (!response.ok) {
        throw new Error(`Ошибка сети при загрузке лота: ${response.status}`);
    }
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    let summary = '';
    let description = '';

    // Массивы возможных названий заголовков на разных языках
    const summaryHeaders = ['Краткое описание', 'Short description'];
    const descriptionHeaders = ['Подробное описание', 'Detailed description'];

    const headers = doc.querySelectorAll('.param-list .param-item h5');
    
    headers.forEach(header => {
        const headerText = header.textContent.trim();
        const contentDiv = header.nextElementSibling;
        
        if (contentDiv) {
            if (summaryHeaders.includes(headerText)) {
                summary = contentDiv.textContent.trim();
            } else if (descriptionHeaders.includes(headerText)) {
                // Преобразуем <br> в переносы строк для textarea
                description = contentDiv.innerHTML.trim().replace(/<br\s*\/?>/gi, "\n");
            }
        }
    });
    
    return { summary, description };
}


function initializeLotCloning() {
    // --- НОВЫЙ БЛОК: Проверяем, есть ли скопированные данные для вставки ---
    checkForCopiedLotData();
    // --- КОНЕЦ НОВОГО БЛОКА ---

    const header = Array.from(document.querySelectorAll('h1.page-header.page-header-no-hr')).find(h1 => h1.textContent.includes('Редактирование предложения') || h1.textContent.includes('Добавление предложения'));
    if (!header) return;

    let actionsContainer = document.querySelector('.fp-tools-lot-edit-actions-container');
    if (!actionsContainer) {
        actionsContainer = createElement('div', { class: 'fp-tools-lot-edit-actions-container' });
        header.parentNode.insertBefore(actionsContainer, header.nextSibling);
    }
    
    if (!document.querySelector('.fp-tools-clone-btn')) {
        const cloneButton = createElement('button', { class: 'btn btn-default fp-tools-clone-btn' }, {}, 'Копировать');
        actionsContainer.appendChild(cloneButton);

        const popupMenu = createElement('div', { class: 'fp-clone-popup' }, {}, `
            <h3>Клонирование лота</h3>
            <button id="fullClone">Скопировать полностью</button>
            <button id="changeCategoryClone">Поменять категорию и скопировать</button>
            <button id="closePopup" class="btn-default-custom" style="margin-top: 15px;">Закрыть</button>`);
        document.body.appendChild(popupMenu);

        cloneButton.addEventListener('click', () => { popupMenu.classList.add('active'); });

        document.getElementById('fullClone')?.addEventListener('click', () => {
            popupMenu.classList.remove('active');
            const form = document.querySelector('form.form-offer-editor');
            if (!form) { showNotification('Форма редактирования лота не найдена!', true); return; }
            submitForm(new FormData(form));
        });

        document.getElementById('changeCategoryClone')?.addEventListener('click', () => {
            popupMenu.classList.remove('active');
            const selects = document.querySelectorAll('select.form-control.lot-field-input, select.form-control[name="server_id"]');
            const categoryData = {};
            selects.forEach(select => {
                const labelElement = select.closest('.form-group')?.querySelector('label');
                const label = labelElement ? labelElement.textContent.trim().replace('*', '') : (select.name === 'server_id' ? 'Сервер' : 'Категория');
                if (!categoryData[label]) categoryData[label] = { name: select.name, options: [] };
                select.querySelectorAll('option').forEach(option => { if(option.value) categoryData[label].options.push({ value: option.value, text: option.textContent.trim() }); });
            });

            const existingMenu = document.querySelector('.fp-category-clone-popup');
            if(existingMenu) existingMenu.remove();

            const categoryMenu = createElement('div', { class: 'fp-category-clone-popup' });
            let htmlContent = '<h4>Выберите категории для дублирования</h4>';
            for (const label in categoryData) {
                if (categoryData[label].options.length === 0) continue;
                htmlContent += `<div class="category-group">
                                  <label><input type="checkbox" class="category-select-all" data-target="${categoryData[label].name}Select"> ${label} (Выбрать все)</label>`;
                htmlContent += `<select id="${categoryData[label].name}Select" name="${categoryData[label].name}" multiple>`;
                categoryData[label].options.forEach(option => { htmlContent += `<option value="${option.value}">${option.text}</option>`; });
                htmlContent += `</select></div>`;
            }
            htmlContent += `<div id="cloneWarning"></div>`;
            htmlContent += `<div class="actions-bar">
                                <button id="copyWithCategory">Копировать выбранные</button>
                                <button id="closeCategoryMenu" class="btn-default-custom">Закрыть</button>
                            </div>`;
            categoryMenu.innerHTML = htmlContent;
            document.body.appendChild(categoryMenu);
            categoryMenu.classList.add('active');

            function updateCloneWarningState(catMenu) {
                const warningDiv = catMenu.querySelector('#cloneWarning');
                const copyBtn = catMenu.querySelector('#copyWithCategory');
                if (!warningDiv || !copyBtn) return;
                let numCombinations = 1; let hasFieldsWithSelections = false;
                catMenu.querySelectorAll('select[multiple]').forEach(select => {
                    const selectedCount = select.selectedOptions.length;
                    if (selectedCount > 0) { numCombinations *= selectedCount; hasFieldsWithSelections = true; }
                });
                copyBtn.disabled = !hasFieldsWithSelections;
                if (!hasFieldsWithSelections) {
                    warningDiv.textContent = 'Выберите хотя бы одну опцию для создания копий.';
                    warningDiv.style.display = 'block'; copyBtn.textContent = "Копировать";
                } else if (numCombinations > 0) {
                    warningDiv.textContent = `Будет создано ${numCombinations} копий лота.`;
                    warningDiv.style.display = 'block'; copyBtn.textContent = `Копировать (${numCombinations})`;
                } else { warningDiv.style.display = 'none'; copyBtn.textContent = "Копировать"; }
            }

            updateCloneWarningState(categoryMenu);
            categoryMenu.querySelectorAll('.category-select-all, select[multiple]').forEach(el => el.addEventListener('change', () => updateCloneWarningState(categoryMenu)));
            categoryMenu.querySelectorAll('.category-select-all').forEach(checkbox => {
                checkbox.addEventListener('change', (event) => {
                    const select = categoryMenu.querySelector(`#${event.target.dataset.target}`);
                    if (select) Array.from(select.options).forEach(option => option.selected = event.target.checked);
                    updateCloneWarningState(categoryMenu);
                });
            });

            document.getElementById('copyWithCategory')?.addEventListener('click', async () => {
                const form = document.querySelector('form.form-offer-editor');
                if (!form) { showNotification('Форма редактирования лота не найдена!', true); return; }
                const baseFormData = new FormData(form); let combinations = [{}]; let hasCategorySelections = false;
                for (const label in categoryData) {
                    const selectName = categoryData[label].name;
                    const selectElement = categoryMenu.querySelector(`select[name="${selectName}"]`);
                    if (!selectElement) continue;
                    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);
                    if (selectedOptions.length > 0) {
                        hasCategorySelections = true; const newCombinations = [];
                        combinations.forEach(existingCombo => { selectedOptions.forEach(optionValue => { newCombinations.push({ ...existingCombo, [selectName]: optionValue }); }); });
                        combinations = newCombinations;
                    }
                }
                if (!hasCategorySelections) { showNotification('Не выбрано ни одной категории для копирования.', true); return; }
                categoryMenu.classList.remove('active');
                setTimeout(() => { if (document.body.contains(categoryMenu)) document.body.removeChild(categoryMenu); }, 500);
                showNotification(`Начинается копирование ${combinations.length} лотов...`, false);
                let count = 0;
                for (const combo of combinations) {
                    count++; const clonedFormData = new FormData();
                    for (const [key, value] of baseFormData.entries()) clonedFormData.append(key, value);
                    for (const fieldName in combo) clonedFormData.set(fieldName, combo[fieldName]);
                    await submitForm(clonedFormData);
                    if (count < combinations.length) await new Promise(resolve => setTimeout(resolve, 1200));
                }
                showNotification(`Копирование ${combinations.length} лотов завершено!`, false);
            });
            document.getElementById('closeCategoryMenu')?.addEventListener('click', () => {
                categoryMenu.classList.remove('active');
                setTimeout(() => { if (document.body.contains(categoryMenu)) document.body.removeChild(categoryMenu); }, 500);
            });
        });
        document.getElementById('closePopup')?.addEventListener('click', () => { popupMenu.classList.remove('active'); });
    }

    if (!document.querySelector('.fp-tools-import-btn')) {
        const importButton = createElement('button', { class: 'btn btn-default fp-tools-import-btn' }, {}, 'Импорт');
        actionsContainer.appendChild(importButton);
        createImportModal();

        importButton.addEventListener('click', async () => {
            const modal = document.getElementById('fp-tools-import-modal-overlay');
            modal.style.display = 'flex';
            
            document.getElementById('fp-import-scope-toggle').checked = false;
            document.getElementById('fp-import-my-lots-view').style.display = 'block';
            document.getElementById('fp-import-global-search-view').style.display = 'none';
            document.getElementById('fp-import-preview-content').innerHTML = '<div class="fp-import-empty">Выберите лот из списка слева</div>';

            const listContainer = document.getElementById('fp-import-lot-list');
            listContainer.innerHTML = '<div class="fp-import-loader"></div>';
            
            try {
                const appData = JSON.parse(document.body.dataset.appData);
                const userId = appData.userId;
                const lots = await chrome.runtime.sendMessage({ action: 'getUserLotsList', userId: userId });
                
                if (lots && lots.length > 0) {
                    let lotsHtml = '';
                    lots.forEach(lot => {
                        lotsHtml += `<div class="fp-import-lot-item" data-node-id="${lot.nodeId}" data-offer-id="${lot.id}">
                            <span class="fp-import-lot-title">${lot.title}</span>
                            <span class="fp-import-lot-id">#${lot.id}</span>
                        </div>`;
                    });
                    listContainer.innerHTML = lotsHtml;
                } else {
                    listContainer.innerHTML = '<div class="fp-import-empty">Не найдено лотов на вашем профиле.</div>';
                }
            } catch (error) {
                listContainer.innerHTML = `<div class="fp-import-empty">Ошибка загрузки лотов: ${error.message}</div>`;
            }
        });
    }
}

function createImportModal() {
    if (document.getElementById('fp-tools-import-modal-overlay')) return;

    const modalOverlay = createElement('div', { id: 'fp-tools-import-modal-overlay' });
    modalOverlay.innerHTML = `
        <div id="fp-tools-import-modal">
            <div class="fp-import-col-list">
                <div class="fp-import-header">
                    <h4>Выберите лот</h4>
                    <div class="fp-import-scope-switch">
                        <span>Мои лоты</span>
                        <label class="switch"><input type="checkbox" id="fp-import-scope-toggle"><span class="slider round"></span></label>
                        <span>Глобальный поиск</span>
                    </div>
                </div>
                
                <div id="fp-import-my-lots-view">
                    <input type="text" id="fp-import-search" placeholder="Поиск по моим лотам...">
                    <div id="fp-import-lot-list"></div>
                </div>

                <div id="fp-import-global-search-view" style="display: none;">
                    <button id="fp-import-back-btn" style="display: none;">&larr; Назад</button>
                    <input type="text" id="fp-global-search-input" placeholder="Название игры...">
                    <div id="fp-global-search-results"></div>
                </div>
            </div>
            <div class="fp-import-col-preview">
                <h4>Предпросмотр и опции</h4>
                <div id="fp-import-preview-content">
                    <div class="fp-import-empty">Выберите лот из списка слева</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);
    initializeGlobalSearchLogic();

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });

    document.getElementById('fp-import-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('#fp-import-lot-list .fp-import-lot-item').forEach(item => {
            const title = item.querySelector('.fp-import-lot-title').textContent.toLowerCase();
            item.style.display = title.includes(query) ? '' : 'none';
        });
    });

    document.getElementById('fp-import-lot-list').addEventListener('click', async (e) => {
        const item = e.target.closest('.fp-import-lot-item');
        if (!item) return;

        document.querySelectorAll('.fp-import-lot-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        
        const previewContainer = document.getElementById('fp-import-preview-content');
        previewContainer.innerHTML = '<div class="fp-import-loader"></div>';

        const nodeId = item.dataset.nodeId;
        const offerId = item.dataset.offerId;

        try {
            const lotData = await fetchLotDataForImport(nodeId, offerId);
            renderPreview(lotData);
        } catch (error) {
            previewContainer.innerHTML = `<div class="fp-import-empty">Ошибка: ${error.message}</div>`;
        }
    });
}

function initializeGlobalSearchLogic() {
    const myLotsView = document.getElementById('fp-import-my-lots-view');
    const globalSearchView = document.getElementById('fp-import-global-search-view');
    const toggle = document.getElementById('fp-import-scope-toggle');
    
    toggle.addEventListener('change', () => {
        const previewContainer = document.getElementById('fp-import-preview-content');
        previewContainer.innerHTML = '<div class="fp-import-empty">Выберите лот из списка слева</div>';
        if (toggle.checked) {
            myLotsView.style.display = 'none';
            globalSearchView.style.display = 'flex';
        } else {
            myLotsView.style.display = 'block';
            globalSearchView.style.display = 'none';
        }
    });

    const searchInput = document.getElementById('fp-global-search-input');
    const resultsContainer = document.getElementById('fp-global-search-results');
    const backBtn = document.getElementById('fp-import-back-btn');
    const previewContainer = document.getElementById('fp-import-preview-content');

    let searchState = {
        step: 'game', // 'game', 'category', 'lot'
        gameUrl: null,
        categoryUrl: null,
        nodeId: null
    };

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = searchInput.value.trim();
            if (query.length < 2) {
                resultsContainer.innerHTML = '';
                return;
            }
            resultsContainer.innerHTML = '<div class="fp-import-loader"></div>';
            try {
                const games = await chrome.runtime.sendMessage({ action: 'searchGames', query: query });
                renderGlobalResults(games, 'game');
            } catch (error) {
                resultsContainer.innerHTML = `<div class="fp-import-empty">Ошибка: ${error.message}</div>`;
            }
        }, 300);
    });

    resultsContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('.fp-global-result-item');
        if (!target) return;

        resultsContainer.innerHTML = '<div class="fp-import-loader"></div>';
        
        try {
            if (searchState.step === 'game') {
                searchInput.style.display = 'none';
                backBtn.style.display = 'block';
                searchState.gameUrl = target.dataset.url;
                searchState.step = 'category';
                const categories = await chrome.runtime.sendMessage({ action: 'getCategoryList', url: searchState.gameUrl });
                renderGlobalResults(categories, 'category');
            } else if (searchState.step === 'category') {
                searchState.categoryUrl = target.dataset.url;
                searchState.nodeId = target.dataset.nodeId;
                searchState.step = 'lot';
                const lots = await chrome.runtime.sendMessage({ action: 'getLotList', url: searchState.categoryUrl });
                renderGlobalResults(lots, 'lot');
            } else if (searchState.step === 'lot') {
                document.querySelectorAll('.fp-global-result-item').forEach(el => el.classList.remove('active'));
                target.classList.add('active');
                
                const offerId = target.dataset.offerId;
                if (!offerId) throw new Error("Не удалось получить ID лота");

                previewContainer.innerHTML = '<div class="fp-import-loader"></div>';
                
                const lotData = await fetchPublicLotDataForImport(offerId);
                renderPublicPreview(lotData);
            }
        } catch (error) {
            resultsContainer.innerHTML = `<div class="fp-import-empty">Ошибка: ${error.message}</div>`;
            searchInput.style.display = 'block';
            backBtn.style.display = 'none';
            searchState.step = 'game';
        }
    });
    
    backBtn.addEventListener('click', async () => {
        resultsContainer.innerHTML = '<div class="fp-import-loader"></div>';
        previewContainer.innerHTML = '<div class="fp-import-empty">Выберите лот из списка слева</div>';
        try {
            if (searchState.step === 'lot') {
                searchState.step = 'category';
                const categories = await chrome.runtime.sendMessage({ action: 'getCategoryList', url: searchState.gameUrl });
                renderGlobalResults(categories, 'category');
            } else if (searchState.step === 'category') {
                searchState.step = 'game';
                searchInput.style.display = 'block';
                backBtn.style.display = 'none';
                searchInput.dispatchEvent(new Event('input')); 
            }
        } catch (error) {
            resultsContainer.innerHTML = `<div class="fp-import-empty">Ошибка: ${error.message}</div>`;
        }
    });

    function renderGlobalResults(items, type) {
        if (!items || items.length === 0) {
            resultsContainer.innerHTML = `<div class="fp-import-empty">Ничего не найдено.</div>`;
            return;
        }

        let itemsHtml = '';
        if (type === 'game') {
            itemsHtml = items.map(item => `
                <div class="fp-global-result-item" data-url="${item.url}">
                    <img src="${item.img}" class="fp-global-item-img" onerror="this.style.display='none'">
                    <span>${item.name}</span>
                </div>`).join('');
        } else if (type === 'category') {
            itemsHtml = items.map(item => `
                <div class="fp-global-result-item" data-url="${item.url}" data-node-id="${item.nodeId}">
                    <span>${item.name}</span>
                    <span class="fp-global-item-count">${item.count}</span>
                </div>`).join('');
        } else if (type === 'lot') {
            itemsHtml = items.map(item => `
                <div class="fp-import-lot-item fp-global-result-item" data-offer-id="${item.offerId}">
                    <div class="fp-import-lot-details">
                        <span class="fp-import-lot-title">${item.description}</span>
                        <span class="fp-import-lot-seller">Продавец: ${item.seller}</span>
                    </div>
                    <span class="fp-import-lot-price">${item.price}</span>
                </div>`).join('');
        }
        resultsContainer.innerHTML = itemsHtml;
    }
}

function renderPublicPreview(data) {
    const previewContainer = document.getElementById('fp-import-preview-content');
    previewContainer.innerHTML = `
        <div class="fp-import-options">
            <label><input type="checkbox" data-field="summary" checked> Краткое описание</label>
            <label><input type="checkbox" data-field="description" checked> Подробное описание</label>
        </div>
        <div class="fp-import-preview-fields">
            <div class="fp-import-preview-field">
                <label>Краткое описание:</label>
                <textarea readonly>${data.summary}</textarea>
            </div>
             <div class="fp-import-preview-field">
                <label>Подробное описание:</label>
                <textarea readonly>${data.description}</textarea>
            </div>
        </div>
        <div class="fp-import-actions">
            <button id="fp-import-apply-public-btn" class="btn btn-primary">Импортировать</button>
        </div>
    `;
    
    document.getElementById('fp-import-apply-public-btn').addEventListener('click', () => {
        const importSummary = document.querySelector('.fp-import-options input[data-field="summary"]').checked;
        const importDescription = document.querySelector('.fp-import-options input[data-field="description"]').checked;

        if (importSummary) {
            const summaryInput = document.querySelector('input[name="fields[summary][ru]"]');
            if (summaryInput) {
                summaryInput.value = data.summary;
                summaryInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (importDescription) {
            const descTextarea = document.querySelector('textarea[name="fields[desc][ru]"]');
            if (descTextarea) {
                descTextarea.value = data.description;
                descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        document.getElementById('fp-tools-import-modal-overlay').style.display = 'none';
        showNotification('Данные успешно импортированы!', false);
    });
}

function renderPreview(data) {
    const previewContainer = document.getElementById('fp-import-preview-content');
    previewContainer.innerHTML = `
        <div class="fp-import-options">
            <label><input type="checkbox" data-field="summary" checked> Краткое описание</label>
            <label><input type="checkbox" data-field="desc" checked> Подробное описание</label>
            <label><input type="checkbox" data-field="payment_msg" checked> Сообщение покупателю</label>
            <label><input type="checkbox" data-field="secrets" checked> Автовыдача</label>
        </div>
        <div class="fp-import-preview-fields">
            <div class="fp-import-preview-field">
                <label>Краткое описание (RU):</label>
                <textarea readonly>${data.summary.ru}</textarea>
            </div>
            <div class="fp-import-preview-field">
                <label>Краткое описание (EN):</label>
                <textarea readonly>${data.summary.en}</textarea>
            </div>
             <div class="fp-import-preview-field">
                <label>Подробное описание (RU):</label>
                <textarea readonly>${data.desc.ru}</textarea>
            </div>
            <div class="fp-import-preview-field">
                <label>Подробное описание (EN):</label>
                <textarea readonly>${data.desc.en}</textarea>
            </div>
            <div class="fp-import-preview-field">
                <label>Сообщение покупателю (RU):</label>
                <textarea readonly>${data.payment_msg.ru}</textarea>
            </div>
            <div class="fp-import-preview-field">
                <label>Сообщение покупателю (EN):</label>
                <textarea readonly>${data.payment_msg.en}</textarea>
            </div>
            <div class="fp-import-preview-field">
                <label>Товары для автовыдачи (${data.secrets.split('\n').filter(Boolean).length} шт.):</label>
                <textarea readonly>${data.secrets}</textarea>
            </div>
        </div>
        <div class="fp-import-actions">
            <button id="fp-import-apply-btn" class="btn btn-primary">Импортировать</button>
        </div>
    `;
    
    document.getElementById('fp-import-apply-btn').addEventListener('click', () => {
        const checkedFields = Array.from(document.querySelectorAll('.fp-import-options input:checked')).map(cb => cb.dataset.field);

        const mappings = {
            summary: { ru: 'fields[summary][ru]', en: 'fields[summary][en]' },
            desc: { ru: 'fields[desc][ru]', en: 'fields[desc][en]' },
            payment_msg: { ru: 'fields[payment_msg][ru]', en: 'fields[payment_msg][en]' },
            secrets: 'secrets'
        };

        checkedFields.forEach(field => {
            if (field === 'secrets') {
                const el = document.querySelector(`textarea[name="${mappings.secrets}"]`);
                if(el) el.value = data.secrets;
            } else {
                const elRu = document.querySelector(`[name="${mappings[field].ru}"]`);
                const elEn = document.querySelector(`[name="${mappings[field].en}"]`);
                if (elRu) elRu.value = data[field].ru;
                if (elEn) elEn.value = data[field].en;
            }
        });
        
        document.querySelectorAll('.lot-field-input, textarea[name="secrets"]').forEach(el => el.dispatchEvent(new Event('input', { bubbles: true })));

        document.getElementById('fp-tools-import-modal-overlay').style.display = 'none';
        showNotification('Данные успешно импортированы!', false);
    });
}