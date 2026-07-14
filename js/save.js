const SAVE_KEY = 'ai-creator-save-v1';

export function defaultSave() {
  return {
    insight: 0,
    bestScore: 0,
    creations: 0,
    lastName: '',
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  return save;
}

export function applyRunResult(save, result) {
  const next = {
    ...save,
    insight: save.insight + result.insightGained,
    bestScore: Math.max(save.bestScore, result.score),
    creations: save.creations + 1,
    lastName: result.name,
  };
  return writeSave(next);
}
