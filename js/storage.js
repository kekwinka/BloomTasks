const STORAGE_KEY = 'bloomtasks-state';

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      herbarium: Array.isArray(parsed.herbarium) ? parsed.herbarium : [],
    };
  } catch {
    return null;
  }
};

export const saveState = (state) => {
  const snapshot = {
    tasks: state.tasks,
    herbarium: state.herbarium,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
};
