import { loadState, saveState } from './storage.js';
import { CUBE_COUNT } from './flowers.js';

const createId = () =>
  `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const initialState = () => ({
  tasks: [],
  herbarium: [],
  filter: 'all',
  selectedFlower: null,
  view: 'greenhouse',
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

const persist = (state) => {
  saveState(state);
  return state;
};

export const setFilter = (state, filter) => ({ ...state, filter });

export const setView = (state, view) => ({ ...state, view });

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

  return persist({
    ...state,
    tasks: [...state.tasks, task],
    selectedFlower: null,
  });
};

export const updateTask = (state, id, patch) => {
  const tasks = state.tasks.map((task) => {
    if (task.id !== id) return task;
    const next = {
      ...task,
      ...patch,
    };
    if (patch.title !== undefined) next.title = String(patch.title).trim();
    if (patch.description !== undefined) {
      next.description = String(patch.description).trim();
    }
    return Object.freeze(next);
  });

  return persist({ ...state, tasks });
};

export const placeTaskInCube = (state, taskId, cubeId) => {
  const occupied = state.tasks.some(
    (t) => t.status === 'active' && t.cubeId === cubeId && t.id !== taskId
  );
  if (occupied) return state;

  const tasks = state.tasks.map((task) =>
    task.id === taskId ? Object.freeze({ ...task, cubeId }) : task
  );

  return persist({ ...state, tasks });
};

export const deleteTask = (state, id) =>
  persist({
    ...state,
    tasks: state.tasks.filter((t) => t.id !== id),
  });

export const completeTask = (state, id) => {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.status !== 'active') return state;

  const dried = Object.freeze({
    id: task.id,
    title: task.title,
    description: task.description,
    flowerType: task.flowerType,
    deadline: task.deadline,
    completedAt: new Date().toISOString(),
  });

  return persist({
    ...state,
    tasks: state.tasks.filter((t) => t.id !== id),
    herbarium: [dried, ...state.herbarium],
  });
};

export const getUnplacedTasks = (state) =>
  state.tasks.filter((t) => t.status === 'active' && t.cubeId === null);

export const getTaskById = (state, id) =>
  state.tasks.find((t) => t.id === id) ??
  state.herbarium.find((t) => t.id === id) ??
  null;

export const isCubeFree = (state, cubeId) =>
  !state.tasks.some((t) => t.status === 'active' && t.cubeId === cubeId);

export const countFreeCubes = (state) =>
  Array.from({ length: CUBE_COUNT }, (_, i) => i + 1).filter((id) =>
    isCubeFree(state, id)
  ).length;

export const areAllCubesOccupied = (state) => countFreeCubes(state) === 0;
