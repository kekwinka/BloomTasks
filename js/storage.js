const STORAGE_KEY = 'bloomtasks-state';
const STORAGE_VERSION = 2;

const FLOWER_MIGRATION = Object.freeze({
  lavender: 'dianthus',
  chamomile: 'hydrangea',
  sunflower: 'lotus',
});

const migrateFlowerType = (type) => FLOWER_MIGRATION[type] ?? type;

const migrateEntity = (entity) => {
  if (!entity || typeof entity !== 'object') return entity;
  return {
    ...entity,
    flowerType: migrateFlowerType(entity.flowerType),
  };
};

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map(migrateEntity);
    const herbarium = (Array.isArray(parsed.herbarium) ? parsed.herbarium : []).map(
      migrateEntity
    );
    return { tasks, herbarium, version: STORAGE_VERSION };
  } catch {
    return null;
  }
};

export const saveState = (state) => {
  const snapshot = {
    version: STORAGE_VERSION,
    tasks: state.tasks,
    herbarium: state.herbarium,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
};
