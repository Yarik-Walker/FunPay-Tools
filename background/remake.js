const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const logElement = document.getElementById('log');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
let allConvertedLots = [];
function log(message, type = 'normal') {
    const entry = document.createElement('div');
    if (type) { entry.classList.add(`log-${type}`); }
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
}
function resetState() {
    allConvertedLots = [];
    logElement.innerHTML = '';
    downloadBtn.disabled = true;
    fileInput.value = '';
    log('Готов к работе...', 'info');
}
resetState();
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFiles(fileInput.files));
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
clearBtn.addEventListener('click', resetState);
downloadBtn.addEventListener('click', () => {
    if (allConvertedLots.length === 0) { log('Нет данных для скачивания.', 'error'); return; }
    const finalJsonString = JSON.stringify(allConvertedLots, null, 2);
    const blob = new Blob([finalJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FP_Tools_Import.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log('Файл для импорта успешно скачан!', 'success');
});
async function handleFiles(files) {
    logElement.innerHTML = '';
    log(`Начинаю обработку ${files.length} файлов...`, 'info');
    const fileReadPromises = Array.from(files).map(file => {
        return new Promise((resolve) => {
            if (!file.name.endsWith('.json')) { log(`Файл "${file.name}" пропущен (не JSON).`, 'error'); resolve([]); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data)) { throw new Error('JSON не является массивом.'); }
                    log(`Обработан файл: "${file.name}" (лотов: ${data.length})`, 'success');
                    resolve(convertFormat(data));
                } catch (err) { log(`Ошибка в файле "${file.name}": ${err.message}`, 'error'); resolve([]); }
            };
            reader.onerror = () => { log(`Не удалось прочитать файл "${file.name}"`, 'error'); resolve([]); };
            reader.readAsText(file);
        });
    });
    const results = await Promise.all(fileReadPromises);
    allConvertedLots = results.flat();
    if (allConvertedLots.length > 0) {
        log(`Всего готово к импорту: ${allConvertedLots.length} лотов.`, 'info');
        downloadBtn.disabled = false;
    } else {
        log('Не найдено подходящих лотов для конвертации.', 'error');
        downloadBtn.disabled = true;
    }
}
function convertFormat(cardinalLots) {
    return cardinalLots.map(lot => {
        const metaKeys = ['query', 'location'];
        const dataObject = {};
        for (const key in lot) { if (!metaKeys.includes(key)) { dataObject[key] = lot[key]; } }
        if (dataObject.offer_id) { dataObject.offer_id = '0'; }
        if (dataObject.auto_delivery === "" && dataObject.secrets && dataObject.secrets.length > 0) { dataObject.auto_delivery = "on"; }
        return { sourceTitle: lot['fields[summary][ru]'] || "Лот без названия", sourceCategory: "", data: dataObject };
    });
}