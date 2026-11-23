import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { App } from '../src/components/App';

describe('App', () => {
  it('muestra el nombre de la plataforma', () => {
    const { lastFrame } = render(<App />);

    expect(lastFrame()).toContain('Legado&Origen');
  });
});
