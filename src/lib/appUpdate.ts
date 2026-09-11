export const APP_UPDATE_TOAST_ID = 'app-update';
export const APP_UPDATE_MESSAGE = 'A new version is available';
export const APP_UPDATE_DESCRIPTION = 'Reload the page to get the latest updates.';
export const APP_UPDATE_ACTION_LABEL = 'Reload';
export const APP_UPDATE_EVENT = 'ygo:app-update';

export type AppUpdateToastOptions = {
  id: string;
  description: string;
  duration: number;
  closeButton: boolean;
  action: {
    label: string;
    onClick: () => void;
  };
};

export type AppUpdateToastShow = (message: string, options: AppUpdateToastOptions) => void;

export const createAppUpdateToast = (reload: () => void) => ({
  message: APP_UPDATE_MESSAGE,
  options: {
    id: APP_UPDATE_TOAST_ID,
    description: APP_UPDATE_DESCRIPTION,
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: {
      label: APP_UPDATE_ACTION_LABEL,
      onClick: reload,
    },
  } satisfies AppUpdateToastOptions,
});

export const showAppUpdateToast = (show: AppUpdateToastShow, reload: () => void) => {
  const { message, options } = createAppUpdateToast(reload);
  show(message, options);
};

export const shouldNotifyAppUpdate = (isUpdated: boolean, alreadyNotified: boolean) => isUpdated && !alreadyNotified;
