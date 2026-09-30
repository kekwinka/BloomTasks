const DAY_MS = 24 * 60 * 60 * 1000;

export const FLOWER_TYPES = Object.freeze([
  Object.freeze({ id: 'rose', name: 'Роза', src: 'assets/flowers/rose.png', endSrc: 'assets/flowers/rose_end.png' }),
  Object.freeze({ id: 'tulip', name: 'Попугайный тюльпан', src: 'assets/flowers/tulip.png', endSrc: 'assets/flowers/tulip_end.png' }),
  Object.freeze({ id: 'lily', name: 'Лилия', src: 'assets/flowers/lily.png', endSrc: 'assets/flowers/lily_end.png' }),
  Object.freeze({ id: 'jasmin', name: 'Жасмин', src: 'assets/flowers/jasmin.png', endSrc: 'assets/flowers/jasmin_end.png' }),
  Object.freeze({ id: 'hydrangea', name: 'Гортензия', src: 'assets/flowers/hydrangea.png', endSrc: 'assets/flowers/hydrangea_end.png' }),
  Object.freeze({ id: 'orchid', name: 'Орхидея', src: 'assets/flowers/orchid.png', endSrc: 'assets/flowers/orchid_end.png' }),
  Object.freeze({ id: 'lotus', name: 'Лотос', src: 'assets/flowers/lotus.png', endSrc: 'assets/flowers/lotus_end.png' }),
  Object.freeze({ id: 'peon', name: 'Пион', src: 'assets/flowers/peon.png', endSrc: 'assets/flowers/peon_end.png' }),
]);

export const CUBE_COUNT = 9;

export const getFlowerMeta = (id) =>
  FLOWER_TYPES.find((f) => f.id === id) ?? FLOWER_TYPES[0];

const toTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const calcWiltingState = (task, now = Date.now()) => {
  if (!task || task.status !== 'active') return 'fresh';
  const deadline = toTimestamp(task.deadline);
  if (deadline === null) return 'fresh';
  if (now >= deadline) return 'wilted';
  if (deadline - now <= DAY_MS) return 'fading';
  return 'fresh';
};

export const isWilted = (task, now = Date.now()) =>
  task?.status === 'active' && calcWiltingState(task, now) === 'wilted';

export const isActiveAlive = (task, now = Date.now()) =>
  task?.status === 'active' && calcWiltingState(task, now) !== 'wilted';

export const formatTimeLeft = (deadline, now = Date.now()) => {
  const deadlineMs = toTimestamp(deadline);
  if (deadlineMs === null) return 'Без дедлайна';

  const diff = deadlineMs - now;
  if (diff <= 0) return 'Просрочено';

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${mins} мин`;
  if (mins > 0) return `${mins} мин ${secs} с`;
  return `${secs} с`;
};

export const formatDeadline = (deadline) => {
  const timestamp = toTimestamp(deadline);
  if (timestamp === null) return 'Без дедлайна';

  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCompletedDate = (iso) => {
  const timestamp = toTimestamp(iso);
  if (timestamp === null) return 'Дата неизвестна';

  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const matchesFilter = (task, filter, now = Date.now()) => {
  if (task?.status !== 'active') return false;
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveAlive(task, now);
  if (filter === 'wilted') return isWilted(task, now);
  return false;
};

export const wiltLabel = (task, now = Date.now()) => {
  const state = calcWiltingState(task, now);
  if (state === 'wilted') return 'Увядший';
  if (state === 'fading') return 'Увядает';
  return 'Свежий';
};
