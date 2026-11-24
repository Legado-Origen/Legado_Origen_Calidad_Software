import type { Clock } from '../../src/shared/clock.js';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date) {
    this.current = date;
  }

  advance(minutes: number, seconds = 0) {
    this.current = new Date(this.current.getTime() + (minutes * 60 + seconds) * 1000);
  }
}