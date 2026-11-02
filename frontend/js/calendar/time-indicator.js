import { createElement } from '../utils/dom.js';

export class TimeIndicator {
  constructor(gridContainer, hourHeight = 60) {
    this.gridContainer = gridContainer;
    this.hourHeight = hourHeight;
    this.element = null;
    this.timer = null;
  }

  mount() {
    this.element = createElement('div', { className: 'time-indicator-line' }, [
      createElement('div', { className: 'time-indicator-circle' })
    ]);
    this.gridContainer.appendChild(this.element);
    this.updatePosition();

    // Update every minute
    this.timer = setInterval(() => this.updatePosition(), 60000);
  }

  updatePosition() {
    if (!this.element) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const topPx = (minutes / 60) * this.hourHeight;
    this.element.style.top = `${topPx}px`;
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

