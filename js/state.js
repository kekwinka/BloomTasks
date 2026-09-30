import { loadState } from './storage.js';
import { CUBE_COUNT, getFlowerMeta } from './flowers.js';

const createId = () =>
  `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const initialState = () => ({
  tasks: [],
  herbarium: [],
  filter: 'all',
  selectedFlower: null,
});

export const createInitialState = () => {
  const saved = loadState();
  if (!saved) return initialState();
  return {
    ...initialState(),
    tasks: saved.tasks,
    herbarium: saved.herbarium,
  };
};

export const setFilter = (state, filter) => ({ ...state, filter });

export const setSelectedFlower = (state, flowerId) => ({
  ...state,
  selectedFlower: flowerId,
});

export const addTask = (state, { title, description, deadline, flowerType }) => {
  const task = Object.freeze({
    id: createId(),
    title: title.trim(),
    description: (description || '').trim(),
    deadline,
    flowerType,
    status: 'active',
    cubeId: null,
    createdAt: new Date().toISOString(),
  });

  return {
    ...state,
    tasks: [...state.tasks, task],
    selectedFlower: null,
  };
};

export const updateTask = (state, id, patch) => {
  const tasks = state.tasks.map((task) => {
    if (task.id !== id) return task;

    const next = Object.freeze({
      ...task,
      ...patch,
      ...(patch.title !== undefined ? { title: String(patch.title).trim() } : {}),
      ...(patch.description !== undefined
        ? { description: String(patch.description).trim() }
        : {}),
    });
    return next;
  });
  return { ...state, tasks };
};

export const placeTaskInCube = (state, taskId, cubeId) => {
  const occupied = state.tasks.some(
    (t) => t.status === 'active' && t.cubeId === cubeId && t.id !== taskId
  );
  if (occupied) return state;
  const tasks = state.tasks.map((task) =>
    task.id === taskId ? Object.freeze({ ...task, cubeId }) : task
  );
  return { ...state, tasks };
};

export const deleteTask = (state, id) => ({
  ...state,
  tasks: state.tasks.filter((t) => t.id !== id),
});

export const completeTask = (state, id) => {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.status !== 'active') return state;
  const flower = getFlowerMeta(task.flowerType);
  const completedAt = new Date().toISOString();
  const dried = Object.freeze({
    id: task.id,
    title: task.title,
    description: task.description,
    flowerType: task.flowerType,
    flowerSrc: flower.src,
    flowerEndSrc: flower.endSrc,
    deadline: task.deadline,
    completedAt,
  });

  const hasEntry = state.herbarium.some((item) => item.id === task.id);
  const herbarium = hasEntry
    ? state.herbarium.map((item) => (item.id === task.id ? dried : item))
    : [dried, ...state.herbarium];

  return {
    ...state,
    tasks: state.tasks.filter((t) => t.id !== id),
    herbarium,
  };
};

export const getUnplacedTasks = (state) =>
  state.tasks.filter((t) => t.status === 'active' && t.cubeId === null);

export const isCubeFree = (state, cubeId) =>
  !state.tasks.some((t) => t.status === 'active' && t.cubeId === cubeId);

export const countFreeCubes = (state) =>
  Array.from({ length: CUBE_COUNT }, (_, i) => i + 1).filter((id) =>
    isCubeFree(state, id)
  ).length;

export const areAllCubesOccupied = (state) => countFreeCubes(state) === 0;
