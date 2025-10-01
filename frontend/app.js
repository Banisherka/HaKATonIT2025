(() => {
  const api = () => {
    // Use window.API_BASE if available, otherwise construct from location
    if (window.API_BASE) {
      return window.API_BASE;
    }
    const host = window.location.host;
    const protocol = window.location.protocol;
    const apiBase = `${protocol}//${host}/api`;
    return apiBase;
  };

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Toast notification system
  function showNotification(message, type = 'info', duration = 5000) {
    console.log(`[NOTIFICATION] ${type.toUpperCase()}: ${message}`);
    
    // Remove existing notifications
    const existing = qs('.toast-notification');
    if (existing) {
      existing.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    // Style based on type
    const styles = {
      success: {
        backgroundColor: '#065f46',
        color: '#10b981',
        borderColor: '#10b981'
      },
      error: {
        backgroundColor: '#7f1d1d',
        color: '#fecaca',
        borderColor: '#ef4444'
      },
      warning: {
        backgroundColor: '#78350f',
        color: '#fbbf24',
        borderColor: '#f59e0b'
      },
      info: {
        backgroundColor: '#1e3a8a',
        color: '#93c5fd',
        borderColor: '#3b82f6'
      }
    };
    
    const style = styles[type] || styles.info;
    
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '10000',
      padding: '16px 20px',
      borderRadius: '8px',
      fontWeight: '500',
      fontSize: '14px',
      border: `2px solid ${style.borderColor}`,
      backgroundColor: style.backgroundColor,
      color: style.color,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      maxWidth: '400px',
      wordWrap: 'break-word',
      cursor: 'pointer',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease'
    });
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Click to dismiss
    notification.onclick = () => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    };
    
    // Auto-dismiss
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  let currentRunId = null;
  let page = 1;
  let pageSize = 50;

  const readKey = (id) => `read-${id}`;
  const markRead = (id) => localStorage.setItem(readKey(id), "1");
  const isRead = (id) => localStorage.getItem(readKey(id)) === "1";

  function fmtTs(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  }

  let runsPage = 1;
  let runsPageSize = 20; // Default page size

  async function loadRuns(page = 1, pageSize = runsPageSize) {
    try {
      const r = await fetch(`${api()}/runs/?page=${page}&page_size=${pageSize}`);
      if (!r.ok) {
        throw new Error(`HTTP Error: ${r.status} ${r.statusText}`);
      }
      const data = await r.json();
      const ul = qs('#runs-list');
      ul.innerHTML = '';
      
      // Update global variables
      runsPage = page;
      runsPageSize = pageSize;
      
      // Handle both old format (array) and new format (paginated object)
      let runs, total, currentPage;
      if (Array.isArray(data)) {
        // Old format compatibility
        runs = data;
        total = data.length;
        currentPage = 1;
      } else if (data && Array.isArray(data.items)) {
        // New paginated format
        runs = data.items;
        total = data.total;
        currentPage = data.page;
      } else {
        throw new Error('Invalid data format received from server');
      }
    
      // Update pagination info in header
      const runsInfo = qs('#runs-info');
      const totalPages = Math.ceil(total / pageSize);
      if (runsInfo) {
        runsInfo.textContent = `Страница ${currentPage} из ${totalPages} (всего ${total})`;
      }
    
      // Update page size selector in header
      const pageSizeSelect = qs('#runs-page-size-top');
      if (pageSizeSelect) {
        pageSizeSelect.value = pageSize.toString();
      }
      
      // Update navigation buttons
      const prevBtn = qs('#runs-prev');
      const nextBtn = qs('#runs-next');
      if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
      }
      if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
      }
    
      // File pinning storage
      const pinnedFiles = new Set((() => { 
        try { 
          return JSON.parse(localStorage.getItem('pinned-files') || '[]'); 
        } catch { 
          return []; 
        } 
      })());
      
      const onlyPinnedFiles = qs('#only-pinned-files')?.checked;
      let filteredRuns = runs;
      
      if (onlyPinnedFiles) {
        filteredRuns = runs.filter(run => pinnedFiles.has(run.id));
        
        // Update pagination info to reflect filtered results
        const runsInfo = qs('#runs-info');
        if (runsInfo) {
          if (filteredRuns.length === 0 && pinnedFiles.size === 0) {
            runsInfo.textContent = `Нет закреплённых файлов. Сначала закрепите файлы в списке.`;
          } else if (filteredRuns.length === 0) {
            runsInfo.textContent = `Закреплённые файлы не найдены на странице ${currentPage}. Попробуйте другие страницы.`;
          } else {
            runsInfo.textContent = `Показано ${filteredRuns.length} закреплённых файлов из ${pinnedFiles.size}`;
          }
        }
      }
      
      // Sort runs: pinned first
      filteredRuns.sort((a, b) => {
        const aPinned = pinnedFiles.has(a.id) ? -1 : 0;
        const bPinned = pinnedFiles.has(b.id) ? -1 : 0;
        return aPinned - bPinned;
      });
      
      // Show message if no files to display
      if (filteredRuns.length === 0) {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 16px; text-align: center; color: #9ca3af; font-style: italic;';
        
        if (onlyPinnedFiles && pinnedFiles.size === 0) {
          li.textContent = 'Нет закреплённых файлов. Сначала закрепите нужные файлы, нажав на кнопку "📍 закрепить" рядом с файлом.';
        } else if (onlyPinnedFiles) {
          li.textContent = 'Закреплённые файлы не найдены на этой странице. Попробуйте перейти на другие страницы или отключите фильтр.';
        } else {
          li.textContent = 'Нет файлов для отображения.';
        }
        
        ul.appendChild(li);
        return;
      }
      
      // Add runs
      filteredRuns.forEach(run => {
        const li = document.createElement('li');
        const isPinned = pinnedFiles.has(run.id);
        
        li.innerHTML = `
          <button class="sel-run" data-id="${run.id}">#${run.id}</button> 
          ${run.filename} 
          <span class="badge b-ok">${run.status}</span> 
          <small>${fmtTs(run.created_at)}</small> 
          <small>${run.summary || ''}</small>
          <span class="pin file-pin" data-id="${run.id}" title="${isPinned ? 'Открепить файл' : 'Закрепить файл'}">
            ${isPinned ? '📌 открепить' : '📍 закрепить'}
          </span>
        `;
        
        if (isPinned) {
          li.classList.add('pinned');
        }
        
        ul.appendChild(li);
      });
      
      // Add file pin event listeners
      qsa('.file-pin', ul).forEach(pin => {
        pin.onclick = (e) => {
          e.stopPropagation();
          const fileId = Number(pin.dataset.id);
          
          if (pinnedFiles.has(fileId)) {
            pinnedFiles.delete(fileId);
          } else {
            pinnedFiles.add(fileId);
          }
          
          try {
            localStorage.setItem('pinned-files', JSON.stringify(Array.from(pinnedFiles)));
          } catch { }
          
          // Reload runs to update display
          loadRuns(runsPage, runsPageSize);
        };
      });
    
      // Event listeners are set up once in init() function
    
      // Page size and navigation event listeners are set up once in init()
      
      // Event listeners for run selection
      qsa('.sel-run', ul).forEach(b => b.onclick = () => {
        const newRunId = Number(b.dataset.id);
        console.log('[RUN SELECTION] Setting currentRunId from', currentRunId, 'to', newRunId);
        currentRunId = newRunId;
        page = 1;
        // Restore only-pinned state for the selected file
        try {
          const getOnlyPinnedKey = () => `only-pinned-${currentRunId || 'global'}`;
          const key = getOnlyPinnedKey();
          const op = localStorage.getItem(key);
          const el = qs('#only-pinned');
          if (el) {
            el.checked = op === '1';
          }
        } catch { }
        renderLogs();
      });
      
      // Store current page for future reference
      runsPage = currentPage;
    } catch (e) {
      console.error('Error loading runs:', e);
      const ul = qs('#runs-list');
      ul.innerHTML = `<li style="color: #ef4444; padding: 8px;">Ошибка загрузки: ${e.message}</li>`;
    }
  }

  async function uploadFile() {
    console.log('[UPLOAD] uploadFile function called');
    const fileInput = qs('#file-input');
    console.log('[UPLOAD] File input element:', fileInput);
    console.log('[UPLOAD] Files in input:', fileInput?.files);
    const f = fileInput?.files[0];
    console.log('[UPLOAD] Selected file:', f ? f.name : 'NO FILE SELECTED');
    
    if (!f) {
      console.log('[UPLOAD] ❌ No file selected, returning');
      showNotification('⚠️ Пожалуйста, выберите файл для загрузки', 'warning');
      return;
    }
    const submitBtn = qs('#upload-form button[type="submit"]');
    const resultDiv = qs('#upload-result');

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Загрузка...';
      resultDiv.textContent = 'Загрузка файла...';
      resultDiv.style.color = '#9ca3af';
      resultDiv.style.backgroundColor = 'transparent';
      resultDiv.style.border = 'none';
      resultDiv.style.padding = '8px';
      
      // Show loading notification
      showNotification('📤 Загружаем файл...', 'info', 10000);

      const fd = new FormData();
      fd.append('file', f);

      console.log('Sending file upload request...');
      const r = await fetch(`${api()}/uploads/file`, { method: 'POST', body: fd });
      console.log('File upload request sent.');

      if (!r.ok) {
        throw new Error(`Ошибка HTTP: ${r.status} ${r.statusText}`);
      }

      const data = await r.json();
      resultDiv.textContent = `✓ Файл загружен успешно! run_id=${data.run_id}, status=${data.status}, ${data.summary || ''}`;
      resultDiv.style.color = '#10b981';
      resultDiv.style.backgroundColor = '#065f46';
      resultDiv.style.padding = '12px';
      resultDiv.style.borderRadius = '8px';
      resultDiv.style.fontWeight = '500';
      resultDiv.style.marginTop = '8px';
      resultDiv.style.border = '2px solid #10b981';
      
      // Show success notification toast
      showNotification('✅ Файл успешно загружен и обработан!', 'success');
      
      renderTimeline([]);

      await loadRuns();
      currentRunId = data.run_id;
      page = 1;
      // Restore only-pinned state for the new file
      try {
        const getOnlyPinnedKey = () => `only-pinned-${currentRunId || 'global'}`;
        const key = getOnlyPinnedKey();
        const op = localStorage.getItem(key);
        const el = qs('#only-pinned');
        if (el) {
          el.checked = op === '1';
        }
      } catch { }
      renderLogs();
    } catch (e) {
      console.error('Upload error:', e);
      resultDiv.textContent = `✗ Ошибка загрузки: ${e.message}`;
      resultDiv.style.color = '#fecaca';
      resultDiv.style.backgroundColor = '#7f1d1d';
      resultDiv.style.padding = '12px';
      resultDiv.style.borderRadius = '8px';
      resultDiv.style.fontWeight = '500';
      resultDiv.style.marginTop = '8px';
      resultDiv.style.border = '2px solid #ef4444';
      
      // Show error notification toast
      showNotification(`❌ Ошибка загрузки файла: ${e.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Загрузить';
    }
  }

  // Function to clear the history
  async function clearHistory() {
    // Show confirmation dialog
    const confirmed = confirm('Вы уверены, что хотите очистить всю историю запусков?\n\nЭто действие нельзя отменить. Все загруженные файлы и их данные будут удалены.');
    
    if (!confirmed) {
      return; // User cancelled
    }
    
    try {
      const r = await fetch(`${api()}/runs/clear`, { method: 'POST' });
      if (!r.ok) {
        throw new Error(`Ошибка HTTP: ${r.status} ${r.statusText}`);
      }
      await loadRuns();
      
      // Show success message
      showNotification('✓ История успешно очищена', 'success');
      
    } catch (e) {
      console.error('Ошибка очистки истории:', e);
      showNotification(`✗ Ошибка очистки: ${e.message}`, 'error');
    }
  }

async function selectAndImportDirectory() {
    // Создаем input элемент для выбора файлов
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.log,.txt,.jsonl,.json';
    fileInput.style.display = 'none';
    
    // Добавляем обработчик изменения
    fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) {
            return; // Пользователь отменил выбор
        }
        
        await importDirectoryFiles(files);
        
        // Удаляем input после использования
        document.body.removeChild(fileInput);
    };
    
    // Добавляем input в DOM и запускаем выбор файлов
    document.body.appendChild(fileInput);
    fileInput.click();
}

// Обновите функцию importDirectory для работы с выбранными файлами
async function importDirectoryFiles(selectedFiles) {
    const importBtn = qs('#btn-import');
    const box = qs('#import-progress');
    const bar = qs('#import-bar');
    const status = qs('#import-status');
    const report = qs('#import-report');
    const hideBtn = qs('#btn-hide-report');

    // Отключаем кнопку и меняем текст
    importBtn.disabled = true;
    importBtn.textContent = 'Импорт...';

    box.style.display = 'block';
    bar.style.width = '5%';
    status.textContent = 'Подготовка...';
    status.style.color = '#9ca3af';
    report.innerHTML = '';
    hideBtn.style.display = 'none';

    // показываем псевдо-прогресс пока идёт запрос
    let pct = 5;
    const timer = setInterval(() => {
        pct = Math.min(95, pct + 3);
        bar.style.width = pct + '%';
    }, 300);

    try {
        const formData = new FormData();
        
        // Добавляем все выбранные файлы в FormData
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        const r = await fetch(`${api()}/uploads/import`, {
            method: 'POST',
            body: formData
        });

        if (!r.ok) {
            throw new Error(`Ошибка HTTP: ${r.status} ${r.statusText}`);
        }

        const data = await r.json();
        clearInterval(timer);
        bar.style.width = '100%';
        status.textContent = `✓ Импорт завершён: всего ${data.count}, ok=${data.ok}, errors=${data.errors}`;
        status.style.color = '#10b981';

        // отчёт по файлам
        const rows = (data.runs || []).map(x => {
            const ok = !x.error;
            const color = ok ? '#10b981' : '#ef4444';
            const msg = ok ? (x.summary || '') : x.error;
            return `<div style="padding:4px 0;border-bottom:1px solid #1f2937"><span style="color:${color}">[${ok ? 'OK' : 'ERR'}]</span> ${x.filename} ${x.run_id ? `(#${x.run_id})` : ''} — ${msg}</div>`;
        }).join('');
        report.innerHTML = rows;
        hideBtn.style.display = 'inline-block';
        hideBtn.onclick = () => { box.style.display = 'none'; };
        
        // Показываем уведомление об успехе
        showNotification(`✅ Импортировано ${data.ok} файлов из ${data.count}`, 'success');
        
        await loadRuns();
    } catch (e) {
        console.error('Import error:', e);
        clearInterval(timer);
        status.textContent = `✗ Ошибка импорта: ${e.message}`;
        status.style.color = '#ef4444';
        bar.style.width = '100%';
        
        // Показываем уведомление об ошибке
        showNotification(`❌ Ошибка импорта: ${e.message}`, 'error');
    } finally {
        importBtn.disabled = false;
        importBtn.textContent = 'Импортировать каталог';
    }
}

  function getFilters() {
    const tf_req_id = qs('#f-req').value.trim() || '';
    const tf_resource_type = qs('#f-type').value.trim() || '';
    const level = qs('#f-level').value || '';
    const status = qs('#f-status').value || '';
    const search = qs('#f-search').value.trim() || '';
    const ts_from = qs('#f-from').value ? new Date(qs('#f-from').value).toISOString() : '';
    const ts_to = qs('#f-to').value ? new Date(qs('#f-to').value).toISOString() : '';
    return { tf_req_id, tf_resource_type, level, status, search, ts_from, ts_to };
  }

  async function fetchLogs() {
    if (!currentRunId) return { total: 0, items: [] };
    const f = getFilters();
    const includePairs = qs('#include-pairs')?.checked ? 'true' : 'false';
    const pairBy = qs('#pair-by')?.value || 'tf_req_id';
    const params = new URLSearchParams({ run_id: String(currentRunId), page: String(page), page_size: String(pageSize), include_pairs: includePairs, pair_by: pairBy });
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    const r = await fetch(`${api()}/logs/?${params.toString()}`);
    return r.json();
  }

  function rowClass(it) {
    if (it.is_malformed) return 'malformed';
    if (it.is_error) return 'error';
    return 'ok';
  }

  function levelBadge(level) {
    if (!level) return '';
    const map = { error: 'b-err', warn: 'b-warn', info: 'b-ok', debug: '' };
    const cls = map[level] || '';
    return `<span class="badge ${cls}">${level}</span>`;
  }

  function renderJsonCell(cell, txt) {
    const wrapper = document.createElement('div');
    const toggle = document.createElement('span');
    toggle.className = 'json-toggle';
    toggle.textContent = 'развернуть';
    const pre = document.createElement('pre');
    pre.style.display = 'none';
    try {
      const obj = typeof txt === 'string' ? JSON.parse(txt) : txt;
      pre.textContent = JSON.stringify(obj, null, 2);
    } catch {
      pre.textContent = String(txt || '');
    }
    toggle.onclick = () => {
      pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
      toggle.textContent = pre.style.display === 'none' ? 'развернуть' : 'свернуть';
    };
    wrapper.appendChild(toggle);
    wrapper.appendChild(pre);
    cell.appendChild(wrapper);
  }

  async function renderTimeline(items) {
    const host = qs('#timeline');
    host.innerHTML = '';
    if (!currentRunId) return;
    
    // Запрашиваем агрегированную хронологию
    const by = qs('#timeline-group')?.value || 'tf_req_id';
    const params = new URLSearchParams({ run_id: String(currentRunId), by });
    const r = await fetch(`${api()}/timeline/?${params.toString()}`);
    const data = await r.json();
    const bars = data.items || [];
    if (!bars.length) {
      host.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">Нет данных для отображения</div>';
      return;
    }

    // Сортируем элементы по количеству сообщений (показываем самые важные сверху)
    bars.sort((a, b) => b.count - a.count);
    
    const ts = bars.flatMap(i => [new Date(i.start).getTime(), new Date(i.end).getTime()]);
    const min = Math.min(...ts), max = Math.max(...ts);
    const width = Math.max(800, host.clientWidth || 800);
    const dur = Math.max(1, max - min);
    
    const labelWidth = 200; // Увеличенная ширина для меток
    const chartWidth = width - labelWidth - 20;
    const yStep = 28; // Увеличенная высота строк
    const headerHeight = 40;
    
    // Создаем контейнер с заголовком
    const header = document.createElement('div');
    header.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${headerHeight}px;
      background: #1f2937;
      border-bottom: 1px solid #374151;
      display: flex;
      align-items: center;
      padding: 0 8px;
      font-size: 12px;
      color: #9ca3af;
    `;
    
    // Временная шкала
    const timeScale = document.createElement('div');
    timeScale.style.cssText = `
      position: absolute;
      left: ${labelWidth}px;
      top: ${headerHeight - 20}px;
      width: ${chartWidth}px;
      height: 20px;
      border-bottom: 1px solid #374151;
    `;
    
    // Добавляем временные метки
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const x = (i / timeSteps) * chartWidth;
      const time = new Date(min + (i / timeSteps) * dur);
      const mark = document.createElement('div');
      mark.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: 0;
        width: 1px;
        height: 100%;
        background: #374151;
      `;
      const label = document.createElement('div');
      label.style.cssText = `
        position: absolute;
        left: ${x - 30}px;
        top: -18px;
        width: 60px;
        text-align: center;
        font-size: 10px;
        color: #6b7280;
      `;
      label.textContent = time.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      timeScale.appendChild(mark);
      timeScale.appendChild(label);
    }
    
    header.innerHTML = `Временная диаграмма (${bars.length} элементов, длительность: ${Math.round(dur/1000)}с)`;
    host.appendChild(header);
    host.appendChild(timeScale);
    
    // Обновляем высоту контейнера
    host.style.height = `${Math.max(240, headerHeight + bars.length * yStep + 20)}px`;
    
    bars.forEach((b, index) => {
      const lane = index;
      const x1 = Math.floor((new Date(b.start).getTime() - min) / dur * chartWidth) + labelWidth;
      const x2 = Math.floor((new Date(b.end).getTime() - min) / dur * chartWidth) + labelWidth;
      const y = headerHeight + lane * yStep + 8;
      
      // Создаем контейнер для строки
      const row = document.createElement('div');
      row.style.cssText = `
        position: absolute;
        left: 0;
        top: ${y - 4}px;
        width: 100%;
        height: ${yStep}px;
        background: ${index % 2 === 0 ? 'rgba(55, 65, 81, 0.3)' : 'transparent'};
        border-bottom: 1px solid rgba(55, 65, 81, 0.5);
      `;
      host.appendChild(row);
      
      // Подпись строки с улучшенным форматированием
      const label = document.createElement('div');
      label.style.cssText = `
        position: absolute;
        left: 8px;
        top: ${y}px;
        width: ${labelWidth - 16}px;
        height: 18px;
        color: #e5e7eb;
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: flex;
        align-items: center;
        cursor: help;
      `;
      
      // Укорачиваем длинные ключи
      let displayKey = b.key;
      if (displayKey.length > 30) {
        displayKey = displayKey.substring(0, 27) + '...';
      }
      
      label.textContent = displayKey;
      label.title = `${b.key}\nСообщений: ${b.count}\nОшибок: ${b.errors}\nПоврежденных: ${b.malformed}`;
      host.appendChild(label);
      
      // Полоса диаграммы с улучшенным стилем
      const bar = document.createElement('div');
      const hasErr = b.errors > 0;
      const hasMal = b.malformed > 0;
      const barWidth = Math.max(6, x2 - x1 + 2);
      
      bar.style.cssText = `
        position: absolute;
        left: ${x1}px;
        top: ${y}px;
        width: ${barWidth}px;
        height: 18px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: ${hasMal ? 'linear-gradient(90deg, #06b6d4, #22d3ee)' : 
                    hasErr ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : 
                    'linear-gradient(90deg, #3b82f6, #06b6d4)'};
        border: 1px solid ${hasMal ? '#06b6d4' : hasErr ? '#ef4444' : '#3b82f6'};
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      `;
      
      bar.title = `${b.key}\n\nВремя: ${new Date(b.start).toLocaleTimeString()} - ${new Date(b.end).toLocaleTimeString()}\nДлительность: ${Math.round((new Date(b.end) - new Date(b.start)) / 1000 * 100) / 100}с\nСообщений: ${b.count}\nОшибок: ${b.errors}\nПоврежденных: ${b.malformed}`;
      
      // Добавляем интерактивность
      bar.onmouseenter = () => {
        bar.style.transform = 'scaleY(1.2)';
        bar.style.zIndex = '10';
      };
      bar.onmouseleave = () => {
        bar.style.transform = 'scaleY(1)';
        bar.style.zIndex = '1';
      };
      
      // Клик для фильтрации по этому ключу
      bar.onclick = () => {
        if (by === 'tf_req_id') {
          qs('#f-req').value = b.key;
        } else if (by === 'resource') {
          const parts = b.key.split(':');
          if (parts.length === 2) {
            qs('#f-type').value = parts[0];
          }
        }
        // Применяем фильтр и обновляем логи
        page = 1;
        renderLogs();
      };
      
      host.appendChild(bar);
      
      // Добавляем индикатор статистики справа от полосы
      if (barWidth > 30) {
        const stats = document.createElement('div');
        stats.style.cssText = `
          position: absolute;
          left: ${x1 + barWidth + 4}px;
          top: ${y + 1}px;
          font-size: 10px;
          color: #9ca3af;
          pointer-events: none;
        `;
        stats.textContent = `${b.count}`;
        host.appendChild(stats);
      }
    });
    
    // Добавляем легенду
    const legend = document.createElement('div');
    legend.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 10px;
      color: #9ca3af;
      background: rgba(17, 24, 39, 0.8);
      padding: 4px 8px;
      border-radius: 4px;
    `;
    legend.innerHTML = `
      <div style="margin-bottom: 2px;">🟦 Обычные события</div>
      <div style="margin-bottom: 2px;">🟥 С ошибками</div>
      <div>🟦 С поврежденными данными</div>
    `;
    host.appendChild(legend);
  }

  async function renderLogs() {
    console.log('[RENDER DEBUG] ========== renderLogs() called ==========');
    const data = await fetchLogs();
    const extras = data.extras ? ` (+${data.extras} доп.)` : '';
    qs('#page-info').textContent = `page ${page}, size ${pageSize}, total ${data.total}${extras}`;
    const tbody = qs('#logs-table tbody');
    tbody.innerHTML = '';
    const groupOn = qs('#group-rows')?.checked;
    const pairBy = qs('#pair-by')?.value || 'tf_req_id';
    console.log('[RENDER DEBUG] pairBy from #pair-by:', pairBy);
    console.log('[RENDER DEBUG] currentRunId:', currentRunId);
    console.log('[RENDER DEBUG] groupOn:', groupOn);
    
    // Update pinned groups indicator
    const pinKey = () => `group-pin-${currentRunId}-${pairBy}`;
    const pinned = new Set((() => { try { return JSON.parse(localStorage.getItem(pinKey()) || '[]'); } catch { return []; } })());
    const indicator = qs('#pinned-groups-indicator');
    if (indicator) {
      if (pinned.size > 0) {
        indicator.textContent = `(${pinned.size} выбрано для экспорта)`;
        indicator.style.display = 'inline';
      } else {
        indicator.style.display = 'none';
      }
    }
    console.log('[RENDER DEBUG] Checking grouped mode...');
    if (!groupOn) {
      console.log('[RENDER DEBUG] Grouped mode is OFF - rendering individual rows');
      data.items.forEach(it => appendRow(tbody, it));
    } else {
      console.log('[RENDER DEBUG] Grouped mode is ON - starting group processing');
      const groupStateKey = () => {
        const key = `${currentRunId}-${qs('#pair-by')?.value || 'tf_req_id'}`;
        return `group-state-${key}`;
      };
      const state = (() => { try { return JSON.parse(localStorage.getItem(groupStateKey()) || '{}'); } catch { return {}; } })();
      const onlyPinned = qs('#only-pinned')?.checked;
      const groups = new Map();
      const keyOf = (x) => {
        if (pairBy === 'resource') {
          return `${x.tf_resource_type || ''}:${x.tf_resource_name || ''}`;
        } else if (pairBy === 'phase') {
          return x.phase || '';
        } else { // tf_req_id
          return x.tf_req_id; // Возвращаем null для записей без tf_req_id
        }
      };
      data.items.forEach(it => {
        const k = keyOf(it);
        // Обрабатываем null ключи как отдельную группу
        let groupKey = k;
        if (pairBy === 'tf_req_id' && (k === null || k === undefined)) {
          groupKey = '(без tf_req_id)'; // Создаём отдельную группу для null значений
          console.log('[RENDER DEBUG] Grouping item with null tf_req_id into special group:', it.id);
        } else if (pairBy === 'resource' && (k === null || k === undefined || k === ':')) {
          groupKey = '(без resource)';
        } else if (pairBy === 'phase' && (k === null || k === undefined || k === '')) {
          groupKey = '(без phase)';
        }
        
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(it);
      });
      const createdGroups = [];
      
      // Проверяем выбранные для отображения группы
      const displayPinKey = () => `display-pin-${currentRunId}-${pairBy}`;
      console.log('[RENDER DEBUG] Display pin key will be:', displayPinKey());
      console.log('[RENDER DEBUG] Checking localStorage for key:', displayPinKey());
      
      let displayPinned = new Set();
      try {
        const stored = localStorage.getItem(displayPinKey());
        console.log('[RENDER DEBUG] Display groups from localStorage (raw):', stored);
        console.log('[RENDER DEBUG] Type of stored value:', typeof stored);
        
        if (stored === null) {
          console.log('[RENDER DEBUG] No display filter found in localStorage');
        } else {
          displayPinned = new Set(JSON.parse(stored || '[]'));
          console.log('[RENDER DEBUG] Parsed display pinned groups:', Array.from(displayPinned));
          console.log('[RENDER DEBUG] Display pinned count:', displayPinned.size);
        }
      } catch (e) {
        console.error('[RENDER DEBUG] Error parsing display groups:', e);
        console.error('[RENDER DEBUG] Raw stored value was:', localStorage.getItem(displayPinKey()));
      }
      
      console.log('[RENDER DEBUG] All available groups:', Array.from(groups.keys()));
      console.log('[RENDER DEBUG] Display pinned size:', displayPinned.size);
      
      // Если есть выбранные для отображения группы, показываем только их
      let filteredGroups = groups;
      console.log('[RENDER DEBUG] Before filtering - displayPinned.size:', displayPinned.size);
      console.log('[RENDER DEBUG] Before filtering - total groups:', groups.size);
      
      if (displayPinned.size > 0) {
        filteredGroups = new Map();
        console.log('[RENDER DEBUG] Applying display filter...');
        for (const [key, value] of groups.entries()) {
          console.log('[RENDER DEBUG] Checking group:', key, 'in displayPinned?', displayPinned.has(key));
          if (displayPinned.has(key)) {
            filteredGroups.set(key, value);
            console.log('[RENDER DEBUG] ✓ Including group for display:', key, 'with', value.length, 'items');
          } else {
            console.log('[RENDER DEBUG] ✗ Skipping group:', key);
          }
        }
        console.log('[RENDER DEBUG] After filtering - filtered groups count:', filteredGroups.size);
      console.log('[RENDER DEBUG] After filtering - filtered group keys:', Array.from(filteredGroups.keys()));
      
      if (filteredGroups.size === 0) {
        console.warn('[RENDER DEBUG] ⚠️ WARNING: No groups match the display filter!');
        console.warn('[RENDER DEBUG] Display pinned groups:', Array.from(displayPinned));
        console.warn('[RENDER DEBUG] Available groups:', Array.from(groups.keys()));
      }
      } else {
        console.log('[RENDER DEBUG] No display filter applied, showing all', groups.size, 'groups');
      }
      
      // выводим pinned группы первыми
      let ordered = Array.from(filteredGroups.entries()).sort((a, b) => {
        const ap = pinned.has(a[0]) ? -1 : 0;
        const bp = pinned.has(b[0]) ? -1 : 0;
        return ap - bp;
      });
      
      console.log('[RENDER DEBUG] Final ordered groups count:', ordered.length);
      console.log('[RENDER DEBUG] Groups to render:', ordered.map(([k, v]) => `${k} (${v.length} items)`));

      if (onlyPinned) { 
        console.log('[RENDER DEBUG] onlyPinned is true, filtering by pinned groups...');
        const beforeFilter = ordered.length;
        ordered = ordered.filter(([k]) => pinned.has(k)); 
        console.log('[RENDER DEBUG] After onlyPinned filter:', beforeFilter, '->', ordered.length);
      } else {
        console.log('[RENDER DEBUG] onlyPinned is false, showing all filtered groups');
      }
      for (const [key, rows] of ordered) {
        const trh = document.createElement('tr');
        trh.className = 'group-header';
        const td = document.createElement('td');
        td.colSpan = 8;
        const toggle = document.createElement('span');
        toggle.className = 'group-toggle';
        toggle.textContent = `▼ ${key || '(пусто)'}`;
        let collapsed = !!state[key];
        td.appendChild(toggle);
        trh.appendChild(td);
        tbody.appendChild(trh);
        const children = [];
        rows.forEach(it => { children.push(appendRow(tbody, it)); });
        const apply = () => {
          toggle.textContent = `${collapsed ? '►' : '▼'} ${key || '(пусто)'}`;
          children.forEach(tr => tr.style.display = collapsed ? 'none' : 'table-row');
        };
        apply();
        toggle.onclick = () => {
          collapsed = !collapsed;
          toggle.textContent = `${collapsed ? '►' : '▼'} ${key || '(пусто)'}`;
          children.forEach(tr => tr.style.display = collapsed ? 'none' : 'table-row');
          try { state[key] = collapsed ? 1 : 0; localStorage.setItem(groupStateKey(), JSON.stringify(state)); } catch { }
        };
        // pin checkbox with better labeling
        const pinContainer = document.createElement('div');
        pinContainer.style.cssText = `
          display: inline-flex;
          align-items: center;
          margin-left: 8px;
          padding: 4px 8px;
          border-radius: 4px;
          background: ${pinned.has(key) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(55, 65, 81, 0.3)'};
          border: 1px solid ${pinned.has(key) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(75, 85, 99, 0.4)'};
          transition: all 0.2s ease;
        `;
        
        const pinCheckbox = document.createElement('input');
        pinCheckbox.type = 'checkbox';
        pinCheckbox.id = `pin-${currentRunId}-${pairBy}-${btoa(key).replace(/[^a-zA-Z0-9]/g, '')}`;
        pinCheckbox.checked = pinned.has(key);
        pinCheckbox.style.cssText = `
          margin-right: 6px;
          cursor: pointer;
          transform: scale(1.2);
        `;
        
        const pinLabel = document.createElement('label');
        pinLabel.htmlFor = pinCheckbox.id;
        pinLabel.innerHTML = `📌 <strong>${key || '(пусто)'}</strong>`;
        pinLabel.title = `Выбрать группу "${key}" для экспорта (${pinned.has(key) ? 'выбрана' : 'не выбрана'})`;
        pinLabel.style.cssText = `
          cursor: pointer;
          font-size: 11px;
          color: ${pinned.has(key) ? '#10b981' : '#9ca3af'};
          user-select: none;
          font-weight: ${pinned.has(key) ? '600' : '400'};
        `;
        
        pinCheckbox.onchange = (e) => {
          e.stopPropagation();
          
          if (pinCheckbox.checked) {
            pinned.add(key);
            pinLabel.style.fontWeight = '600';
            pinLabel.style.color = '#10b981';
            pinContainer.style.background = 'rgba(16, 185, 129, 0.2)';
            pinContainer.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            pinLabel.title = `Группа "${key}" выбрана для экспорта`;
          } else {
            pinned.delete(key);
            pinLabel.style.fontWeight = '400';
            pinLabel.style.color = '#9ca3af';
            pinContainer.style.background = 'rgba(55, 65, 81, 0.3)';
            pinContainer.style.borderColor = 'rgba(75, 85, 99, 0.4)';
            pinLabel.title = `Группа "${key}" не выбрана для экспорта`;
          }
          
          try {
            localStorage.setItem(pinKey(), JSON.stringify(Array.from(pinned)));
          } catch { }
          
          // Update pinned groups indicator
          const indicator = qs('#pinned-groups-indicator');
          if (indicator) {
            if (pinned.size > 0) {
              indicator.textContent = `(${pinned.size} выбрано)`;
              indicator.style.display = 'inline';
            } else {
              indicator.style.display = 'none';
            }
          }
        };
        
        pinContainer.appendChild(pinCheckbox);
        pinContainer.appendChild(pinLabel);
        td.appendChild(pinContainer);
        if (pinned.has(key)) trh.classList.add('pinned');
        createdGroups.push({ key, setCollapsed: (v) => { collapsed = v; apply(); } });

        // Массовые действия
        qs('#collapse-all').onclick = () => {
          createdGroups.forEach(g => g.setCollapsed(true));
          try { const obj = {}; createdGroups.forEach(g => obj[g.key] = 1); localStorage.setItem(groupStateKey(), JSON.stringify(obj)); } catch { }
        };

        qs('#expand-all').onclick = () => {
          createdGroups.forEach(g => g.setCollapsed(false));
          try { localStorage.setItem(groupStateKey(), JSON.stringify({})); } catch { }
        };
      }
      
      // Final DOM debugging
      console.log('[RENDER DEBUG] ========== Final DOM State ==========');
      console.log('[RENDER DEBUG] Table body children count:', tbody.children.length);
      const groupHeaders = tbody.querySelectorAll('.group-header');
      console.log('[RENDER DEBUG] Group headers found:', groupHeaders.length);
      groupHeaders.forEach((header, i) => {
        console.log(`[RENDER DEBUG] Group ${i}:`, header.textContent.trim());
      });
      console.log('[RENDER DEBUG] ========== End DOM State ==========');
    }
  }

  function appendRow(tbody, it) {
    const tr = document.createElement('tr');
    tr.className = rowClass(it);
    if (it.is_extra) tr.classList.add('extra');
    if (!isRead(it.id)) tr.style.outline = '1px solid rgba(59,130,246,.4)';
    tr.onclick = () => { markRead(it.id); tr.style.outline = 'none'; };
    tr.innerHTML = `
      <td>${fmtTs(it.timestamp)}</td>
      <td>${levelBadge(it.level)}</td>
      <td class="hide-mobile">${it.phase || ''}</td>
      <td>${it.tf_req_id || ''}</td>
      <td class="hide-mobile">${it.tf_resource_type || ''}</td>
      <td class="hide-mobile">${it.tf_resource_name || ''}</td>
      <td>${it.message ? String(it.message).slice(0, 200) : ''}</td>
      <td></td>
    `;
    const cell = tr.children[7];
    renderJsonCell(cell, it.data_json || {});
    tbody.appendChild(tr);
    return tr;
  }

  function exportTimelineAsImage() {
    const timelineEl = qs('#timeline');
    if (!timelineEl || !timelineEl.children.length) {
      alert('Нет данных диаграммы для экспорта');
      return;
    }

    // Используем html2canvas для конвертации в изображение
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => {
      html2canvas(timelineEl, {
        backgroundColor: '#111827',
        scale: 2, // Увеличиваем качество
        useCORS: true,
        allowTaint: true
      }).then(canvas => {
        // Создаём ссылку для скачивания
        const link = document.createElement('a');
        link.download = `gantt-chart-${currentRunId || 'timeline'}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }).catch(err => {
        console.error('Ошибка экспорта изображения:', err);
        alert('Ошибка при экспорте изображения');
      });
    };
    script.onerror = () => {
      alert('Не удалось загрузить библиотеку для экспорта изображений');
    };
    document.head.appendChild(script);
  }

  function init() {
    console.log('[INIT] Setting up upload form handler...');
    const uploadForm = qs('#upload-form');
    console.log('[INIT] Upload form element:', uploadForm);
    
    if (uploadForm) {
      uploadForm.onsubmit = (e) => {
        console.log('[UPLOAD] Form submitted, preventing default and calling uploadFile()');
        e.preventDefault();
        uploadFile();
      };
      console.log('[INIT] Upload form handler attached successfully');
    } else {
      console.error('[INIT] ❌ Upload form not found!');
    }
    qs('#refresh-runs').onclick = () => loadRuns();
    // загрузить сохранённую маску
    try { const saved = localStorage.getItem('import-pattern'); if (saved) { qs('#import-pattern').value = saved; } } catch { }
    // сохранять маску при изменении
    qs('#import-pattern').onchange = () => { try { localStorage.setItem('import-pattern', (qs('#import-pattern').value || '*').trim()); } catch { } };
    qs('#btn-import').onclick = () => selectAndImportDirectory();
    
    // Add event listener for the clear history button
    qs('#clear-history').onclick = () => clearHistory();
    qs('#apply-filters').onclick = () => { page = 1; renderLogs(); };
    qs('#page-size').onchange = () => { pageSize = Number(qs('#page-size').value) || 50; page = 1; renderLogs(); };
    qs('#include-pairs').onchange = () => { page = 1; renderLogs(); };
    qs('#pair-by').onchange = () => { page = 1; renderLogs(); };
    qs('#group-rows').onchange = () => { page = 1; renderLogs(); };
    // восстановить сохранённое состояние only-pinned
    const getOnlyPinnedKey = () => `only-pinned-${currentRunId || 'global'}`;
    const restoreOnlyPinnedState = () => {
      try {
        const key = getOnlyPinnedKey();
        const op = localStorage.getItem(key);
        if (op === '1') {
          const el = qs('#only-pinned');
          if (el) el.checked = true;
        } else {
          const el = qs('#only-pinned');
          if (el) el.checked = false;
        }
      } catch { }
    };
    restoreOnlyPinnedState();
    qs('#only-pinned').onchange = () => { 
      try { 
        const key = getOnlyPinnedKey();
        localStorage.setItem(key, qs('#only-pinned').checked ? '1' : '0'); 
      } catch { } 
      page = 1; 
      renderLogs(); 
    };
    // Remove old export-pinned handler - now handled in modal
    qs('#prev-page').onclick = () => { if (page > 1) { page--; renderLogs(); } };
    qs('#next-page').onclick = () => { page++; renderLogs(); };
    qs('#export-jsonl').onclick = () => { if (currentRunId) { window.open(`${api()}/export/jsonl?run_id=${currentRunId}`, '_blank'); } };
    qs('#timeline-group').onchange = () => renderTimeline([]);
    qs('#export-timeline-json').onclick = () => { if (currentRunId) { const by = qs('#timeline-group').value; window.open(`${api()}/export/timeline.json?run_id=${currentRunId}&by=${by}`, '_blank'); } };
    qs('#export-timeline-csv').onclick = () => { if (currentRunId) { const by = qs('#timeline-group').value; window.open(`${api()}/export/timeline.csv?run_id=${currentRunId}&by=${by}`, '_blank'); } };
    qs('#export-timeline-image').onclick = () => exportTimelineAsImage();
    
    // Runs pagination event listeners
    qs('#runs-prev').onclick = () => {
      if (runsPage > 1) {
        runsPage--;
        loadRuns(runsPage, runsPageSize);
      }
    };
    qs('#runs-next').onclick = () => {
      runsPage++;
      loadRuns(runsPage, runsPageSize);
    };
    qs('#runs-page-size-top').onchange = () => {
      runsPageSize = Number(qs('#runs-page-size-top').value);
      runsPage = 1; // Reset to first page when changing page size
      loadRuns(runsPage, runsPageSize);
    };
    
    // File pinning event handlers
    // Restore only-pinned-files state
    try {
      const onlyPinnedFilesState = localStorage.getItem('only-pinned-files-state');
      if (onlyPinnedFilesState === '1') {
        const el = qs('#only-pinned-files');
        if (el) el.checked = true;
      }
    } catch { }
    
    qs('#only-pinned-files').onchange = () => {
      // Save state
      try {
        localStorage.setItem('only-pinned-files-state', qs('#only-pinned-files').checked ? '1' : '0');
      } catch { }
      
      runsPage = 1; // Reset to first page when toggling filter
      loadRuns(runsPage, runsPageSize);
    };
    
    // Group selection modal event handlers (for export)
    qs('#select-groups').onclick = () => openGroupSelectionModal();
    qs('#close-group-modal').onclick = () => closeGroupSelectionModal();
    qs('#cancel-group-selection').onclick = () => closeGroupSelectionModal();
    qs('#load-groups').onclick = () => loadAvailableGroups();
    qs('#select-all-groups').onclick = () => selectAllGroups(true);
    qs('#deselect-all-groups').onclick = () => selectAllGroups(false);
    const exportBtn = qs('#export-selected-groups');
    if (exportBtn) {
      console.log('Setting up export-selected-groups button handler');
      exportBtn.onclick = () => exportSelectedGroups();
    } else {
      console.error('export-selected-groups button not found!');
    }
    
    // Display group selection modal event handlers
    qs('#select-display-groups').onclick = () => openDisplayGroupSelectionModal();
    qs('#close-display-group-modal').onclick = () => closeDisplayGroupSelectionModal();
    qs('#cancel-display-group-selection').onclick = () => closeDisplayGroupSelectionModal();
    qs('#load-display-groups').onclick = () => loadAvailableDisplayGroups();
    qs('#select-all-display-groups').onclick = () => selectAllDisplayGroups(true);
    qs('#deselect-all-display-groups').onclick = () => selectAllDisplayGroups(false);
    const applyDisplayBtn = qs('#apply-display-group-selection');
    if (applyDisplayBtn) {
      console.log('Setting up apply-display-group-selection button handler');
      applyDisplayBtn.onclick = () => applyDisplayGroupSelection();
    } else {
      console.error('apply-display-group-selection button not found!');
    }
    
    // Close modal on backdrop click
    qs('#group-selection-modal').onclick = (e) => {
      if (e.target === qs('#group-selection-modal')) {
        closeGroupSelectionModal();
      }
    };
    
    qs('#display-group-selection-modal').onclick = (e) => {
      if (e.target === qs('#display-group-selection-modal')) {
        closeDisplayGroupSelectionModal();
      }
    };
    
    loadRuns();
  }

  // Group selection modal functions
  let availableGroups = [];
  let selectedGroupKeys = new Set();
  
  function openGroupSelectionModal() {
    if (!currentRunId) {
      alert('Начала выберите файл из списка запусков');
      return;
    }
    
    const modal = qs('#group-selection-modal');
    const pairBy = qs('#pair-by')?.value || 'tf_req_id';
    
    // Устанавливаем текущие настройки
    qs('#modal-pair-by').value = pairBy;
    
    // Загружаем текущие выбранные группы
    const pinKey = () => `group-pin-${currentRunId}-${pairBy}`;
    try {
      const storedKeys = JSON.parse(localStorage.getItem(pinKey()) || '[]');
      selectedGroupKeys = new Set(storedKeys);
    } catch {
      selectedGroupKeys = new Set();
    }
    
    modal.style.display = 'flex';
    loadAvailableGroups();
  }
  
  function closeGroupSelectionModal() {
    const modal = qs('#group-selection-modal');
    modal.style.display = 'none';
  }
  
  async function loadAvailableGroups() {
    const pairBy = qs('#modal-pair-by').value;
    const loadingEl = qs('#groups-loading');
    const listEl = qs('#groups-list');
    
    loadingEl.style.display = 'block';
    listEl.innerHTML = '';
    
    try {
      const response = await fetch(`${api()}/logs/groups?run_id=${currentRunId}&pair_by=${pairBy}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      availableGroups = data.groups || [];
      
      renderGroupsList();
      
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--err);">
          ❌ Ошибка загрузки: ${error.message}
        </div>
      `;
    } finally {
      loadingEl.style.display = 'none';
    }
  }
  
  function renderGroupsList() {
    const listEl = qs('#groups-list');
    
    if (availableGroups.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--muted);">
          💭 Нет доступных групп для текущего файла
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = availableGroups.map((group, index) => {
      const isSelected = selectedGroupKeys.has(group.key);
      return `
        <div class="group-item ${isSelected ? 'selected' : ''}" data-key="${group.key}">
          <input type="checkbox" 
                 id="group-${index}" 
                 ${isSelected ? 'checked' : ''}
                 onchange="toggleGroupSelection('${group.key.replace(/'/g, "\\'")}')"
          >
          <div class="group-info">
            <div class="group-name">${group.display_name}</div>
            <div class="group-details">Тип: ${group.type}</div>
          </div>
          <div class="group-count">${group.count} записей</div>
        </div>
      `;
    }).join('');
    
    updateSelectedCount();
  }
  
  function toggleGroupSelection(key) {
    if (selectedGroupKeys.has(key)) {
      selectedGroupKeys.delete(key);
    } else {
      selectedGroupKeys.add(key);
    }
    
    // Обновляем визуальное отображение
    const groupItem = qs(`[data-key="${key}"]`);
    if (groupItem) {
      if (selectedGroupKeys.has(key)) {
        groupItem.classList.add('selected');
      } else {
        groupItem.classList.remove('selected');
      }
    }
    
    updateSelectedCount();
  }
  
  function selectAllGroups(select) {
    if (select) {
      availableGroups.forEach(group => selectedGroupKeys.add(group.key));
    } else {
      selectedGroupKeys.clear();
    }
    
    renderGroupsList();
  }
  
  function updateSelectedCount() {
    const countEl = qs('#selected-count');
    if (countEl) {
      countEl.textContent = `${selectedGroupKeys.size} выбрано`;
    }
  }
  
  function exportSelectedGroups() {
    const pairBy = qs('#modal-pair-by').value;
    const pinKey = () => `group-pin-${currentRunId}-${pairBy}`;
    
    // Сохраняем выбранные группы
    try {
      localStorage.setItem(pinKey(), JSON.stringify(Array.from(selectedGroupKeys)));
    } catch (error) {
      console.error('Ошибка сохранения выбора:', error);
    }
    
    const keys = Array.from(selectedGroupKeys);
    
    // Отладочная информация
    console.log('[EXPORT DEBUG] currentRunId:', currentRunId);
    console.log('[EXPORT DEBUG] pairBy:', pairBy);
    console.log('[EXPORT DEBUG] keys:', keys);
    
    if (!currentRunId) {
      alert('Нет выбранного файла для экспорта');
      return;
    }
    if (!keys.length) {
      alert('Нет выбранных групп для экспорта!\n\nВыберите группы из списка выше.');
      return;
    }
    
    const url = `${api()}/export/jsonl_by_keys?run_id=${currentRunId}&pair_by=${encodeURIComponent(pairBy)}&keys=${encodeURIComponent(keys.join(','))}`;
    console.log('[EXPORT DEBUG] Export URL:', url);
    window.open(url, '_blank');
    
    // Закрываем модальное окно после экспорта
    closeGroupSelectionModal();
    
    // Показываем сообщение об экспорте
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(16, 185, 129, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      z-index: 10001;
      font-weight: 600;
    `;
    message.textContent = `📌 Экспорт ${keys.length} групп запущен`;
    document.body.appendChild(message);
    
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }
  
  // Make toggleGroupSelection available globally
  window.toggleGroupSelection = toggleGroupSelection;
  
  // Display group selection modal functions
  let availableDisplayGroups = [];
  let selectedDisplayGroupKeys = new Set();
  
  function openDisplayGroupSelectionModal() {
    if (!currentRunId) {
      alert('Начала выберите файл из списка запусков');
      return;
    }
    
    const modal = qs('#display-group-selection-modal');
    const pairBy = qs('#pair-by')?.value || 'tf_req_id';
    
    // Устанавливаем текущие настройки
    qs('#display-modal-pair-by').value = pairBy;
    
    // Загружаем текущие выбранные группы для отображения
    const displayPinKey = () => `display-pin-${currentRunId}-${pairBy}`;
    try {
      const storedKeys = JSON.parse(localStorage.getItem(displayPinKey()) || '[]');
      selectedDisplayGroupKeys = new Set(storedKeys);
    } catch {
      selectedDisplayGroupKeys = new Set();
    }
    
    modal.style.display = 'flex';
    loadAvailableDisplayGroups();
  }
  
  function closeDisplayGroupSelectionModal() {
    const modal = qs('#display-group-selection-modal');
    modal.style.display = 'none';
  }
  
  async function loadAvailableDisplayGroups() {
    const pairBy = qs('#display-modal-pair-by').value;
    const loadingEl = qs('#display-groups-loading');
    const listEl = qs('#display-groups-list');
    
    loadingEl.style.display = 'block';
    listEl.innerHTML = '';
    
    try {
      const response = await fetch(`${api()}/logs/groups?run_id=${currentRunId}&pair_by=${pairBy}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      availableDisplayGroups = data.groups || [];
      
      renderDisplayGroupsList();
      
    } catch (error) {
      console.error('Ошибка загрузки групп для отображения:', error);
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--err);">
          ❌ Ошибка загрузки: ${error.message}
        </div>
      `;
    } finally {
      loadingEl.style.display = 'none';
    }
  }
  
  function renderDisplayGroupsList() {
    const listEl = qs('#display-groups-list');
    
    if (availableDisplayGroups.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--muted);">
          💭 Нет доступных групп для текущего файла
        </div>
      `;
      return;
    }
    
    listEl.innerHTML = availableDisplayGroups.map((group, index) => {
      const isSelected = selectedDisplayGroupKeys.has(group.key);
      return `
        <div class="group-item ${isSelected ? 'selected' : ''}" data-key="${group.key}">
          <input type="checkbox" 
                 id="display-group-${index}" 
                 ${isSelected ? 'checked' : ''}
                 onchange="toggleDisplayGroupSelection('${group.key.replace(/'/g, "\\'")}')"
          >
          <div class="group-info">
            <div class="group-name">${group.display_name}</div>
            <div class="group-details">Тип: ${group.type}</div>
          </div>
          <div class="group-count">${group.count} записей</div>
        </div>
      `;
    }).join('');
    
    updateDisplaySelectedCount();
  }
  
  function toggleDisplayGroupSelection(key) {
    if (selectedDisplayGroupKeys.has(key)) {
      selectedDisplayGroupKeys.delete(key);
    } else {
      selectedDisplayGroupKeys.add(key);
    }
    
    // Обновляем визуальное отображение
    const groupItem = qs(`#display-groups-list [data-key="${key}"]`);
    if (groupItem) {
      if (selectedDisplayGroupKeys.has(key)) {
        groupItem.classList.add('selected');
      } else {
        groupItem.classList.remove('selected');
      }
    }
    
    updateDisplaySelectedCount();
  }
  
  function selectAllDisplayGroups(select) {
    if (select) {
      availableDisplayGroups.forEach(group => selectedDisplayGroupKeys.add(group.key));
    } else {
      selectedDisplayGroupKeys.clear();
    }
    
    renderDisplayGroupsList();
  }
  
  function updateDisplaySelectedCount() {
    const countEl = qs('#display-selected-count');
    if (countEl) {
      countEl.textContent = `${selectedDisplayGroupKeys.size} выбрано`;
    }
  }
  
  function applyDisplayGroupSelection() {
    const pairBy = qs('#display-modal-pair-by').value;
    
    // Отладочная информация
    console.log('[DISPLAY DEBUG] ========== applyDisplayGroupSelection START ==========');
    console.log('[DISPLAY DEBUG] currentRunId:', currentRunId, 'type:', typeof currentRunId);
    console.log('[DISPLAY DEBUG] pairBy:', pairBy);
    console.log('[DISPLAY DEBUG] selectedDisplayGroupKeys:', Array.from(selectedDisplayGroupKeys));
    console.log('[DISPLAY DEBUG] selectedDisplayGroupKeys.size:', selectedDisplayGroupKeys.size);
    
    // Проверяем, что currentRunId установлен
    if (!currentRunId) {
      console.error('[DISPLAY DEBUG] ❌ ERROR: currentRunId is not set!', currentRunId);
      alert('Ошибка: не выбран файл для анализа. Сначала выберите файл из списка.');
      return;
    }
    
    if (selectedDisplayGroupKeys.size === 0) {
      console.error('[DISPLAY DEBUG] ❌ ERROR: No groups selected!');
      alert('Ошибка: не выбраны группы для отображения.');
      return;
    }
    
    try {
      // ВАЖНО: Сначала обновляем тип группировки в основном интерфейсе
      // чтобы при вызове renderLogs() ключи в localStorage совпадали
      const mainPairBy = qs('#pair-by');
      if (mainPairBy) {
        mainPairBy.value = pairBy;
        console.log('[DISPLAY DEBUG] Updated main pairBy to:', pairBy);
      }
      
      // Теперь формируем ключ с обновленным pairBy
      const displayPinKey = () => `display-pin-${currentRunId}-${pairBy}`;
      console.log('[DISPLAY DEBUG] displayPinKey:', displayPinKey());
      
      const keysArray = Array.from(selectedDisplayGroupKeys);
      localStorage.setItem(displayPinKey(), JSON.stringify(keysArray));
      console.log('[DISPLAY DEBUG] Saved to localStorage:', keysArray);
      
      closeDisplayGroupSelectionModal();
      
      // Показываем успешное сообщение
      const message = document.createElement('div');
      message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 10001;
        font-weight: 600;
      `;
      message.textContent = `✅ Применено ${selectedDisplayGroupKeys.size} групп для отображения`;
      document.body.appendChild(message);
      
      setTimeout(() => {
        if (message.parentNode) {
          message.parentNode.removeChild(message);
        }
      }, 3000);
      
      // Переключаемся на секцию логов и перезагружаем их
      const logsSection = qs('#logs-section');
      if (logsSection) {
        logsSection.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Показываем уведомление о применении фильтра
      showNotification(`🔍 Применен фильтр отображения: ${selectedDisplayGroupKeys.size} группы выбраны`, 'info', 3000);
      
      // Убеждаемся, что режим группировки включен
      const groupRowsCheckbox = qs('#group-rows');
      if (groupRowsCheckbox && !groupRowsCheckbox.checked) {
        console.log('[DISPLAY DEBUG] Enabling group mode for display filtering');
        groupRowsCheckbox.checked = true;
        showNotification('🛠️ Включен режим группировки для применения фильтра', 'info');
      }
      
      // Перезагружаем логи, чтобы применить фильтр
      console.log('[DISPLAY DEBUG] ========== CALLING renderLogs() ==========');
      console.log('[DISPLAY DEBUG] About to call renderLogs() with:');
      console.log('[DISPLAY DEBUG] - currentRunId:', currentRunId);
      console.log('[DISPLAY DEBUG] - pairBy from #pair-by:', qs('#pair-by')?.value);
      console.log('[DISPLAY DEBUG] - group mode enabled:', qs('#group-rows')?.checked);
      renderLogs();
      console.log('[DISPLAY DEBUG] ========== renderLogs() call completed ==========');
      
      // Показываем финальное уведомление
      setTimeout(() => {
        showNotification(`✅ Отображение обновлено: показано ${selectedDisplayGroupKeys.size} выбранных групп`, 'success');
      }, 1000);
      
    } catch (error) {
      console.error('Ошибка сохранения выбора для отображения:', error);
      alert('Ошибка сохранения выбора групп для отображения');
    }
  }
  
  // Make toggleDisplayGroupSelection available globally
  window.toggleDisplayGroupSelection = toggleDisplayGroupSelection;

  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting init...');
    
    // Check if modal elements exist before init
    const exportModal = qs('#group-selection-modal');
    const displayModal = qs('#display-group-selection-modal');
    const exportBtn = qs('#export-selected-groups');
    const applyBtn = qs('#apply-display-group-selection');
    
    console.log('Export modal found:', !!exportModal);
    console.log('Display modal found:', !!displayModal);
    console.log('Export button found:', !!exportBtn);
    console.log('Apply button found:', !!applyBtn);
    
    if (exportBtn) {
      console.log('Export button text:', exportBtn.textContent);
      console.log('Export button class:', exportBtn.className);
    }
    
    if (applyBtn) {
      console.log('Apply button text:', applyBtn.textContent);
      console.log('Apply button class:', applyBtn.className);
    }
    
    init();
  });
})();
