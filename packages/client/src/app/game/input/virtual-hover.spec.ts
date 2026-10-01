import { afterEach, describe, expect, it } from 'vitest';
import { VirtualHover } from './virtual-hover';

function recordingElement(tag: string, log: string[], name: string): HTMLElement {
  const element = document.createElement(tag);
  element.addEventListener('mouseenter', () => log.push(`enter ${name}`));
  element.addEventListener('mouseleave', () => log.push(`leave ${name}`));
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('VirtualHover', () => {
  it('enters a control and its ancestors outermost first, and leaves innermost first', () => {
    const log: string[] = [];
    const card = recordingElement('div', log, 'card');
    const label = recordingElement('span', log, 'label');
    card.append(label);
    document.body.append(card);
    const hover = new VirtualHover();

    hover.moveTo(label);
    expect(log).toEqual(['enter card', 'enter label']);

    log.length = 0;
    hover.clear();
    expect(log).toEqual(['leave label', 'leave card']);
  });

  it('moving between two siblings leaves one and enters the other, and the shared parent hears neither', () => {
    const log: string[] = [];
    const row = recordingElement('div', log, 'row');
    const first = recordingElement('button', log, 'first');
    const second = recordingElement('button', log, 'second');
    row.append(first, second);
    document.body.append(row);
    const hover = new VirtualHover();
    hover.moveTo(first);

    log.length = 0;
    hover.moveTo(second);
    expect(log).toEqual(['leave first', 'enter second']);
  });

  it('dispatches nothing while it stays over the same element', () => {
    const log: string[] = [];
    const card = recordingElement('div', log, 'card');
    document.body.append(card);
    const hover = new VirtualHover();
    hover.moveTo(card);
    log.length = 0;
    hover.moveTo(card);
    expect(log).toEqual([]);
  });
});
