import { beforeEach, describe, expect, it } from 'vitest';
import { FocusReturn } from './focus-return';

describe('FocusReturn', () => {
  let canvasHost: HTMLElement;
  let container: HTMLElement;
  let card: HTMLButtonElement;
  let elsewhere: HTMLInputElement;
  let focusReturn: FocusReturn;

  function focusEnters(from: EventTarget | null): void {
    card.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: from }));
  }

  beforeEach(() => {
    document.body.replaceChildren();
    canvasHost = document.createElement('div');
    canvasHost.tabIndex = 0;
    container = document.createElement('section');
    card = document.createElement('button');
    elsewhere = document.createElement('input');
    container.append(card);
    document.body.append(canvasHost, container, elsewhere);
    focusReturn = new FocusReturn();
    container.addEventListener('focusin', (event) => focusReturn.enter(event));
    container.addEventListener('focusout', (event) => focusReturn.leave(event));
  });

  it('gives focus back to where it came from once the container is gone', () => {
    focusEnters(canvasHost);
    container.remove();
    focusReturn.restore(document);
    expect(document.activeElement).toBe(canvasHost);
  });

  it('keeps the first origin while focus moves between the container’s own controls', () => {
    focusEnters(canvasHost);
    focusEnters(card);
    container.remove();
    focusReturn.restore(document);
    expect(document.activeElement).toBe(canvasHost);
  });

  it('forgets the origin when focus leaves the container on its own', () => {
    focusEnters(canvasHost);
    card.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: elsewhere }));
    container.remove();
    focusReturn.restore(document);
    expect(document.activeElement).toBe(document.body);
  });

  it('never takes focus from where the player has put it', () => {
    focusEnters(canvasHost);
    elsewhere.focus();
    focusReturn.restore(document);
    expect(document.activeElement).toBe(elsewhere);
  });

  it('has nothing to return when focus came from nowhere', () => {
    focusEnters(null);
    container.remove();
    focusReturn.restore(document);
    expect(document.activeElement).toBe(document.body);
  });
});
