'use strict';

(() => {
  const STORAGE_KEY = 'todos_app_data';
  const filters = {
    all: () => true,
    active: (todo) => !todo.completed,
    completed: (todo) => todo.completed,
  };
  const emptyMessages = {
    all: ['Пока нет задач', 'Добавьте первое дело в поле выше.'],
    active: ['Нет активных задач', 'Добавьте новое дело или верните завершённое в список.'],
    completed: ['Нет завершённых задач', 'Отметьте задачу галочкой, и она появится здесь.'],
  };

  const addForm = document.querySelector('#add-form');
  const newTask = document.querySelector('#new-task');
  const filterGroup = document.querySelector('#filters');
  const taskList = document.querySelector('#task-list');
  const taskTemplate = document.querySelector('#task-template');
  const editorTemplate = document.querySelector('#editor-template');
  const emptyState = document.querySelector('#empty-state');
  const emptyTitle = document.querySelector('#empty-title');
  const emptyDescription = document.querySelector('#empty-description');
  const remaining = document.querySelector('#remaining');
  const clearCompleted = document.querySelector('#clear-completed');
  const storageStatus = document.querySelector('#storage-status');

  let todos = loadTodos();
  let filter = 'all';
  let editing = null;

  // Хранилище отделено от отрисовки. При ошибке интерфейс продолжает работать в памяти.
  function loadTodos() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (!Array.isArray(saved)) throw new TypeError('Expected an array of tasks');

      const ids = new Set();
      return saved.filter((todo) => {
        if (
          !todo || typeof todo.id !== 'string' || !todo.id || ids.has(todo.id) ||
          typeof todo.text !== 'string' || !todo.text.trim() ||
          typeof todo.completed !== 'boolean'
        ) {
          return false;
        }
        ids.add(todo.id);
        return true;
      });
    } catch {
      showStorageStatus('Не удалось загрузить сохранённые задачи.');
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      showStorageStatus('');
    } catch {
      showStorageStatus('Не удалось сохранить изменения. Они могут пропасть после перезагрузки.');
    }
  }

  function showStorageStatus(message) {
    storageStatus.textContent = message;
    storageStatus.hidden = !message;
  }

  function validateText(input) {
    const text = input.value.trim();
    if (!text) {
      input.setAttribute('aria-invalid', 'true');
      input.setCustomValidity('Введите текст задачи.');
      input.reportValidity();
    }
    return text;
  }

  function clearValidation(input) {
    input.removeAttribute('aria-invalid');
    input.setCustomValidity('');
  }

  // Отображаем текущий срез задач, а счётчик вычисляем по всему массиву.
  function render() {
    const visibleTodos = todos.filter(filters[filter]);
    const activeCount = todos.filter(filters.active).length;

    taskList.replaceChildren(...visibleTodos.map(createTaskRow));
    taskList.hidden = visibleTodos.length === 0;
    emptyState.hidden = visibleTodos.length > 0;
    [emptyTitle.textContent, emptyDescription.textContent] =
      emptyMessages[todos.length ? filter : 'all'];
    remaining.textContent = `Осталось: ${activeCount}`;
    clearCompleted.hidden = activeCount === todos.length;

    for (const button of filterGroup.querySelectorAll('[data-filter]')) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    }
  }

  function createTaskRow(todo) {
    const row = taskTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = row.querySelector('.task-check');
    const label = row.querySelector('.task-text');
    const editButton = row.querySelector('.edit-button');
    const deleteButton = row.querySelector('.delete-button');
    row.dataset.id = todo.id;

    label.textContent = todo.text;
    label.classList.toggle('is-completed', todo.completed);
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `Задача: ${todo.text}`);
    editButton.setAttribute('aria-label', `Редактировать задачу: ${todo.text}`);
    deleteButton.setAttribute('aria-label', `Удалить задачу: ${todo.text}`);

    checkbox.addEventListener('change', () => {
      todo.completed = checkbox.checked;
      saveTodos();
      render();
      focusTask(todo.id, '.task-check', filterGroup.querySelector('[aria-pressed="true"]'));
    });

    const startEditing = () => {
      editing = { id: todo.id, draft: todo.text };
      render();
      const input = focusTask(todo.id, '.task-input');
      input.select();
    };
    editButton.addEventListener('click', startEditing);
    label.addEventListener('dblclick', startEditing);

    deleteButton.addEventListener('click', () => {
      const nextRow = row.nextElementSibling ?? row.previousElementSibling;
      if (editing?.id === todo.id) editing = null;
      todos = todos.filter((item) => item.id !== todo.id);
      saveTodos();
      render();
      focusTask(nextRow?.dataset.id, '.delete-button');
    });

    if (editing?.id === todo.id) {
      label.replaceWith(createEditor(todo));
      editButton.hidden = true;
      deleteButton.hidden = true;
    }
    return row;
  }

  function createEditor(todo) {
    const form = editorTemplate.content.firstElementChild.cloneNode(true);
    const input = form.querySelector('input');
    input.value = editing.draft;

    function closeEditor() {
      editing = null;
      render();
      focusTask(todo.id, '.edit-button');
    }

    input.addEventListener('input', () => {
      editing.draft = input.value;
      clearValidation(input);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = validateText(input);
      if (!text) return;

      todo.text = text;
      saveTodos();
      closeEditor();
    });

    form.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        closeEditor();
      }
    });
    form.querySelector('.cancel-button').addEventListener('click', closeEditor);
    return form;
  }

  // После перерисовки возвращаем фокус в список или в поле добавления.
  function focusTask(id, selector, fallback = newTask) {
    const row = id && taskList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const control = row?.querySelector(selector);
    (control && !control.hidden ? control : fallback).focus();
    return control;
  }

  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = validateText(newTask);
    if (!text) return;

    const id = crypto.randomUUID?.() ??
      Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
    todos.push({ id, text, completed: false });
    if (filter === 'completed') filter = 'active';
    saveTodos();
    addForm.reset();
    render();
    newTask.focus();
  });
  newTask.addEventListener('input', () => clearValidation(newTask));

  filterGroup.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button || button.dataset.filter === filter) return;

    filter = button.dataset.filter;
    render();
  });

  clearCompleted.addEventListener('click', () => {
    todos = todos.filter(filters.active);
    if (!todos.some((todo) => todo.id === editing?.id)) editing = null;
    saveTodos();
    render();
    newTask.focus();
  });

  render();
})();
