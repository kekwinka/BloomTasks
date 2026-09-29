import {
  createInitialState,
  setFilter,
  setSelectedFlower,
  addTask,
  updateTask,
  placeTaskInCube,
  deleteTask,
  completeTask,
  getUnplacedTasks,
  getTaskById,
  isCubeFree,
  areAllCubesOccupied,
} from './state.js';

import {
  FLOWER_TYPES,
  getFlowerMeta,
  calcWiltingState,
  matchesFilter,
  formatTimeLeft,
  formatDeadline,
  formatCompletedDate,
  wiltLabel,
} from './flowers.js';

let state = createInitialState();
let tooltipTaskId = null;
let tooltipAnchorEl = null;
let tipHideTimer = null;
let toastTimer = null;
let tickTimer = null;
let editDraftFlower = null;

const DRAG_THRESHOLD = 8;
const TIP_HIDE_MS = 60;

/** @type {Record<string, string>} */
const svgCache = {};

/** @type {null | {
 *  taskId: string,
 *  sourceEl: HTMLElement,
 *  ghost: HTMLElement | null,
 *  pointerId: number,
 *  startX: number,
 *  startY: number,
 *  moved: boolean,
 *  fromCube: boolean,
 *  cubeId: number | null,
 * }} */
let drag = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const els = {
  body: document.body,
  cubesContainer: $('#cubesContainer'),
  nursery: $('#nursery'),
  nurseryFlowers: $('#nurseryFlowers'),
  nurseryHint: $('#nurseryHint'),
  fabContainer: $('#fabContainer'),
  addOverlay: $('#addModalOverlay'),
  editOverlay: $('#editModalOverlay'),
  herbariumOverlay: $('#herbariumModalOverlay'),
  addForm: $('#addTaskForm'),
  flowerGrid: $('#flowerGrid'),
  selectedPreview: $('#selectedFlowerPreview'),
  tasksList: $('#tasksManagementList'),
  herbariumGrid: $('#herbariumGrid'),
  tooltip: $('#flowerTooltip'),
  tipTitle: $('#tipTitle'),
  tipDesc: $('#tipDesc'),
  tipDeadline: $('#tipDeadline'),
  tipTimer: $('#tipTimer'),
  harvestBtn: $('#harvestBtn'),
  tipEditBtn: $('#tipEditBtn'),
  sparkleLayer: $('#sparkleLayer'),
  dragLayer: $('#dragLayer'),
  toast: $('#toast'),
};

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toDatetimeLocal = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const showToast = (message) => {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 3200);
};

const openModal = (overlay) => overlay.classList.add('active');
const closeModal = (overlay) => overlay.classList.remove('active');

const preloadFlowerSvgs = () =>
  Promise.all(
    FLOWER_TYPES.map(async (f) => {
      try {
        const res = await fetch(f.src);
        svgCache[f.id] = await res.text();
      } catch {
        svgCache[f.id] = '';
      }
    })
  );

const uniquifySvgIds = (svgText, uid) =>
  svgText
    .replace(/\bid="([^"]+)"/g, `id="${uid}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`);

const flowerMarkup = (flowerType, uid = `f${Math.random().toString(36).slice(2, 9)}`) => {
  const cached = svgCache[flowerType];
  if (cached) return uniquifySvgIds(cached, uid);
  const meta = getFlowerMeta(flowerType);
  return `<img src="${meta.src}" alt="">`;
};


/* ---------- Render ---------- */

const createFlowerElement = (task) => {
  const wilt = calcWiltingState(task);
  const el = document.createElement('div');
  el.className = `flower-item state-${wilt}`;
  el.dataset.taskId = task.id;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', task.title);
  el.innerHTML = flowerMarkup(task.flowerType, task.id.replace(/[^a-zA-Z0-9]/g, ''));
  return el;
};

const renderFlowerGridInto = (container, selectedId = null) => {
  container.innerHTML = FLOWER_TYPES.map(
    (f) => `
      <button type="button" class="flower-option ${f.id === selectedId ? 'selected' : ''}" data-flower="${f.id}" role="option" aria-label="${f.name}">
        <img src="${f.src}" alt="">
      </button>
    `
  ).join('');
};

const renderFlowerGrid = () => renderFlowerGridInto(els.flowerGrid);

const renderCubes = () => {
  $$('.cube').forEach((cube) => {
    const cubeId = Number(cube.dataset.cubeId);
    const slot = cube.querySelector('.flower-slot');
    const task = state.tasks.find(
      (t) => t.status === 'active' && t.cubeId === cubeId
    );

    const keepGhost =
      drag &&
      drag.fromCube &&
      drag.cubeId === cubeId &&
      slot.querySelector(`[data-task-id="${drag.taskId}"]`);

    if (keepGhost) return;

    slot.innerHTML = '';

    if (task) {
      const flower = createFlowerElement(task);
      const dimmed = !matchesFilter(task, state.filter);
      cube.classList.toggle('filtered-out', dimmed);
      cube.classList.toggle('occupied', true);
      slot.appendChild(flower);
    } else {
      cube.classList.toggle('filtered-out', state.filter !== 'all');
      cube.classList.remove('occupied');
    }
  });
};

const renderNursery = () => {
  const unplaced = getUnplacedTasks(state);
  els.nurseryFlowers.innerHTML = '';

  if (unplaced.length === 0) {
    els.nursery.classList.remove('visible');
    return;
  }

  els.nursery.classList.add('visible');
  els.nurseryHint.textContent = areAllCubesOccupied(state)
    ? 'Все кубы заняты'
    : 'Перетащите в свободный куб';

  unplaced.forEach((task) => {
    if (drag && drag.taskId === task.id) return;
    const wrap = document.createElement('div');
    wrap.className = 'nursery-item';
    wrap.classList.toggle('filtered-out', !matchesFilter(task, state.filter));
    wrap.appendChild(createFlowerElement(task));
    els.nurseryFlowers.appendChild(wrap);
  });
};

const renderHerbarium = () => {
  if (state.herbarium.length === 0) {
    els.herbariumGrid.innerHTML = `
      <div class="herbarium-empty">
        <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
          <path d="M40 70 V38" stroke="#A89078" stroke-width="3" stroke-linecap="round"/>
          <path d="M40 50 C28 44 18 48 14 56" stroke="#A89078" stroke-width="2" fill="none"/>
          <ellipse cx="40" cy="28" rx="16" ry="18" fill="#C8B49A" opacity="0.55"/>
          <ellipse cx="40" cy="28" rx="8" ry="10" fill="#D8C8B0" opacity="0.7"/>
        </svg>
        <p>Гербарий пока пуст — засушите первый цветок</p>
      </div>
    `;
    return;
  }

  els.herbariumGrid.innerHTML = state.herbarium
    .map((item) => {
      const meta = getFlowerMeta(item.flowerType);
      return `
        <article class="dried-flower-card">
          <img src="${meta.src}" alt="">
          <h3>${escapeHtml(item.title)}</h3>
          <p class="dried-date">${formatCompletedDate(item.completedAt)}</p>
        </article>
      `;
    })
    .join('');
};

const renderManagementList = () => {
  const active = state.tasks.filter((t) => t.status === 'active');
  editDraftFlower = null;

  if (active.length === 0) {
    els.tasksList.innerHTML = '<p class="empty-list">Нет активных задач</p>';
    return;
  }

  els.tasksList.innerHTML = active
    .map((task) => {
      const meta = getFlowerMeta(task.flowerType);
      return `
        <div class="task-row" data-id="${task.id}">
          <img src="${meta.src}" alt="" class="task-row-img">
          <div class="task-row-info">
            <strong>${escapeHtml(task.title)}</strong>
            <span>${formatDeadline(task.deadline)} · ${wiltLabel(task)}</span>
          </div>
          <div class="task-row-actions">
            <button type="button" class="btn-row-edit" data-action="edit" title="Редактировать" aria-label="Редактировать">✎</button>
            <button type="button" class="btn-row-delete" data-action="delete" title="Удалить" aria-label="Удалить">✕</button>
          </div>
        </div>
      `;
    })
    .join('');
};

const renderAll = () => {
  renderCubes();
  renderNursery();
  if (els.herbariumOverlay.classList.contains('active')) renderHerbarium();
  updateTooltipTimer();
};

/* ---------- Add form ---------- */

const resetAddForm = () => {
  els.addForm.reset();
  state = setSelectedFlower(state, null);
  els.flowerGrid.classList.remove('hidden');
  els.selectedPreview.classList.remove('visible');
  els.selectedPreview.hidden = true;
  els.selectedPreview.innerHTML = '';
  $$('.field input, .field textarea', els.addForm).forEach((el) =>
    el.classList.remove('invalid')
  );
};

const showSelectedFlower = (flowerId, previewEl = els.selectedPreview, gridEl = els.flowerGrid) => {
  const meta = getFlowerMeta(flowerId);
  gridEl.classList.add('hidden');
  previewEl.hidden = false;
  previewEl.classList.add('visible');
  previewEl.innerHTML = `<img src="${meta.src}" alt="${meta.name}">`;
};

/* ---------- Tooltip ---------- */

const cancelTipHide = () => {
  clearTimeout(tipHideTimer);
  tipHideTimer = null;
};

const scheduleTipHide = () => {
  cancelTipHide();
  tipHideTimer = setTimeout(() => {
    const overTip = els.tooltip.matches(':hover');
    const overFlower =
      tooltipAnchorEl &&
      (tooltipAnchorEl.matches(':hover') ||
        tooltipAnchorEl.contains(document.activeElement));
    if (!overTip && !overFlower) hideTooltip();
  }, TIP_HIDE_MS);
};

const positionTooltip = (anchorRect) => {
  const tip = els.tooltip;
  tip.style.visibility = 'hidden';
  tip.classList.add('visible');
  const tw = tip.offsetWidth || 280;
  const th = tip.offsetHeight || 200;
  tip.classList.remove('visible');
  tip.style.visibility = '';

  const pad = 12;
  let left = anchorRect.right + 10;
  let top = anchorRect.top;

  if (left + tw > window.innerWidth - pad) left = anchorRect.left - tw - 10;
  if (left < pad) left = pad;
  if (top + th > window.innerHeight - pad) top = window.innerHeight - th - pad;
  if (top < pad) top = pad;

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
};

const showTooltip = (task, anchorEl) => {
  if (drag?.moved) return;
  cancelTipHide();
  tooltipTaskId = task.id;
  tooltipAnchorEl = anchorEl;
  els.tipTitle.textContent = task.title;
  els.tipDesc.textContent = task.description || 'Без описания';
  els.tipDeadline.textContent = `Дедлайн: ${formatDeadline(task.deadline)}`;
  els.tipTimer.textContent = `Осталось: ${formatTimeLeft(task.deadline)}`;
  els.tipTimer.classList.toggle('overdue', calcWiltingState(task) === 'dead');
  positionTooltip(anchorEl.getBoundingClientRect());
  els.tooltip.classList.add('visible');
};

const hideTooltip = () => {
  cancelTipHide();
  tooltipTaskId = null;
  tooltipAnchorEl = null;
  els.tooltip.classList.remove('visible');
};

const updateTooltipTimer = () => {
  if (!tooltipTaskId) return;
  const task = state.tasks.find((t) => t.id === tooltipTaskId);
  if (!task) {
    hideTooltip();
    return;
  }
  els.tipTimer.textContent = `Осталось: ${formatTimeLeft(task.deadline)}`;
  els.tipTimer.classList.toggle('overdue', calcWiltingState(task) === 'dead');
};

/* ---------- Completion ---------- */

const spawnSparkles = (x, y) => {
  const colors = ['#FFD700', '#FFF4B0', '#E8C87A', '#FFFFFF', '#C9E4A8', '#E8B4C4'];
  Array.from({ length: 16 }).forEach((_, i) => {
    const spark = document.createElement('span');
    spark.className = i % 4 === 0 ? 'spark-particle star' : 'spark-particle';
    const angle = (Math.PI * 2 * i) / 16;
    const dist = 36 + Math.random() * 56;
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    spark.style.background = colors[i % colors.length];
    spark.style.color = colors[i % colors.length];
    els.sparkleLayer.appendChild(spark);
    setTimeout(() => spark.remove(), 950);
  });
};

const animateHarvest = (originEl, taskId, onDone) => {
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  originEl.classList.add('sparkle-anim');
  spawnSparkles(cx, cy);

  setTimeout(() => {
    originEl.classList.remove('sparkle-anim');
    originEl.classList.add('drying-anim');
    setTimeout(() => {
      state = completeTask(state, taskId);
      onDone?.();
      renderAll();
      showToast('Цветок засушен и отправлен в гербарий');
    }, 500);
  }, 700);
};

/* ---------- Edit ---------- */

const openInlineEditor = (taskId) => {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;

  editDraftFlower = task.flowerType;
  openModal(els.editOverlay);
  renderManagementList();
  editDraftFlower = task.flowerType;

  const row = els.tasksList.querySelector(`[data-id="${taskId}"]`);
  if (!row) return;

  const meta = getFlowerMeta(task.flowerType);

  row.innerHTML = `
    <form class="inline-edit-form" data-id="${taskId}">
      <div class="edit-flower-picker">
        <div class="flower-grid edit-flower-grid hidden" id="editFlowerGrid"></div>
        <button type="button" class="selected-flower-preview visible" id="editFlowerPreview" aria-label="Сменить сорт">
          <img src="${meta.src}" alt="${meta.name}">
        </button>
      </div>
      <input type="hidden" name="flowerType" id="editFlowerType" value="${task.flowerType}">
      <input type="text" name="title" value="${escapeHtml(task.title)}" required>
      <textarea name="description" rows="2">${escapeHtml(task.description || '')}</textarea>
      <input type="datetime-local" name="deadline" value="${toDatetimeLocal(task.deadline)}" required>
      <div class="inline-edit-actions">
        <button type="button" class="btn-cancel" data-action="cancel-edit">Отмена</button>
        <button type="submit" class="btn-submit">Сохранить</button>
      </div>
    </form>
  `;

  const grid = $('#editFlowerGrid', row);
  const preview = $('#editFlowerPreview', row);
  const hidden = $('#editFlowerType', row);
  renderFlowerGridInto(grid, task.flowerType);

  preview.addEventListener('click', () => {
    preview.classList.remove('visible');
    preview.hidden = true;
    grid.classList.remove('hidden');
  });

  grid.addEventListener('click', (e) => {
    const option = e.target.closest('.flower-option');
    if (!option) return;
    const id = option.dataset.flower;
    editDraftFlower = id;
    hidden.value = id;
    const m = getFlowerMeta(id);
    preview.innerHTML = `<img src="${m.src}" alt="${m.name}">`;
    preview.hidden = false;
    preview.classList.add('visible');
    grid.classList.add('hidden');
  });
};

/* ---------- Pointer drag ---------- */

const clearCubeHighlights = () => {
  $$('.cube').forEach((c) => c.classList.remove('drop-target', 'drop-forbidden'));
};

const elementFromPointSafe = (x, y) => {
  const prev = drag?.ghost;
  if (prev) prev.style.visibility = 'hidden';
  const el = document.elementFromPoint(x, y);
  if (prev) prev.style.visibility = '';
  return el;
};

const findCubeAt = (x, y) => elementFromPointSafe(x, y)?.closest?.('.cube') ?? null;

const startDrag = (e, flowerEl) => {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('.flower-tooltip')) return;
  const taskId = flowerEl.dataset.taskId;
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !matchesFilter(task, state.filter)) return;

  drag = {
    taskId,
    sourceEl: flowerEl,
    ghost: null,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    fromCube: Boolean(task.cubeId),
    cubeId: task.cubeId,
  };

  try {
    flowerEl.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
};

const ensureGhost = (clientX, clientY) => {
  if (!drag || drag.ghost) return;
  hideTooltip();
  const task = state.tasks.find((t) => t.id === drag.taskId);
  if (!task) return;
  const ghost = document.createElement('div');
  ghost.className = `flower-ghost state-${calcWiltingState(task)}`;
  ghost.innerHTML = flowerMarkup(task.flowerType);
  els.dragLayer.appendChild(ghost);
  drag.ghost = ghost;
  drag.sourceEl.classList.add('is-ghost-source');
  ghost.style.left = `${clientX}px`;
  ghost.style.top = `${clientY}px`;
  els.body.classList.add('is-dragging');
};

const moveDrag = (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
    drag.moved = true;
    ensureGhost(e.clientX, e.clientY);
  }

  if (!drag.ghost) return;

  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;

  clearCubeHighlights();
  const cube = findCubeAt(e.clientX, e.clientY);
  if (!cube) return;

  const cubeId = Number(cube.dataset.cubeId);
  const free =
    isCubeFree(state, cubeId) ||
    state.tasks.some((t) => t.id === drag.taskId && t.cubeId === cubeId);

  cube.classList.toggle('drop-target', free);
  cube.classList.toggle('drop-forbidden', !free);
};

const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;

  const { taskId, sourceEl, ghost, moved, fromCube, startX, startY } = drag;
  const x = e.clientX;
  const y = e.clientY;

  clearCubeHighlights();
  els.body.classList.remove('is-dragging');
  ghost?.remove();
  sourceEl.classList.remove('is-ghost-source');

  try {
    sourceEl.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }

  drag = null;

  if (!moved) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) showTooltip(task, sourceEl);
    return;
  }

  const cube = findCubeAt(x, y);

  if (cube) {
    const cubeId = Number(cube.dataset.cubeId);
    const next = placeTaskInCube(state, taskId, cubeId);
    if (next === state && !isCubeFree(state, cubeId)) {
      showToast('Этот куб уже занят');
    } else if (next !== state) {
      state = next;
    }
    renderAll();
    return;
  }

  if (fromCube && Math.hypot(x - startX, y - startY) > 40) {
    const harvestGhost = document.createElement('div');
    harvestGhost.className = 'flower-ghost';
    const metaType = getTaskById(state, taskId)?.flowerType;
    harvestGhost.innerHTML = flowerMarkup(metaType);
    harvestGhost.style.left = `${x}px`;
    harvestGhost.style.top = `${y}px`;
    els.dragLayer.appendChild(harvestGhost);
    animateHarvest(harvestGhost, taskId, () => harvestGhost.remove());
    renderAll();
    return;
  }

  renderAll();
};

const cancelDrag = () => {
  if (!drag) return;
  drag.ghost?.remove();
  drag.sourceEl.classList.remove('is-ghost-source');
  clearCubeHighlights();
  els.body.classList.remove('is-dragging');
  drag = null;
  renderAll();
};

/* ---------- Events ---------- */

const bindEvents = () => {
  $$('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state = setFilter(state, btn.dataset.filter);
      renderAll();
    });
  });

  $('#openHerbarium').addEventListener('click', () => {
    hideTooltip();
    renderHerbarium();
    openModal(els.herbariumOverlay);
  });

  $('#closeHerbariumBtn').addEventListener('click', () => {
    closeModal(els.herbariumOverlay);
  });

  $('#openAddModal').addEventListener('click', () => {
    resetAddForm();
    openModal(els.addOverlay);
  });

  $('#closeAddModal').addEventListener('click', () => {
    closeModal(els.addOverlay);
    resetAddForm();
  });

  $('#openEditModal').addEventListener('click', () => {
    renderManagementList();
    openModal(els.editOverlay);
  });

  $('#closeEditModal').addEventListener('click', () => closeModal(els.editOverlay));

  [els.addOverlay, els.editOverlay, els.herbariumOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
        if (overlay === els.addOverlay) resetAddForm();
      }
    });
  });

  els.flowerGrid.addEventListener('click', (e) => {
    const option = e.target.closest('.flower-option');
    if (!option) return;
    const flowerId = option.dataset.flower;
    state = setSelectedFlower(state, flowerId);
    showSelectedFlower(flowerId);
  });

  els.selectedPreview.addEventListener('click', () => {
    state = setSelectedFlower(state, null);
    els.flowerGrid.classList.remove('hidden');
    els.selectedPreview.classList.remove('visible');
    els.selectedPreview.hidden = true;
    els.selectedPreview.innerHTML = '';
  });

  els.addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleEl = $('#taskTitle');
    const deadlineEl = $('#taskDeadline');
    const title = titleEl.value.trim();
    const deadline = deadlineEl.value;
    const description = $('#taskDesc').value;

    titleEl.classList.toggle('invalid', !title);
    deadlineEl.classList.toggle('invalid', !deadline);

    if (!state.selectedFlower) {
      showToast('Выберите сорт цветка');
      return;
    }
    if (!title || !deadline) {
      showToast('Заполните название и дедлайн');
      return;
    }

    const cubesFull = areAllCubesOccupied(state);

    state = addTask(state, {
      title,
      description,
      deadline: new Date(deadline).toISOString(),
      flowerType: state.selectedFlower,
    });

    closeModal(els.addOverlay);
    resetAddForm();
    renderAll();

    if (cubesFull) {
      showToast('Все кубы заняты — цветок останется в питомнике справа');
    }
  });

  els.tasksList.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'cancel-edit') {
      renderManagementList();
      return;
    }

    const row = e.target.closest('.task-row');
    if (!row) return;
    const id = row.dataset.id;
    const action = e.target.dataset.action;

    if (action === 'delete') {
      state = deleteTask(state, id);
      hideTooltip();
      renderManagementList();
      renderAll();
      return;
    }

    if (action === 'edit') openInlineEditor(id);
  });

  els.tasksList.addEventListener('submit', (e) => {
    const form = e.target.closest('.inline-edit-form');
    if (!form) return;
    e.preventDefault();
    const id = form.dataset.id;
    const fd = new FormData(form);
    state = updateTask(state, id, {
      flowerType: fd.get('flowerType'),
      title: fd.get('title'),
      description: fd.get('description'),
      deadline: new Date(fd.get('deadline')).toISOString(),
    });
    editDraftFlower = null;
    renderManagementList();
    renderAll();
  });

  document.addEventListener('pointerdown', (e) => {
    if (els.addOverlay.classList.contains('active')) return;
    if (els.editOverlay.classList.contains('active')) return;
    if (els.herbariumOverlay.classList.contains('active')) return;
    if (e.target.closest('#flowerTooltip')) return;
    const flower = e.target.closest('.flower-item');
    if (!flower) return;
    if (flower.closest('.filtered-out')) return;
    startDrag(e, flower);
  });

  document.addEventListener('pointermove', moveDrag);
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', cancelDrag);

  document.addEventListener('pointerover', (e) => {
    if (drag?.moved) return;
    if (els.herbariumOverlay.classList.contains('active')) return;
    const flower = e.target.closest('.flower-item');
    if (!flower || flower.classList.contains('is-ghost-source')) return;
    if (flower.closest('.filtered-out')) return;
    const from = e.relatedTarget;
    if (from && flower.contains(from)) return;
    const task = state.tasks.find((t) => t.id === flower.dataset.taskId);
    if (!task) return;
    showTooltip(task, flower);
  });

  document.addEventListener('pointerout', (e) => {
    if (drag?.moved) return;
    const flower = e.target.closest('.flower-item');
    if (!flower) return;
    const to = e.relatedTarget;
    if (to && (els.tooltip.contains(to) || flower.contains(to))) return;
    if (tooltipTaskId === flower.dataset.taskId) scheduleTipHide();
  });

  els.tooltip.addEventListener('pointerenter', () => {
    cancelTipHide();
  });

  els.tooltip.addEventListener('pointerleave', (e) => {
    const to = e.relatedTarget;
    if (to && tooltipAnchorEl && (tooltipAnchorEl === to || tooltipAnchorEl.contains(to))) {
      cancelTipHide();
      return;
    }
    scheduleTipHide();
  });

  // Prevent drag starting from tooltip buttons
  els.tooltip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  els.harvestBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tooltipTaskId) return;
    const id = tooltipTaskId;
    const flowerEl = document.querySelector(`.flower-item[data-task-id="${id}"]`);
    hideTooltip();
    if (flowerEl) animateHarvest(flowerEl, id, () => {});
    else {
      state = completeTask(state, id);
      renderAll();
    }
  });

  els.tipEditBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tooltipTaskId) return;
    const id = tooltipTaskId;
    hideTooltip();
    openInlineEditor(id);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal(els.addOverlay);
    closeModal(els.editOverlay);
    closeModal(els.herbariumOverlay);
    hideTooltip();
    cancelDrag();
  });
};

const startLifecycleTicker = () => {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (drag?.moved) return;
    $$('.flower-item').forEach((el) => {
      const task = state.tasks.find((t) => t.id === el.dataset.taskId);
      if (!task) return;
      const wilt = calcWiltingState(task);
      el.classList.remove('state-fresh', 'state-wilting', 'state-dead');
      el.classList.add(`state-${wilt}`);
    });
    updateTooltipTimer();
  }, 1000);
};

const init = async () => {
  await preloadFlowerSvgs();
  renderFlowerGrid();
  bindEvents();
  renderAll();
  startLifecycleTicker();
};

init();
