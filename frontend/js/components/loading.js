import { createIcon } from '../utils/icons.js';

// A dedicated content loader, not a small inline button spinner.
export function createLoadingState(label = 'Đang tải dữ liệu…') {
  const state = document.createElement('div');
  state.className = 'page-loading';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  state.setAttribute('aria-busy', 'true');
  const indicator = document.createElement('span');
  indicator.className = 'page-loading__indicator';
  indicator.appendChild(createIcon('loader-circle', { size: 56, spin: true }));
  const text = document.createElement('span');
  text.className = 'page-loading__label';
  text.textContent = label;
  state.append(indicator, text);
  return state;
}
