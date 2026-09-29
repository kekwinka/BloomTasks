export const FLOWER_TYPES = Object.freeze([
  Object.freeze({ id: 'rose', name: 'Роза', src: 'assets/flowers/rose.svg' }),
  Object.freeze({
    id: 'tulip',
    name: 'Попугайный тюльпан',
    src: 'assets/flowers/tulip.svg',
  }),
  Object.freeze({ id: 'peony', name: 'Пион', src: 'assets/flowers/peony.svg' }),
  Object.freeze({
    id: 'dianthus',
    name: 'Диантус',
    src: 'assets/flowers/dianthus.svg',
  }),
  Object.freeze({
    id: 'hydrangea',
    name: 'Гортензия',
    src: 'assets/flowers/hydrangea.svg',
  }),
  Object.freeze({ id: 'orchid', name: 'Орхидея', src: 'assets/flowers/orchid.svg' }),
  Object.freeze({ id: 'lotus', name: 'Лотос', src: 'assets/flowers/lotus.svg' }),
  Object.freeze({ id: 'lily', name: 'Лилия', src: 'assets/flowers/lily.svg' }),
]);

export const CUBE_COUNT = 9;

export const getFlowerMeta = (id) =>
  FLOWER_TYPES.find((f) => f.id === id) ?? FLOWER_TYPES[0];

/** Доля прошедшего времени от создания до дедлайна: 0..1+ */
export const calcProgress = (createdAt, deadline, now = Date.now()) => {
  const start = new Date(createdAt).getTime();
  const end = new Date(deadline).getTime();
  const span = Math.max(end - start, 1);
  return (now - start) / span;
};

/** Степень увядания: fresh | wilting | dead (детерминированно) */
export const calcWiltingState = (task, now = Date.now()) => {
  if (!task || task.status === 'completed' || task.completedAt) return 'dead';
  const end = new Date(task.deadline).getTime();
  if (now >= end) return 'dead';
  const progress = calcProgress(task.createdAt, task.deadline, now);
  if (progress >= 0.65) return 'wilting';
  return 'fresh';
};

export const isWilted = (task, now = Date.now()) =>
  task.status === 'active' && calcWiltingState(task, now) === 'dead';

export const isActiveAlive = (task, now = Date.now()) =>
  task.status === 'active' && calcWiltingState(task, now) !== 'dead';

export const formatTimeLeft = (deadline, now = Date.now()) => {
  const diff = new Date(deadline).getTime() - now;
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
  const d = new Date(deadline);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCompletedDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const matchesFilter = (task, filter, now = Date.now()) => {
  if (task.status !== 'active') return false;
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveAlive(task, now);
  if (filter === 'wilted') return isWilted(task, now);
  return true;
};

export const wiltLabel = (task, now = Date.now()) => {
  const w = calcWiltingState(task, now);
  if (w === 'dead') return 'Увядший';
  if (w === 'wilting') return 'Увядает';
  return 'Свежий';
};
