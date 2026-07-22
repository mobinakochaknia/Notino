/* ═══════════════════════════════════════════════════════
   FOLIO — Notion Clone JavaScript
   Pure Vanilla JS — no external libraries whatsoever.
   Architecture: flat state object + render functions.
═══════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════
   STATE
══════════════════════════ */
let state = {
  notes: [],        // Array of note objects
  folders: [],      // Array of folder objects
  activeNoteId: null,
  searchQuery: '',
  sortBy: 'updated', // 'updated' | 'created' | 'title'
  theme: 'light',
  openFolders: {},   // folderId -> boolean
};

/* ══════════════════════════
   UNIQUE ID GENERATOR
══════════════════════════ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ══════════════════════════
   DATE HELPERS
══════════════════════════ */
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  // تبدیل به تاریخ شمسی با زبان فارسی
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'همین الان';
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  if (diffH < 24) return `${diffH} ساعت پیش`;
  if (diffD < 7) return `${diffD} روز پیش`;
  return formatDate(ts);
}

/* ══════════════════════════
   LOCAL STORAGE
══════════════════════════ */
function saveToStorage() {
  try {
    localStorage.setItem('folio_notes', JSON.stringify(state.notes));
    localStorage.setItem('folio_folders', JSON.stringify(state.folders));
    localStorage.setItem('folio_theme', state.theme);
    localStorage.setItem('folio_sort', state.sortBy);
    localStorage.setItem('folio_openFolders', JSON.stringify(state.openFolders));
  } catch (e) {
    console.warn('ذخیره‌سازی با خطا مواجه شد:', e);
  }
}

function loadFromStorage() {
  try {
    const notes = localStorage.getItem('folio_notes');
    const folders = localStorage.getItem('folio_folders');
    const theme = localStorage.getItem('folio_theme');
    const sort = localStorage.getItem('folio_sort');
    const openFolders = localStorage.getItem('folio_openFolders');

    if (notes) state.notes = JSON.parse(notes);
    if (folders) state.folders = JSON.parse(folders);
    if (theme) state.theme = theme;
    if (sort) state.sortBy = sort;
    if (openFolders) state.openFolders = JSON.parse(openFolders);
  } catch (e) {
    console.warn('بارگذاری داده‌ها با خطا مواجه شد:', e);
  }
}

/* ══════════════════════════
   MARKDOWN PARSER
   Manual implementation — no libraries.
══════════════════════════ */
function parseMarkdown(raw) {
  if (!raw) return '';

  const lines = raw.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  let inCodeBlock = false;
  let codeContent = '';

  // Helper: close open list tags
  function closeLists() {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  }

  // Inline formatting applied to a single line of text
  function inlineFormat(text) {
    // Escape HTML entities first
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code spans (before other formatting)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    text = text.replace(
    /\{color:(#[0-9a-fA-F]{3,6})\}([\s\S]*?)\{\/color\}/g,
    '<span style="color:$1">$2</span>'
  );

    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    return text;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Code block (triple backtick) ──
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        closeLists();
        inCodeBlock = true;
        codeContent = '';
      } else {
        // Closing fence
        html += '<pre><code>' + escapeHtml(codeContent.replace(/\n$/, '')) + '</code></pre>';
        inCodeBlock = false;
        codeContent = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    // ── Headings ──
    if (line.startsWith('# ')) {
      closeLists();
      html += `<h1>${inlineFormat(line.slice(2))}</h1>`;
      continue;
    }
    if (line.startsWith('## ')) {
      closeLists();
      html += `<h2>${inlineFormat(line.slice(3))}</h2>`;
      continue;
    }

    // ── Unordered list ──
    const ulMatch = line.match(/^[-*+] (.+)/);
    if (ulMatch) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${inlineFormat(ulMatch[1])}</li>`;
      continue;
    }

    // ── Ordered list ──
    const olMatch = line.match(/^\d+\. (.+)/);
    if (olMatch) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${inlineFormat(olMatch[1])}</li>`;
      continue;
    }

    // ── Blank line ──
    if (line.trim() === '') {
      closeLists();
      html += '';
      continue;
    }

    // ── Regular paragraph ──
    closeLists();
    html += `<p>${inlineFormat(line)}</p>`;
  }

  // Close any open tags at EOF
  closeLists();
  if (inCodeBlock && codeContent) {
    html += '<pre><code>' + escapeHtml(codeContent) + '</code></pre>';
  }

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════
   NOTE CRUD
══════════════════════════ */
function createNote(folderId = null) {
  const note = {
    id: uid(),
    title: '',
    content: '',
    folderId: folderId,
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.notes.unshift(note);
  saveToStorage();
  return note;
}

function updateNote(id, changes) {
  const idx = state.notes.findIndex(n => n.id === id);
  if (idx === -1) return;
  state.notes[idx] = { ...state.notes[idx], ...changes, updatedAt: Date.now() };
  saveToStorage();
  return state.notes[idx];
}

function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  if (state.activeNoteId === id) state.activeNoteId = null;
  saveToStorage();
}

function getNote(id) {
  return state.notes.find(n => n.id === id) || null;
}

/* ══════════════════════════
   FOLDER CRUD
══════════════════════════ */
function createFolder(name) {
  const folder = { id: uid(), name: name.trim(), createdAt: Date.now() };
  state.folders.push(folder);
  saveToStorage();
  return folder;
}

function renameFolder(id, name) {
  const folder = state.folders.find(f => f.id === id);
  if (folder) { folder.name = name.trim(); saveToStorage(); }
}

function deleteFolder(id) {
  // Move all notes in this folder to no folder
  state.notes.forEach(n => { if (n.folderId === id) n.folderId = null; });
  state.folders = state.folders.filter(f => f.id !== id);
  delete state.openFolders[id];
  saveToStorage();
}

function getFolder(id) {
  return state.folders.find(f => f.id === id) || null;
}

/* ══════════════════════════
   SORT & FILTER
══════════════════════════ */
function getSortedNotes(notes) {
  const arr = [...notes];
  switch (state.sortBy) {
    case 'title':
      arr.sort((a, b) => (a.title || 'بدون عنوان').localeCompare(b.title || 'بدون عنوان'));
      break;
    case 'created':
      arr.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'updated':
    default:
      arr.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return arr;
}

function getFilteredNotes() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) return state.notes;
  return state.notes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.content || '').toLowerCase().includes(q)
  );
}

/* ══════════════════════════
   DOM REFERENCES
══════════════════════════ */
const $ = id => document.getElementById(id);
const els = {
  sidebar: $('sidebar'),
  sidebarToggleBtn: $('sidebarToggleBtn'),
  mobileSidebarBtn: $('mobileSidebarBtn'),
  mobileThemeBtn: $('mobileThemeBtn'),
  themeToggleBtn: $('themeToggleBtn'),
  searchInput: $('searchInput'),
  searchClear: $('searchClear'),
  sortSelect: $('sortSelect'),
  newNoteBtn: $('newNoteBtn'),
  newFolderBtn: $('newFolderBtn'),
  welcomeNewNoteBtn: $('welcomeNewNoteBtn'),
  pinnedSection: $('pinnedSection'),
  pinnedList: $('pinnedList'),
  folderList: $('folderList'),
  noteList: $('noteList'),
  welcomeScreen: $('welcomeScreen'),
  editorContainer: $('editorContainer'),
  noteTitleInput: $('noteTitleInput'),
  noteContentInput: $('noteContentInput'),
  noteMeta: $('noteMeta'),
  markdownPreview: $('markdownPreview'),
  previewPane: $('previewPane'),
  writePane: $('writePane'),
  previewTitle: $('previewTitle'),
  previewMeta: $('previewMeta'),
  previewToggleBtn: $('previewToggleBtn'),
  pinNoteBtn: $('pinNoteBtn'),
  deleteNoteBtn: $('deleteNoteBtn'),
  folderAssignSelect: $('folderAssignSelect'),
  folderModal: $('folderModal'),
  folderModalTitle: $('folderModalTitle'),
  folderNameInput: $('folderNameInput'),
  closeFolderModal: $('closeFolderModal'),
  cancelFolderBtn: $('cancelFolderBtn'),
  saveFolderBtn: $('saveFolderBtn'),
  confirmModal: $('confirmModal'),
  confirmModalText: $('confirmModalText'),
  closeConfirmModal: $('closeConfirmModal'),
  cancelConfirmBtn: $('cancelConfirmBtn'),
  confirmDeleteBtn: $('confirmDeleteBtn'),
  exportBtn: $('exportBtn'),
  importInput: $('importInput'),
  toast: $('toast'),
  textColorPicker: $('textColorPicker'),
  colorIndicator: $('colorIndicator'),
};

/* ══════════════════════════
   PREVIEW STATE
══════════════════════════ */
let previewMode = false;

/* ══════════════════════════
   RENDER SIDEBAR
══════════════════════════ */
function renderSidebar() {
  renderFolderAssignSelect();
  renderPinnedNotes();
  renderFolderList();
  renderNoteList();
}

function renderPinnedNotes() {
  const filtered = getFilteredNotes();
  const pinned = getSortedNotes(filtered.filter(n => n.pinned));

  els.pinnedSection.style.display = pinned.length > 0 ? '' : 'none';
  els.pinnedList.innerHTML = '';

  pinned.forEach(note => {
    els.pinnedList.appendChild(buildNoteItem(note));
  });
}

function renderFolderList() {
  els.folderList.innerHTML = '';

  if (state.folders.length === 0) {
    els.folderList.innerHTML = '<li class="empty-state">هنوز پوشه‌ای وجود ندارد</li>';
    return;
  }

  const filtered = getFilteredNotes();

  state.folders.forEach(folder => {
    const folderNotes = getSortedNotes(filtered.filter(n => n.folderId === folder.id));
    const li = document.createElement('li');
    li.className = 'folder-item' + (state.openFolders[folder.id] ? ' open' : '');
    li.dataset.folderId = folder.id;

    li.innerHTML = `
      <div class="folder-header">
        <span class="folder-icon">📁</span>
        <span class="folder-name">${escHtml(folder.name)}</span>
        <span class="folder-count">${folderNotes.length}</span>
        <div class="folder-actions">
          <button class="note-action-btn folder-rename-btn" title="تغییر نام">✏</button>
          <button class="note-action-btn folder-delete-btn" title="حذف">✕</button>
        </div>
        <span class="folder-chevron">›</span>
      </div>
      <ul class="folder-notes note-list"></ul>
    `;

    const notesList = li.querySelector('.folder-notes');
    folderNotes.forEach(note => notesList.appendChild(buildNoteItem(note)));

    if (folderNotes.length === 0 && state.searchQuery) {
      notesList.innerHTML = '<li class="empty-state">نتیجه‌ای یافت نشد</li>';
    }
    const folderHeader = li.querySelector('.folder-header');
    folderHeader.addEventListener('dragover', (e) => {
  e.preventDefault();
});

    folderHeader.addEventListener('dragenter', () => {
      li.classList.add('drag-over');
    });

    folderHeader.addEventListener('dragleave', () => {
      li.classList.remove('drag-over');
    });

    folderHeader.addEventListener('drop', (e) => {
      e.preventDefault();

      li.classList.remove('drag-over');

      const noteId = e.dataTransfer.getData('text/plain');

      if (!noteId) return;

      updateNote(noteId, {
        folderId: folder.id
      });

      state.openFolders[folder.id] = true;

      renderSidebar();

      showToast('یادداشت منتقل شد');
    });
    // Toggle open/close
    folderHeader.addEventListener('click', (e) => {
      if (e.target.closest('.folder-actions')) return;
      state.openFolders[folder.id] = !state.openFolders[folder.id];
      saveToStorage();
      li.classList.toggle('open', !!state.openFolders[folder.id]);
    });

    // Rename
    li.querySelector('.folder-rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openFolderModal('rename', folder.id, folder.name);
    });

    // Delete
    li.querySelector('.folder-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openConfirmModal(
        `آیا پوشه "${folder.name}" حذف شود؟ یادداشت‌های داخل آن به دسته‌بندی‌نشده منتقل می‌شوند.`,
        () => {
          deleteFolder(folder.id);
          renderSidebar();
          showToast('پوشه حذف شد');
        }
      );
    });

    els.folderList.appendChild(li);
  });
}

function renderNoteList() {
  els.noteList.innerHTML = '';

  const filtered = getFilteredNotes();
  // Show only notes NOT in a folder and NOT pinned
  const standalone = getSortedNotes(filtered.filter(n => !n.folderId && !n.pinned));

  if (standalone.length === 0) {
    els.noteList.innerHTML = `<li class="empty-state">${state.searchQuery ? 'نتیجه‌ای یافت نشد' : 'هنوز یادداشتی وجود ندارد'}</li>`;
    return;
  }

  standalone.forEach(note => {
    els.noteList.appendChild(buildNoteItem(note));
  });
}

/* Build a note list item element */
function buildNoteItem(note) {
  const li = document.createElement('li');
  li.className = 'note-item' + (note.id === state.activeNoteId ? ' active' : '');
  li.dataset.noteId = note.id;
  li.draggable = true;

  const icon = note.pinned ? '📌' : '📄';
  const dateStr = formatDateShort(note.updatedAt);

  li.innerHTML = `
    <span class="note-item-icon">${icon}</span>
    <div class="note-item-body">
      <div class="note-item-title">${escHtml(note.title || 'بدون عنوان')}</div>
      <div class="note-item-date">${dateStr}</div>
    </div>
    <div class="note-item-actions">
      <button class="note-action-btn note-pin-btn" title="${note.pinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}">📌</button>
      <button class="note-action-btn note-del-btn" title="حذف">✕</button>
    </div>
  `;
  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', note.id);

    li.classList.add('dragging');
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
  });
  li.addEventListener('click', (e) => {
    if (e.target.closest('.note-item-actions')) return;
    openNote(note.id);
  });

  li.querySelector('.note-pin-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePin(note.id);
  });

  li.querySelector('.note-del-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openConfirmModal(
      `آیا یادداشت "${note.title || 'بدون عنوان'}" حذف شود؟ این عمل غیرقابل بازگشت است.`,
      () => {
        deleteNote(note.id);
        renderSidebar();
        if (state.activeNoteId === null) showWelcome();
        showToast('یادداشت حذف شد');
      }
    );
  });

  return li;
}

/* ══════════════════════════
   RENDER EDITOR
══════════════════════════ */
function openNote(id) {
  state.activeNoteId = id;
  const note = getNote(id);
  if (!note) return;

  // Show editor, hide welcome
  els.welcomeScreen.style.display = 'none';
  els.editorContainer.style.display = 'flex';

  // Populate fields
  els.noteTitleInput.value = note.title || '';
  els.noteContentInput.value = note.content || '';
  els.noteMeta.textContent = `ایجاد شده: ${formatDate(note.createdAt)} · آخرین ویرایش: ${formatDateShort(note.updatedAt)}`;

  // Pin button state
  els.pinNoteBtn.classList.toggle('pinned', note.pinned);
  els.pinNoteBtn.title = note.pinned ? 'برداشتن سنجاق از یادداشت' : 'سنجاق کردن یادداشت';

  // Folder assign select
  els.folderAssignSelect.value = note.folderId || '';

  // If in preview mode, refresh it
  if (previewMode) renderPreview(note);

  // Highlight in sidebar
  renderSidebar();

  // Close mobile sidebar
  closeMobileSidebar();

  // Focus editor
  els.noteTitleInput.focus();
}

function showWelcome() {
  state.activeNoteId = null;
  els.welcomeScreen.style.display = '';
  els.editorContainer.style.display = 'none';
  renderSidebar();
}

function renderPreview(note) {
  note = note || getNote(state.activeNoteId);
  if (!note) return;
  els.previewTitle.textContent = note.title || 'بدون عنوان';
  els.previewMeta.textContent = `ایجاد شده: ${formatDate(note.createdAt)} · آخرین ویرایش: ${formatDateShort(note.updatedAt)}`;
  els.markdownPreview.innerHTML = parseMarkdown(note.content || '');
}

/* ══════════════════════════
   FOLDER ASSIGN SELECT
══════════════════════════ */
function renderFolderAssignSelect() {
  const val = els.folderAssignSelect.value;
  els.folderAssignSelect.innerHTML = '<option value="">بدون پوشه</option>';
  state.folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    els.folderAssignSelect.appendChild(opt);
  });
  els.folderAssignSelect.value = val;
}

/* ══════════════════════════
   TOGGLE PIN
══════════════════════════ */
function togglePin(id) {
  const note = getNote(id);
  if (!note) return;
  updateNote(id, { pinned: !note.pinned });
  if (state.activeNoteId === id) {
    els.pinNoteBtn.classList.toggle('pinned', !note.pinned);
    els.pinNoteBtn.title = !note.pinned ? 'برداشتن سنجاق از یادداشت' : 'سنجاق کردن یادداشت';
  }
  renderSidebar();
  showToast(note.pinned ? 'سنجاق یادداشت برداشته شد' : 'یادداشت سنجاق شد');
}

/* ══════════════════════════
   AUTOSAVE (debounced)
══════════════════════════ */
let saveTimer = null;

function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!state.activeNoteId) return;
    updateNote(state.activeNoteId, {
      title: els.noteTitleInput.value,
      content: els.noteContentInput.value,
    });
    renderSidebar();
    if (previewMode) renderPreview();
  }, 400);
}

/* ══════════════════════════
   MODAL HELPERS
══════════════════════════ */
let folderModalMode = null;    // 'new' | 'rename'
let folderModalTargetId = null;

function openFolderModal(mode, id = null, currentName = '') {
  folderModalMode = mode;
  folderModalTargetId = id;
  els.folderModalTitle.textContent = mode === 'rename' ? 'تغییر نام پوشه' : 'پوشه جدید';
  els.folderNameInput.value = currentName;
  els.folderModal.style.display = 'flex';
  setTimeout(() => els.folderNameInput.focus(), 80);
}

function closeFolderModal() {
  els.folderModal.style.display = 'none';
  folderModalMode = null;
  folderModalTargetId = null;
}

function saveFolderModal() {
  const name = els.folderNameInput.value.trim();
  if (!name) { showToast('نام پوشه نمی‌تواند خالی باشد'); return; }

  if (folderModalMode === 'new') {
    createFolder(name);
    showToast(`پوشه "${name}" ایجاد شد`);
  } else if (folderModalMode === 'rename') {
    renameFolder(folderModalTargetId, name);
    showToast('نام پوشه تغییر یافت');
  }

  closeFolderModal();
  renderSidebar();
}

let confirmCallback = null;

function openConfirmModal(message, callback) {
  els.confirmModalText.textContent = message;
  confirmCallback = callback;
  els.confirmModal.style.display = 'flex';
}

function closeConfirmModal() {
  els.confirmModal.style.display = 'none';
  confirmCallback = null;
}

/* ══════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════ */
let toastTimer = null;

function showToast(message, duration = 2200) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), duration);
}

/* ══════════════════════════
   THEME
══════════════════════════ */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const icon = theme === 'dark' ? '☀' : '☽';
  els.themeToggleBtn.textContent = icon;
  els.mobileThemeBtn.textContent = icon;
  saveToStorage();
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/* ══════════════════════════
   EXPORT / IMPORT
══════════════════════════ */
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: state.notes,
    folders: state.folders,
    settings: { theme: state.theme, sortBy: state.sortBy },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `folio-export-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('داده‌ها با موفقیت استخراج شدند');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.notes || !Array.isArray(data.notes)) throw new Error('فرمت نامعتبر');

      state.notes = data.notes || [];
      state.folders = data.folders || [];
      if (data.settings) {
        if (data.settings.theme) applyTheme(data.settings.theme);
        if (data.settings.sortBy) state.sortBy = data.settings.sortBy;
      }
      state.activeNoteId = null;

      saveToStorage();
      renderSidebar();
      showWelcome();
      showToast(`${state.notes.length} یادداشت و ${state.folders.length} پوشه وارد شد`);
    } catch (err) {
      showToast('خطا در بارگذاری: فایل JSON نامعتبر است');
    }
  };
  reader.readAsText(file);
}

/* ══════════════════════════
   MOBILE SIDEBAR
══════════════════════════ */
let sidebarOverlay = null;

function openMobileSidebar() {
  els.sidebar.classList.add('mobile-open');
  if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay visible';
    sidebarOverlay.addEventListener('click', closeMobileSidebar);
    document.body.appendChild(sidebarOverlay);
  } else {
    sidebarOverlay.classList.add('visible');
  }
}

function closeMobileSidebar() {
  els.sidebar.classList.remove('mobile-open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
}
function applyList(type) {
  const ta = els.noteContentInput;

  const start = ta.selectionStart;
  const end = ta.selectionEnd;

  const val = ta.value;
  const selected = val.slice(start, end);

  const lines = selected.split('\n');

  let formatted = '';

  if (type === 'ul') {
    formatted = lines
      .map(line => `- ${line}`)
      .join('\n');
  }

  if (type === 'ol') {
    formatted = lines
      .map((line, i) => `${i + 1}. ${line}`)
      .join('\n');
  }

  ta.value =
    val.slice(0, start) +
    formatted +
    val.slice(end);

  ta.focus();

  ta.setSelectionRange(
    start,
    start + formatted.length
  );

  scheduleAutosave();
}
/* ══════════════════════════
   TEXT FORMATTING (execCommand)
══════════════════════════ */
function applyFormat(cmd) {
  // execCommand works on contenteditable; for textarea we do manual wrap
  const ta = els.noteContentInput;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end);
  const val = ta.value;

  let wrap = '';
  if (cmd === 'bold') wrap = '**';
  else if (cmd === 'italic') wrap = '*';
  else if (cmd === 'underline') wrap = '__';

  if (!wrap) return;

  const before = val.slice(0, start);
  const after = val.slice(end);
  const newVal = before + wrap + (sel || 'متن') + wrap + after;
  ta.value = newVal;
  // Restore selection inside wrapping chars
  const newSelStart = start + wrap.length;
  const newSelEnd = newSelStart + (sel || 'متن').length;
  ta.setSelectionRange(newSelStart, newSelEnd);
  ta.focus();
  scheduleAutosave();
}



function applyTextColor(color) {
  const ta = els.noteContentInput;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end);
  const val = ta.value;

  const text = sel || 'متن';

  // فرمت اختصاصی
  const colorTag = `{color:${color}}${text}{/color}`;

  const newVal =
    val.slice(0, start) +
    colorTag +
    val.slice(end);

  ta.value = newVal;

  const pos = start + colorTag.length;
  ta.setSelectionRange(pos, pos);
  ta.focus();

  scheduleAutosave();
}
/* ══════════════════════════
   ESCAPE HTML FOR DISPLAY
   (different from markdown escaping)
══════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════
   EVENT LISTENERS
══════════════════════════ */
function initEvents() {

  /* ── New Note ── */
  els.newNoteBtn.addEventListener('click', () => {
    const note = createNote();
    renderSidebar();
    openNote(note.id);
  });

  els.welcomeNewNoteBtn.addEventListener('click', () => {
    const note = createNote();
    renderSidebar();
    openNote(note.id);
  });

  /* ── New Folder ── */
  els.newFolderBtn.addEventListener('click', () => openFolderModal('new'));

  /* ── Folder Modal ── */
  els.closeFolderModal.addEventListener('click', closeFolderModal);
  els.cancelFolderBtn.addEventListener('click', closeFolderModal);
  els.saveFolderBtn.addEventListener('click', saveFolderModal);
  els.folderNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveFolderModal(); });
  els.folderModal.addEventListener('click', (e) => { if (e.target === els.folderModal) closeFolderModal(); });

  /* ── Confirm Modal ── */
  els.closeConfirmModal.addEventListener('click', closeConfirmModal);
  els.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
  els.confirmDeleteBtn.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
  });
  els.confirmModal.addEventListener('click', (e) => { if (e.target === els.confirmModal) closeConfirmModal(); });

  /* ── Search ── */
  els.searchInput.addEventListener('input', () => {
    state.searchQuery = els.searchInput.value;
    els.searchClear.classList.toggle('visible', !!state.searchQuery);
    renderSidebar();
  });

  els.searchClear.addEventListener('click', () => {
    state.searchQuery = '';
    els.searchInput.value = '';
    els.searchClear.classList.remove('visible');
    renderSidebar();
  });

  /* ── Sort ── */
  els.sortSelect.addEventListener('change', () => {
    state.sortBy = els.sortSelect.value;
    saveToStorage();
    renderSidebar();
  });

  /* ── Editor: Title ── */
  els.noteTitleInput.addEventListener('input', scheduleAutosave);

  /* ── Editor: Content ── */
  els.noteContentInput.addEventListener('input', scheduleAutosave);

  /* ── Editor: Keyboard shortcuts ── */
  els.noteContentInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); applyFormat('bold'); }
      else if (e.key === 'i') { e.preventDefault(); applyFormat('italic'); }
      else if (e.key === 'u') { e.preventDefault(); applyFormat('underline'); }
    }
  });

  /* ── Toolbar buttons ── */
  document.querySelectorAll('.tool-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => applyFormat(btn.dataset.cmd));
  });


    /* ── Color picker (اصلاح شده) ── */
  els.textColorPicker.addEventListener('input', () => {
    // این خط فقط رنگ آیکون A را در تولبار عوض می‌کند
    els.colorIndicator.style.color = els.textColorPicker.value;
  });

  document.querySelectorAll('.tool-btn[data-list]').forEach(btn => {
  btn.addEventListener('click', () => {
    applyList(btn.dataset.list);
  });
});

  els.textColorPicker.addEventListener('change', () => {
    // این خط تابع اصلی برای اعمال رنگ به متن را صدا می‌زند
    applyTextColor(els.textColorPicker.value);
  });

  /* ── Preview toggle ── */
  els.previewToggleBtn.addEventListener('click', () => {
    previewMode = !previewMode;
    els.previewPane.style.display = previewMode ? '' : 'none';
    els.writePane.style.display = previewMode ? 'none' : '';
    els.previewToggleBtn.textContent = previewMode ? '✏ ویرایش' : '⊙ پیش‌نمایش';
    if (previewMode) renderPreview();
  });

  /* ── Pin Note ── */
  els.pinNoteBtn.addEventListener('click', () => {
    if (state.activeNoteId) togglePin(state.activeNoteId);
  });

  /* ── Delete Note ── */
  els.deleteNoteBtn.addEventListener('click', () => {
    if (!state.activeNoteId) return;
    const note = getNote(state.activeNoteId);
    openConfirmModal(
      `آیا یادداشت "${note?.title || 'بدون عنوان'}" حذف شود؟ این عمل غیرقابل بازگشت است.`,
      () => {
        deleteNote(state.activeNoteId);
        renderSidebar();
        showWelcome();
        showToast('یادداشت حذف شد');
      }
    );
  });

  /* ── Folder Assign ── */
  els.folderAssignSelect.addEventListener('change', () => {
    if (!state.activeNoteId) return;
    const folderId = els.folderAssignSelect.value || null;
    updateNote(state.activeNoteId, { folderId });
    // Open the target folder in sidebar
    if (folderId) state.openFolders[folderId] = true;
    renderSidebar();
    showToast(folderId ? 'یادداشت به پوشه منتقل شد' : 'یادداشت از پوشه خارج شد');
  });

  /* ── Theme ── */
  els.themeToggleBtn.addEventListener('click', toggleTheme);
  els.mobileThemeBtn.addEventListener('click', toggleTheme);

  /* ── Sidebar collapse (desktop) ── */
  els.sidebarToggleBtn.addEventListener('click', () => {
    els.sidebar.classList.toggle('collapsed');
  });

  /* ── Mobile sidebar ── */
  els.mobileSidebarBtn.addEventListener('click', openMobileSidebar);

  /* ── Export ── */
  els.exportBtn.addEventListener('click', exportData);

  /* ── Import ── */
  els.importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = ''; // Reset so same file can be re-imported
  });

  /* ── Global keyboard: Escape closes modals ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      closeFolderModal();
      closeMobileSidebar();
    }
  });
}

/* ══════════════════════════
   INITIALISE APP
══════════════════════════ */
function init() {
  // Load persisted data
  loadFromStorage();

  // Apply saved theme
  applyTheme(state.theme);

  // Apply saved sort
  els.sortSelect.value = state.sortBy;

  // Wire up all event listeners
  initEvents();

  // Render sidebar
  renderSidebar();

  // Show last active note or welcome screen
  if (state.activeNoteId && getNote(state.activeNoteId)) {
    openNote(state.activeNoteId);
  } else {
    showWelcome();
  }

  // Ensure sections are scrollable by wrapping them
  wrapSidebarSections();
}

/* Wrap sidebar sections in a scrollable container */
function wrapSidebarSections() {
  const sidebar = els.sidebar;
  // Gather sections that need to scroll together
  const toWrap = [
    $('pinnedSection'),
    $('foldersSection'),
    sidebar.querySelectorAll('.sidebar-section')[2], // Notes section
  ];

  const wrapper = document.createElement('div');
  wrapper.className = 'sidebar-sections-scroll';

  const footer = sidebar.querySelector('.sidebar-footer');
  const firstSection = $('pinnedSection');
  sidebar.insertBefore(wrapper, firstSection);

  toWrap.forEach(el => { if (el) wrapper.appendChild(el); });
}

/* ══════════════════════════
   BOOT
══════════════════════════ */
document.addEventListener('DOMContentLoaded', init);