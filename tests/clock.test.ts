import { describe, expect, it } from 'vitest';
import { SimulationClock } from '../src/sim/clock';

describe('simulation clock', () => {
  it('steps at 10 Hz and retains partial progress for rendering', () => {
    const clock = new SimulationClock();
    const ticks: number[] = [];
    const step = (tick: number) => ticks.push(tick);
    clock.advance(99, step);
    expect(clock.tick).toBe(0);
    clock.advance(251, step);
    expect(ticks).toEqual([1, 2, 3]);
    expect(clock.interpolation).toBe(0.5);
    clock.advance(50, step);
    expect(clock.tick).toBe(4);
    expect(clock.interpolation).toBe(0);
  });

  it('produces the same ticks across frame schedules and at double speed', () => {
    function run(frames: number[], speed: 1 | 2) {
      const clock = new SimulationClock();
      const ticks: number[] = [];
      clock.speed = speed;
      frames.forEach((delta) => clock.advance(delta, (tick) => ticks.push(tick)));
      return ticks;
    }

    expect(run([20, 35, 70, 525, 400], 1)).toEqual(run([1050], 1));
    expect(run([525], 2)).toEqual(run([1050], 1));
  });

  it('preserves partial progress while paused', () => {
    const clock = new SimulationClock();
    const ticks: number[] = [];
    const step = (tick: number) => ticks.push(tick);
    clock.advance(75, step);
    clock.speed = 0;
    clock.advance(5000, step);
    expect(ticks).toEqual([]);
    expect(clock.interpolation).toBe(0.75);
    clock.speed = 1;
    clock.advance(25, step);
    expect(ticks).toEqual([1]);
  });

  it.each([-1, NaN, Infinity])('rejects invalid deltas (%s)', (delta) => {
    expect(() => new SimulationClock().advance(delta, () => {})).toThrow(RangeError);
  });
});
