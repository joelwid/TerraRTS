export const TICK_MS = 100;
export const TICKS_PER_MINUTE = 60_000 / TICK_MS;
export type ClockSpeed = 0 | 1 | 2;

export class SimulationClock {
  private elapsed = 0;
  private ticks = 0;
  speed: ClockSpeed = 1;

  get tick(): number {
    return this.ticks;
  }

  get interpolation(): number {
    return this.elapsed / TICK_MS;
  }

  advance(deltaMs: number, step: (tick: number) => void): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError('Frame delta must be finite and nonnegative');
    }

    this.elapsed += deltaMs * this.speed;
    while (this.elapsed >= TICK_MS) {
      this.elapsed -= TICK_MS;
      step(++this.ticks);
    }
  }
}
