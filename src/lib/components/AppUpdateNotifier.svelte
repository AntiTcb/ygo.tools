<script lang="ts">
  import { updated } from '$app/state';
  import { APP_UPDATE_EVENT, shouldNotifyAppUpdate, showAppUpdateToast } from '$lib/appUpdate';
  import { toast } from 'svelte-sonner';

  let alreadyNotified = false;

  const notify = () => {
    if (!shouldNotifyAppUpdate(true, alreadyNotified)) return;
    alreadyNotified = true;
    showAppUpdateToast((message, options) => toast.info(message, options), () => {
      location.reload();
    });
  };

  $effect(() => {
    if (updated.current) notify();
  });

  $effect(() => {
    if (!import.meta.env.DEV) return;

    const onDevNotify = () => notify();
    window.addEventListener(APP_UPDATE_EVENT, onDevNotify);
    return () => window.removeEventListener(APP_UPDATE_EVENT, onDevNotify);
  });

  const checkForUpdate = () => {
    if (document.visibilityState !== 'visible') return;
    void updated.check();
  };
</script>

<svelte:document onvisibilitychange={checkForUpdate} />
