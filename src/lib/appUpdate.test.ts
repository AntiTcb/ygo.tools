import { describe, expect, it, vi } from 'vitest';
import {
  APP_UPDATE_ACTION_LABEL,
  APP_UPDATE_DESCRIPTION,
  APP_UPDATE_MESSAGE,
  APP_UPDATE_TOAST_ID,
  createAppUpdateToast,
  shouldNotifyAppUpdate,
  showAppUpdateToast,
} from './appUpdate';

describe('shouldNotifyAppUpdate', () => {
  it('notifies only the first time a new version is detected', () => {
    expect(shouldNotifyAppUpdate(false, false)).toBe(false);
    expect(shouldNotifyAppUpdate(true, false)).toBe(true);
    expect(shouldNotifyAppUpdate(true, true)).toBe(false);
    expect(shouldNotifyAppUpdate(false, true)).toBe(false);
  });
});

describe('createAppUpdateToast', () => {
  it('builds a persistent reload toast', () => {
    const reload = vi.fn();
    const toast = createAppUpdateToast(reload);

    expect(toast.message).toBe(APP_UPDATE_MESSAGE);
    expect(toast.options).toMatchObject({
      id: APP_UPDATE_TOAST_ID,
      description: APP_UPDATE_DESCRIPTION,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      action: { label: APP_UPDATE_ACTION_LABEL },
    });

    toast.options.action.onClick();
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe('showAppUpdateToast', () => {
  it('passes the reload toast to the notifier', () => {
    const show = vi.fn();
    const reload = vi.fn();

    showAppUpdateToast(show, reload);

    expect(show).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledWith(APP_UPDATE_MESSAGE, createAppUpdateToast(reload).options);
  });
});
