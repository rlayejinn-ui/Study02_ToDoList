// ===== 상수 =====
const CATEGORIES = {
  work: '업무',
  personal: '개인',
  study: '공부',
};
const MAX_LENGTH = 100;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const FILTERS = ['all', ...Object.keys(CATEGORIES)];
const STORAGE_KEYS = {
  todos: 'todos',
  lastCategory: 'todoLastCategory',
  filter: 'todoFilter',
};

// ===== 상태 (화면은 항상 이 값들을 기준으로 그린다) =====
let todos = loadTodos();
let currentFilter = loadSetting(STORAGE_KEYS.filter, FILTERS, 'all');
let editingId = null; // 수정 중인 할 일 id (화면 상태라 저장하지 않음)

// ===== DOM 요소 =====
const todayEl = document.getElementById('today');
const formEl = document.getElementById('todo-form');
const inputEl = document.getElementById('todo-input');
const categorySelectEl = document.getElementById('category-select');
const listEl = document.getElementById('todo-list');
const emptyStateEl = document.getElementById('empty-state');
const filtersEl = document.getElementById('filters');
const progressEl = document.getElementById('progress');
const progressTextEl = document.getElementById('progress-text');
const progressBarEl = document.getElementById('progress-bar');
const progressFillEl = document.getElementById('progress-fill');
const categoryProgressEl = document.getElementById('category-progress');
const clearCompletedEl = document.getElementById('clear-completed');

// ===== 저장소 (localStorage) =====
function isValidTodo(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    item.category in CATEGORIES &&
    typeof item.completed === 'boolean'
  );
}

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.todos);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('배열이 아닙니다');
    return parsed.filter(isValidTodo);
  } catch (error) {
    // 저장 데이터가 손상돼도 앱은 빈 목록으로 계속 동작한다
    console.warn('저장된 할 일을 불러오지 못해 빈 목록으로 시작합니다.', error);
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
  } catch (error) {
    console.warn('할 일을 저장하지 못했습니다.', error);
  }
}

// 마지막 필터·카테고리 같은 편의 설정 (허용된 값이 아니면 기본값 사용)
function loadSetting(key, allowed, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return allowed.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 무시 (편의 기능)
  }
}

// ===== 상태 변경 함수 =====
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addTodo(text, category) {
  const trimmed = text.trim().slice(0, MAX_LENGTH);
  if (!trimmed) return false;

  todos.unshift({
    id: createId(),
    text: trimmed,
    category,
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  });
  return true;
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
}

function clearCompleted() {
  todos = todos.filter((todo) => !todo.completed);
}

function updateTodo(id, { text, category }) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return false;

  const trimmed = text.trim().slice(0, MAX_LENGTH);
  if (!trimmed) return false; // 빈 내용이면 저장하지 않고 원래 값 유지

  todo.text = trimmed;
  if (category in CATEGORIES) todo.category = category;
  return true;
}

function toggleTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? Date.now() : null;
}

function setFilter(filter) {
  currentFilter = filter;
  saveSetting(STORAGE_KEYS.filter, filter);

  // 카테고리 탭을 보는 중이면 새 할 일도 그 카테고리로 입력되도록 맞춘다
  if (filter in CATEGORIES) setInputCategory(filter);
}

function setInputCategory(category) {
  categorySelectEl.value = category;
  saveSetting(STORAGE_KEYS.lastCategory, category);
}

// 완료 수 / 전체 수 / 퍼센트 (할 일이 없으면 0%)
function getProgress(list) {
  const total = list.length;
  const done = list.filter((todo) => todo.completed).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

function isVisible(todo) {
  return currentFilter === 'all' || todo.category === currentFilter;
}

// 모든 상태 변경 뒤에는 저장 → 다시 그리기
function commit() {
  saveTodos();
  render();
}

// ===== 수정 모드 =====
function startEdit(id) {
  editingId = id;
  render();
  const input = listEl.querySelector('.edit-input');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function saveEdit(li) {
  const id = li.dataset.id;
  const changed = updateTodo(id, {
    text: li.querySelector('.edit-input').value,
    category: li.querySelector('.edit-category').value,
  });
  editingId = null;
  if (changed) saveTodos();
  render();
  focusEditButton(id);
}

function cancelEdit(id) {
  editingId = null;
  render();
  focusEditButton(id);
}

// 수정을 마치면 키보드 사용자가 제자리에서 계속 작업할 수 있도록 포커스를 돌려준다
function focusEditButton(id) {
  listEl.querySelector(`.todo-item[data-id="${CSS.escape(id)}"] [data-action="edit"]`)?.focus();
}

// ===== 렌더링 =====
function createTodoItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item';
  if (todo.completed) li.classList.add('is-completed');
  li.dataset.id = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-check';
  checkbox.checked = todo.completed;
  checkbox.setAttribute('aria-label', `${todo.text} 완료`);

  const badge = document.createElement('span');
  badge.className = `badge badge-${todo.category}`;
  badge.textContent = CATEGORIES[todo.category];

  // 사용자 입력은 반드시 textContent로 출력 (XSS 방지)
  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = todo.text;

  const actions = document.createElement('div');
  actions.className = 'todo-actions';
  actions.append(
    createButton('edit', '✏️', 'icon-btn', '수정'),
    createButton('delete', '🗑️', 'icon-btn', '삭제'),
  );

  li.append(checkbox, badge, text, actions);
  return li;
}

// draft: 다시 그리기 직전까지 입력하던 값 (있으면 원래 값 대신 사용)
function createEditItem(todo, draft) {
  const li = document.createElement('li');
  li.className = 'todo-item is-editing';
  li.dataset.id = todo.id;

  const select = document.createElement('select');
  select.className = 'category-select edit-category';
  select.setAttribute('aria-label', '카테고리 수정');
  const category = draft?.category ?? todo.category;
  for (const [value, label] of Object.entries(CATEGORIES)) {
    select.append(new Option(label, value, false, value === category));
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.maxLength = MAX_LENGTH;
  input.value = draft?.text ?? todo.text;
  input.setAttribute('aria-label', '할 일 수정');

  const actions = document.createElement('div');
  actions.className = 'todo-actions';
  actions.append(
    createButton('save', '저장', 'btn btn-primary btn-sm'),
    createButton('cancel', '취소', 'btn btn-sm'),
  );

  li.append(select, input, actions);
  return li;
}

function createButton(action, content, className, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.action = action;
  if (label) button.setAttribute('aria-label', label);
  button.textContent = content;
  return button;
}

// 미완료 항목을 위로, 완료 항목을 아래로 (각 그룹 안에서는 원래 순서 유지)
function sortForDisplay(list) {
  return [...list.filter((todo) => !todo.completed), ...list.filter((todo) => todo.completed)];
}

// 다른 항목 체크 등으로 목록을 다시 그려도 수정 중이던 입력값을 잃지 않도록 읽어 둔다
function readEditDraft() {
  const li = listEl.querySelector('.todo-item.is-editing');
  if (!li) return null;
  return {
    id: li.dataset.id,
    text: li.querySelector('.edit-input').value,
    category: li.querySelector('.edit-category').value,
  };
}

// 목록을 다시 그리면 DOM이 새로 만들어지므로, 포커스 위치를 기억했다가 복원한다
function rememberFocus() {
  const el = document.activeElement;
  const li = el?.closest('.todo-item');
  if (!li || !listEl.contains(li)) return null;
  return {
    id: li.dataset.id,
    selector: el.dataset.action ? `[data-action="${el.dataset.action}"]` : `.${el.classList[0]}`,
    caret: el.selectionStart ?? null,
  };
}

function restoreFocus(saved) {
  if (!saved) return;
  const el = listEl.querySelector(`.todo-item[data-id="${CSS.escape(saved.id)}"] ${saved.selector}`);
  if (!el) return;
  el.focus();
  if (saved.caret !== null) el.setSelectionRange(saved.caret, saved.caret);
}

function render() {
  // 수정 중이던 항목이 삭제됐으면 수정 상태도 정리
  if (editingId && !todos.some((todo) => todo.id === editingId)) editingId = null;

  const draft = readEditDraft();
  const focus = rememberFocus();

  const visible = sortForDisplay(todos.filter(isVisible));
  const items = visible.map((todo) =>
    todo.id === editingId
      ? createEditItem(todo, draft?.id === todo.id ? draft : null)
      : createTodoItem(todo),
  );
  listEl.replaceChildren(...items);
  renderEmptyState(visible.length);
  renderFilters();
  renderProgress();
  renderClearCompleted();

  restoreFocus(focus);
}

function renderClearCompleted() {
  const count = todos.filter((todo) => todo.completed).length;
  clearCompletedEl.disabled = count === 0;
  clearCompletedEl.textContent = count > 0 ? `완료 항목 삭제 (${count})` : '완료 항목 삭제';
}

// 삭제 후 포커스가 사라지지 않도록 같은 자리(없으면 바로 위) 항목으로, 목록이 비면 입력창으로 옮긴다
function focusItemAt(index) {
  const items = listEl.querySelectorAll('.todo-item');
  const target = items[Math.min(index, items.length - 1)];
  (target?.querySelector('[data-action="delete"]') ?? inputEl).focus();
}

function renderEmptyState(visibleCount) {
  emptyStateEl.hidden = visibleCount > 0;
  emptyStateEl.textContent =
    todos.length === 0
      ? '할 일을 추가해 보세요 ✨'
      : `${CATEGORIES[currentFilter]} 할 일이 없어요.`;
}

// 진행률은 필터와 관계없이 항상 전체 할 일 기준
function renderProgress() {
  const { done, total, percent } = getProgress(todos);
  const isAllDone = total > 0 && done === total;

  progressTextEl.textContent = isAllDone
    ? `🎉 모두 완료! ${done} / ${total} (100%)`
    : `${done} / ${total} 완료 (${percent}%)`;
  progressFillEl.style.width = `${percent}%`;
  progressBarEl.setAttribute('aria-valuenow', String(percent));
  progressBarEl.setAttribute('aria-valuetext', `${total}개 중 ${done}개 완료, ${percent}%`);
  progressEl.classList.toggle('is-complete', isAllDone);

  for (const category of Object.keys(CATEGORIES)) {
    const stats = getProgress(todos.filter((todo) => todo.category === category));
    categoryProgressEl.querySelector(`[data-category="${category}"] strong`).textContent =
      `${stats.done}/${stats.total}`;
  }
}

function renderFilters() {
  for (const button of filtersEl.querySelectorAll('.filter-btn')) {
    const filter = button.dataset.filter;
    const isActive = filter === currentFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));

    const count = filter === 'all'
      ? todos.length
      : todos.filter((todo) => todo.category === filter).length;
    button.querySelector('.count').textContent = count;
  }
}

function renderToday() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  todayEl.textContent = `${yyyy}.${mm}.${dd} (${WEEKDAYS[now.getDay()]})`;
  todayEl.dateTime = `${yyyy}-${mm}-${dd}`;
}

// ===== 이벤트 =====
formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const category = categorySelectEl.value;
  if (addTodo(inputEl.value, category)) {
    // 지금 필터에서 안 보이는 카테고리로 추가했다면 '전체'로 바꿔 방금 추가한 항목이 보이게 한다
    if (currentFilter !== 'all' && currentFilter !== category) setFilter('all');
    commit();
  }
  inputEl.value = '';
  inputEl.focus();
});

// 목록 버튼은 이벤트 위임으로 처리
listEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const li = button.closest('.todo-item');
  const id = li.dataset.id;
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  switch (button.dataset.action) {
    case 'edit':
      startEdit(id);
      break;
    case 'delete':
      if (confirm(`'${todo.text}' 할 일을 삭제할까요?`)) {
        const index = [...listEl.children].indexOf(li);
        deleteTodo(id);
        commit();
        focusItemAt(index);
      }
      break;
    case 'save':
      saveEdit(li);
      break;
    case 'cancel':
      cancelEdit(id);
      break;
  }
});

// 글자를 더블클릭해도 수정 모드로
listEl.addEventListener('dblclick', (event) => {
  const text = event.target.closest('.todo-text');
  if (!text) return;
  startEdit(text.closest('.todo-item').dataset.id);
});

// 수정 중 Enter → 저장, Esc → 취소
listEl.addEventListener('keydown', (event) => {
  const li = event.target.closest('.todo-item.is-editing');
  if (!li) return;
  // 한글 입력 조합 중의 Enter는 무시 (조합 완료용 Enter가 저장으로 두 번 처리되는 것 방지)
  if (event.isComposing || event.keyCode === 229) return;

  if (event.key === 'Enter' && !event.target.matches('button')) {
    event.preventDefault();
    saveEdit(li);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelEdit(li.dataset.id);
  }
});

// 체크박스는 change 이벤트로 완료 상태 토글
listEl.addEventListener('change', (event) => {
  if (!event.target.matches('.todo-check')) return;
  const id = event.target.closest('.todo-item').dataset.id;
  toggleTodo(id);
  commit();
});

// 마지막으로 고른 카테고리를 기억해 다음 입력의 기본값으로 사용
categorySelectEl.addEventListener('change', () => {
  saveSetting(STORAGE_KEYS.lastCategory, categorySelectEl.value);
});

clearCompletedEl.addEventListener('click', () => {
  const count = todos.filter((todo) => todo.completed).length;
  if (count === 0) return;
  if (confirm(`완료한 할 일 ${count}개를 삭제할까요?`)) {
    clearCompleted();
    commit();
    inputEl.focus();
  }
});

filtersEl.addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (!button) return;
  setFilter(button.dataset.filter);
  render();
});

// ===== 시작 =====
categorySelectEl.value = loadSetting(STORAGE_KEYS.lastCategory, Object.keys(CATEGORIES), 'work');
renderToday();
render();
