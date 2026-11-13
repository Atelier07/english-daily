// Hồ sơ người học: trình độ xếp lớp, thời gian mỗi ngày, ngày đang học trong khoá.
import { db, save } from './store.js';

const SKIP_KEY = 'englishDaily.placementSkipped';
export const DEFAULT_BUDGET = 30;
export const DAYS_PER_WEEK = 6; // ước tính thật thà: nghỉ 1 ngày mỗi tuần

export function getProfile() { return db().profile.find((p) => p.id === 'me') || null; }

export function saveProfile(data) {
  const cur = getProfile();
  if (cur) Object.assign(cur, data);
  else db().profile.push({ id: 'me', ...data });
  save();
}

export const needsPlacement = () => {
  if (getProfile() && getProfile().level) return false;
  try { return !localStorage.getItem(SKIP_KEY); } catch (e) { return true; }
};
export function skipPlacement() {
  try { localStorage.setItem(SKIP_KEY, '1'); } catch (e) { /* ignore */ }
  if (!getProfile()) saveProfile({ budget: DEFAULT_BUDGET, currentDay: 1, startDay: 1 });
}

export const budget = () => (getProfile() && getProfile().budget) || DEFAULT_BUDGET;
export const level = () => (getProfile() && getProfile().level) || 'A0';
export const weeklyHours = (b = budget()) => (b * DAYS_PER_WEEK) / 60;
export const currentDay = () => (getProfile() && getProfile().currentDay) || 1;
export function setBudget(b) { saveProfile({ budget: b }); }
export const dayDoneMap = () => (getProfile() && getProfile().daysDone) || {};
