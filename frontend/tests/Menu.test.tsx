import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from '../src/components/Menu';

const wait = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Menu', () => {
  it('confirma la opción seleccionada y permite recorrer las opciones', async () => {
    const onSelect = vi.fn();
    const options = [
      { value: '1', label: 'Primera' },
      { value: '2', label: 'Segunda' },
    ];
    const { stdin } = render(<Menu options={options} onSelect={onSelect} />);
    await wait();
    stdin.write('\u001B[B');
    await wait();
    stdin.write('\u001B[A');
    await wait();
    stdin.write('\u001B[A');
    await wait();
    stdin.write('\r');
    await wait();
    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it('ignora Enter cuando no hay opciones', async () => {
    const onSelect = vi.fn();
    const { stdin } = render(<Menu options={[]} onSelect={onSelect} />);
    await wait();
    stdin.write('\r');
    await wait();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
