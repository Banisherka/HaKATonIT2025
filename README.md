# 🚀 Terraform Log Viewer

Веб-приложение для анализа и визуализации логов Terraform с интерактивными диаграммами Ганта, фильтрацией и экспортом данных.

## ⚡ Быстрый старт

> **📌 Порты по умолчанию:**
> - **Docker**: Frontend - `http://localhost:8080`, API - `http://localhost:8000`
> - **Локальная разработка**: Единый сервер - `http://localhost:5000`

### Способ 1: Docker (Рекомендуется)

```bash
# Клонировать репозиторий
git clone <repository-url>
cd terraform-log-viewer

# Запустить через Docker Compose
docker-compose up -d

# Открыть в браузере
http://localhost:8080
```

### Способ 2: Локальная разработка

```bash
# Установить зависимости и запустить
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 --reload

# Открыть в браузере (фронтенд будет работать через встроенный сервер)
http://localhost:5000
```

---

## 📋 Системные требования

- **Python**: 3.8+ 
- **Docker**: 20.10+ (опционально)
- **Docker Compose**: 2.0+ (опционально)
- **Браузер**: Chrome 90+, Firefox 88+, Safari 14+

---

## 🛠 Установка по операционным системам

### 🐧 Linux (Ubuntu/Debian)

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Python и pip
sudo apt install python3 python3-pip python3-venv -y

# Установить Docker (опционально)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Клонировать проект
git clone <repository-url>
cd terraform-log-viewer

# Запуск через Docker
docker-compose up -d

# ИЛИ запуск локально
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 --reload
```

### 🍎 macOS

```bash
# Установить Homebrew (если не установлен)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установить Python
brew install python

# Установить Docker Desktop
brew install --cask docker

# Клонировать проект
git clone <repository-url>
cd terraform-log-viewer

# Запуск через Docker
docker-compose up -d

# ИЛИ запуск локально
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 --reload
```

### 🪟 Windows

#### Через PowerShell (рекомендуется):

```powershell
# Установить Python через Microsoft Store или python.org
# Установить Docker Desktop с https://docker.com/products/docker-desktop

# Клонировать проект
git clone <repository-url>
cd terraform-log-viewer

# Запуск через Docker
docker-compose up -d

# ИЛИ запуск локально
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 --reload
```

#### Через WSL2 (Linux подсистема):

```bash
# Включить WSL2 в Windows Features
# Установить Ubuntu из Microsoft Store

# В WSL2 терминале:
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-venv git -y

# Установить Docker Desktop with WSL2 backend
# Следовать инструкциям для Linux выше
```

---

## 🏗 Архитектура проекта

```
terraform-log-viewer/
├── 📁 backend/                    # FastAPI бэкенд
│   ├── 📁 app/
│   │   ├── 📄 main.py            # Главный файл приложения
│   │   ├── 📄 models.py          # SQLAlchemy модели
│   │   ├── 📄 parser.py          # Парсер Terraform логов
│   │   ├── 📄 services.py        # Бизнес-логика
│   │   ├── 📄 database.py        # Конфигурация БД
│   │   └── 📁 routers/           # API маршруты
│   ├── 📁 plugins/               # Система плагинов
│   ├── 📁 storage/               # База данных и файлы
│   └── 📄 requirements.txt       # Python зависимости
├── 📁 frontend/                   # Фронтенд (HTML/CSS/JS)
│   ├── 📄 index.html            # Главная страница
│   ├── 📄 app.js               # JavaScript логика
│   └── 📄 styles.css           # Стили
├── 📁 plugins/                    # Пример плагинов
└── 📄 docker-compose.yml        # Docker конфигурация
```

---

## 🔧 Конфигурация

### Переменные окружения

Создайте файл `.env` в корне проекта:

```bash
# База данных
DATABASE_URL=sqlite:///./backend/storage/logviewer.sqlite3

# Сервер
HOST=0.0.0.0
PORT=5000

# Загрузки
UPLOAD_DIR=./backend/storage/uploads
MAX_FILE_SIZE=100MB

# Логирование
LOG_LEVEL=INFO
```

### Docker настройки

```yaml
# docker-compose.yml
version: '3.8'
services:
  hakaton-api:
    build: ./backend
    ports:
      - "5000:5000"
    volumes:
      - ./backend/storage:/app/storage
      
  hakaton-web:
    build: ./frontend  
    ports:
      - "3000:80"
    depends_on:
      - hakaton-api
```

---

## 📊 Функциональность

### 🔍 Основные возможности

#### 📁 **Управление файлами**
- ✅ **Загрузка файлов**: Поддержка JSON, JSONL, LOG, TXT форматов
- ✅ **Парсинг логов**: Автоматический парсинг Terraform логов
- ✅ **Закрепление файлов**: Избранные файлы для быстрого доступа

#### 🔍 **Поиск и фильтрация**
- ✅ **Многоуровневая фильтрация**: По типу ресурса, ID запроса, фазе выполнения
- ✅ **Поиск**: Частичное совпадение по всем полям
- 🆕 **Расширенное управление группами**: Модальные окна для выбора групп
- 🆕 **Предварительный анализ**: Просмотр всех групп до их отображения

#### 📊 **Визуализация**
- ✅ **Диаграмма Ганта**: Интерактивная временная шкала
- ✅ **Группировка**: По tf_req_id, resource, phase
- ✅ **Пагинация**: 10, 20, 50 элементов на страницу
- 🆕 **Интеллектуальное отображение**: Фильтрация логов по выбранным группам

#### 💾 **Экспорт**
- ✅ **Мультиформатный экспорт**: JSONL, CSV, JSON, PNG
- 🆕 **Селективный экспорт**: Прямой экспорт выбранных групп из модального окна
- 🆕 **Интегрированный рабочий процесс**: Выбор и экспорт в одном интерфейсе

**Легенда**: ✅ = Существующая функция | 🆕 = Новая функция

### 🎨 Интерфейс

- 🌙 **Тёмная тема**: Современный дизайн
- 📱 **Адаптивность**: Работа на всех устройствах  
- ⚡ **Производительность**: Быстрая загрузка и фильтрация
- 🎭 **Анимации**: Плавные переходы и эффекты

---

## 🔗 Система группировки и закрепления

### 📊 Принципы группировки

Система поддерживает три основных способа группировки логов Terraform:

#### 1. 🆔 По tf_req_id (Request ID)
```
Группирует записи по идентификатору запроса Terraform
├── 6970e347-4d21-b968-9d19-fa032f40fa83
│   ├── 📄 ValidateProviderConfig
│   ├── 📄 ConfigureProvider  
│   └── 📄 ReadResource
├── 29b57623-7d8c-800d-2c16-03aecba70202
│   ├── 📄 ApplyResourceChange
│   └── 📄 PlanResourceChange
```

**Описание**: tf_req_id - это уникальный идентификатор, присваиваемый каждому запросу к провайдеру Terraform. Все операции, связанные с одним запросом, группируются вместе.

**Применение**: Идеально для отслеживания последовательности операций в рамках одного запроса и выявления проблем на уровне отдельных API-вызовов.

#### 2. 🏗️ По ресурсам (Resource)
```
Группирует записи по типу и имени ресурса
├── t1_vpc_vip:foo
│   ├── 📄 Plan: Create
│   ├── 📄 Apply: Creating...
│   └── 📄 Apply: Creation complete
├── data.t1_vpc_network:default
│   ├── 📄 Read: Reading...
│   └── 📄 Read: Read complete
```

**Описание**: Группировка по паре `{resource_type}:{resource_name}`, где:
- `resource_type` - тип ресурса (например, `t1_vpc_vip`, `data.t1_vpc_network`)
- `resource_name` - имя экземпляра ресурса (например, `foo`, `default`)

**Применение**: Отличный способ отслеживания жизненного цикла конкретных ресурсов от планирования до применения.

#### 3. ⚡ По фазам (Phase)
```
Группирует записи по фазам выполнения Terraform
├── plan
│   ├── 📄 Planning changes...
│   ├── 📄 Resource planning
│   └── 📄 Plan complete
├── apply
│   ├── 📄 Applying changes...
│   ├── 📄 Resource creation
│   └── 📄 Apply complete
```

**Описание**: Автоматическое определение фаз выполнения на основе анализа содержимого логов:
- `plan` - фаза планирования изменений
- `apply` - фаза применения изменений  
- `destroy` - фаза удаления ресурсов
- `validate` - фаза валидации конфигурации

**Применение**: Высокоуровневый обзор процесса выполнения Terraform для понимания общего прогресса.

---

## 📚 Технология построения диаграмм Ганта

### 🏠 Архитектура визуализации

#### 1. 🎯 Сбор данных временной шкалы

```python
# API эндпоинт: GET /api/timeline/
def get_timeline_data(run_id: int, by: str):
    """
    Строит временную шкалу на основе группировки
    by: 'tf_req_id' | 'resource' | 'phase'
    """
    # Группировка логов по выбранному критерию
    grouped_logs = group_logs_by_criteria(logs, by)
    
    # Построение временных интервалов
    timeline_items = []
    for group_key, group_logs in grouped_logs.items():
        start_time = min(log.timestamp for log in group_logs)
        end_time = max(log.timestamp for log in group_logs)
        
        timeline_items.append({
            'key': group_key,
            'start': start_time,
            'end': end_time,
            'duration': end_time - start_time,
            'logs_count': len(group_logs),
            'has_errors': any(log.is_error for log in group_logs)
        })
    
    return sorted(timeline_items, key=lambda x: x['start'])
```

#### 2. 🎨 Алгоритм рендеринга

**Вычисление позиций**:
```javascript
function calculateGanttPositions(timelineData) {
    const totalDuration = maxTime - minTime;
    const chartWidth = containerWidth - margins;
    
    return timelineData.map(item => ({
        x: ((item.start - minTime) / totalDuration) * chartWidth,
        width: Math.max(
            (item.duration / totalDuration) * chartWidth,
            MIN_BAR_WIDTH  // Минимальная ширина для видимости
        ),
        y: rowIndex * ROW_HEIGHT,
        height: BAR_HEIGHT
    }));
}
```

**Цветовая схема**:
```javascript
const colorScheme = {
    normal: '#3b82f6',    // Синий - обычные операции
    error: '#ef4444',     // Красный - операции с ошибками
    warning: '#f59e0b',   // Жёлтый - предупреждения
    success: '#10b981'    // Зелёные - успешные операции
};
```

#### 3. 🖼️ Экспорт в изображения

Система использует библиотеку `html2canvas` для создания PNG-изображений:

```javascript
function exportTimelineAsImage() {
    html2canvas(timelineElement, {
        backgroundColor: '#111827',  // Тёмный фон
        scale: 2,                   // Высокое качество
        useCORS: true,             // Поддержка внешних ресурсов
        allowTaint: true           // Разрешить смешанный контент
    }).then(canvas => {
        // Автоматическая загрузка файла
        const link = document.createElement('a');
        link.download = `gantt-chart-${runId}-${date}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}
```

### 🎮 Интерактивные возможности

#### 📊 Масштабирование времени
- Автоматическое определение оптимального масштаба
- Отображение временных меток в удобночитаемом формате
- Поддержка различных временных диапазонов (секунды, минуты, часы)

#### 🎯 Детализация при hover
```javascript
// Отображение подробной информации при наведении
bar.addEventListener('mouseover', (e) => {
    showTooltip({
        title: item.key,
        startTime: formatTime(item.start),
        duration: formatDuration(item.duration),
        logsCount: item.logs_count,
        hasErrors: item.has_errors
    });
});
```

#### 📋 Связь с таблицей логов
- Клик по полосе Ганта фильтрует таблицу логов
- Синхронизация выбранной группировки между диаграммой и таблицей
- Автоматическое обновление при изменении фильтров

---

## 🚀 API документация

### Основные эндпоинты

```bash
# Получить список запусков (с пагинацией)
GET /api/runs/?page=1&page_size=20

# Загрузить файл
POST /api/upload/
Content-Type: multipart/form-data

# Получить логи с фильтрацией
GET /api/logs/?tf_req_id=123&resource_type=aws&phase=apply

# Получить все группы для выбора
GET /api/logs/groups?run_id=1&pair_by=tf_req_id

# Экспорт выбранных групп
GET /api/export/jsonl_by_keys?run_id=1&pair_by=tf_req_id&keys=group1,group2

# Экспорт в CSV
GET /api/export/csv/{run_id}

# Экспорт в JSON  
GET /api/export/json/{run_id}

# Временная шкала
GET /api/timeline/{run_id}
```

### Форматы данных

```json
{
  "run": {
    "id": 1,
    "filename": "terraform.log",
    "status": "parsed",
    "created_at": "2024-01-01T12:00:00Z",
    "summary": "lines=1000; malformed=0; phases=plan,apply"
  },
  "logs": [
    {
      "timestamp": "2024-01-01T12:00:00Z",
      "level": "INFO",
      "tf_req_id": "123",
      "tf_resource_type": "aws_instance",
      "phase": "apply",
      "message": "Creating resource..."
    }
  ]
}
```

---

## 🧪 Тестирование

```bash
# Запуск тестов
cd backend
python -m pytest tests/ -v

# Тесты с покрытием
python -m pytest tests/ --cov=app --cov-report=html

# Линтинг кода
python -m flake8 app/
python -m black app/ --check

# Проверка типов
python -m mypy app/
```

---

## 🔍 Отладка и решение проблем

### Частые проблемы

**❌ Ошибка 404 при загрузке файлов**
```bash
# Решение: Проверить конфигурацию статических файлов
uvicorn backend.app.main:app --host 0.0.0.0 --port 5000 --reload
```

**❌ Ошибка "failed to fetch"**
```bash
# Решение: Проверить формат файла и размер
# Максимальный размер: 100MB
# Поддерживаемые форматы: .json, .jsonl
```

**❌ Docker контейнеры не запускаются**
```bash
# Решение: Очистить и пересобрать
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

**❌ Ошибки парсинга timestamp**
```bash
# Решение: Проверить формат временных меток
# Поддерживаемые форматы:
# - ISO 8601: 2024-01-01T12:00:00Z
# - С часовым поясом: 2024-01-01T12:00:00+03:00
```

### Логи для отладки

```bash
# Логи Docker контейнеров
docker-compose logs -f hakaton-api
docker-compose logs -f hakaton-web

# Логи приложения
tail -f backend/storage/app.log

# Логи базы данных
sqlite3 backend/storage/logviewer.sqlite3 ".tables"
```

---

## 🔌 Система плагинов

### Создание плагина

```python
# plugins/my-plugin/server.py
from backend.plugins.client import BasePlugin

class MyPlugin(BasePlugin):
    def process_batch(self, entries):
        # Обработка записей
        for entry in entries:
            entry['custom_field'] = self.analyze(entry)
        return entries
    
    def analyze(self, entry):
        # Ваша логика анализа
        return "processed"
```

### Регистрация плагина

```yaml
# plugins/my-plugin/docker-compose.yml
version: '3.8'
services:
  my-plugin:
    build: .
    ports:
      - "50052:50051"
    environment:
      - PLUGIN_NAME=my-plugin
```

---

## 📈 Производительность

### Рекомендации по оптимизации

- 🚀 **Индексы БД**: Автоматически создаются для часто используемых полей
- 📦 **Пакетная обработка**: 500 записей за раз
- 🗜 **Сжатие**: gzip для API ответов
- ⚡ **Кэширование**: Redis для часто запрашиваемых данных (планируется)

### Лимиты

| Параметр | Значение |
|----------|----------|
| Максимальный размер файла | 100 MB |
| Максимальное количество записей | 1M |
| Время парсинга (100K записей) | ~30 сек |
| Максимальное количество запусков | 10K |

---

## 🛡 Безопасность

- ✅ **Валидация файлов**: Проверка формата и размера
- ✅ **Санитизация**: Очистка пользовательского ввода  
- ✅ **CORS**: Настройка разрешенных источников
- ✅ **Rate Limiting**: Ограничение количества запросов (планируется)

---

## 🤝 Участие в разработке

### Требования для разработчиков

```bash
# Установка dev зависимостей
pip install -r backend/requirements-dev.txt

# Pre-commit хуки  
pre-commit install

# Форматирование кода
black backend/app/
isort backend/app/

# Проверка стиля
flake8 backend/app/
mypy backend/app/
```

### Структура коммитов

```bash
git commit -m "feat: добавить фильтрацию по дате"
git commit -m "fix: исправить ошибку парсинга timestamp"  
git commit -m "docs: обновить README"
git commit -m "refactor: оптимизировать SQL запросы"
```

---

## 📝 Лицензия

MIT License - подробности в файле [LICENSE](LICENSE)

---

## 🆘 Поддержка

- 📧 **Email**: support@terraform-log-viewer.com
- 💬 **Issues**: [GitHub Issues](https://github.com/username/terraform-log-viewer/issues)
- 📖 **Wiki**: [GitHub Wiki](https://github.com/username/terraform-log-viewer/wiki)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/username/terraform-log-viewer/discussions)

---

## 🎯 Roadmap

### v1.1 (Планируется)
- [ ] Система уведомлений
- [ ] Экспорт в PDF
- [ ] Темы оформления
- [ ] Многопользовательский режим

### v1.2 (Планируется)  
- [ ] Redis кэширование
- [ ] Elasticsearch интеграция
- [ ] Metrics и мониторинг
- [ ] REST API v2

### v2.0 (Будущее)
- [ ] Microservices архитектура
- [ ] Kubernetes deployment
- [ ] Machine Learning анализ
- [ ] Real-time обработка

---

## 📊 Статистика проекта

![Lines of Code](https://img.shields.io/badge/Lines%20of%20Code-5000+-blue)
![Python Version](https://img.shields.io/badge/Python-3.8+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-red)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

*Создано с ❤️ командой Terraform Log Viewer*