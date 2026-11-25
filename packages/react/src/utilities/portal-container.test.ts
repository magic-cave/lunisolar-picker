import { describe, expect, it, onTestFinished } from 'vitest';
import { resolvePortalContainer } from './portal-container';

const createDialogWithAnchor = (): { readonly anchor: HTMLElement; readonly dialog: HTMLDialogElement } => {
  const dialog = document.createElement('dialog');
  const wrapper = document.createElement('div');
  const anchor = document.createElement('template');
  wrapper.append(anchor);
  dialog.append(wrapper);
  document.body.append(dialog);
  onTestFinished(() => {
    dialog.close();
    dialog.remove();
  });
  return { anchor, dialog };
};

const createAriaDialog = (role: 'dialog' | 'alertdialog', isModal: boolean): HTMLDivElement => {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', role);
  dialog.setAttribute('aria-modal', String(isModal));
  return dialog;
};

describe('resolvePortalContainer', () => {
  it('returns the nearest dialog opened with showModal', () => {
    const { anchor, dialog } = createDialogWithAnchor();
    dialog.showModal();

    expect(resolvePortalContainer(anchor)).toBe(dialog);
  });

  it('returns body for a dialog opened with show()', () => {
    const { anchor, dialog } = createDialogWithAnchor();
    dialog.show();

    expect(resolvePortalContainer(anchor)).toBe(document.body);
  });

  it('returns body when no dialog contains the anchor', () => {
    const anchor = document.createElement('template');
    document.body.append(anchor);
    onTestFinished(() => anchor.remove());

    expect(resolvePortalContainer(anchor)).toBe(document.body);
  });

  it('returns the ARIA modal dialog containing the anchor', () => {
    const dialog = createAriaDialog('dialog', true);
    const anchor = document.createElement('template');
    dialog.append(anchor);
    document.body.append(dialog);
    onTestFinished(() => dialog.remove());

    expect(resolvePortalContainer(anchor)).toBe(dialog);
  });

  it('prefers an inner ARIA alert dialog to an outer native modal', () => {
    const { anchor, dialog } = createDialogWithAnchor();
    const alertDialog = createAriaDialog('alertdialog', true);
    dialog.append(alertDialog);
    alertDialog.append(anchor);
    dialog.showModal();

    expect(resolvePortalContainer(anchor)).toBe(alertDialog);
  });

  it('keeps the native modal as the container for a nested nonmodal ARIA dialog', () => {
    const { anchor, dialog } = createDialogWithAnchor();
    const innerDialog = createAriaDialog('dialog', false);
    dialog.append(innerDialog);
    innerDialog.append(anchor);
    dialog.showModal();

    expect(resolvePortalContainer(anchor)).toBe(dialog);
  });
});
