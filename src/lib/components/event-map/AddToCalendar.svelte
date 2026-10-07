<script lang="ts">
  import { googleCalendarUrl, outlookCalendarUrl } from '#lib/event-map/calendar-links.js';
  import type { EventItem } from '#lib/event-map/types.js';
  import { Menu, Portal, type MenuRootProps } from '@skeletonlabs/skeleton-svelte';
  import CalendarPlusIcon from '~icons/lucide/calendar-plus';
  import DownloadIcon from '~icons/lucide/download';
  import ExternalLinkIcon from '~icons/lucide/external-link';

  let { event }: { event: EventItem } = $props();

  const targets = $derived([
    { value: 'google', label: 'Google Calendar', href: googleCalendarUrl(event), download: false },
    { value: 'outlook', label: 'Outlook.com', href: outlookCalendarUrl(event, 'live'), download: false },
    { value: 'office', label: 'Outlook (Microsoft 365)', href: outlookCalendarUrl(event, 'office'), download: false },
    { value: 'ics', label: 'Apple Calendar / .ics file', href: `/event-map/events/${event.id}.ics`, download: true },
  ]);

  const onSelect: MenuRootProps['onSelect'] = (e) => {
    const target = targets.find((t) => t.value === e.value);
    if (!target) return;
    if (target.download) {
      Object.assign(document.createElement('a'), { href: target.href, download: '' }).click();
    } else {
      window.open(target.href, '_blank', 'noopener');
    }
  };
</script>

<Menu {onSelect}>
  <Menu.Trigger class="btn btn-sm preset-tonal-primary">
    <CalendarPlusIcon class="size-4" />
    Add to calendar
  </Menu.Trigger>
  <Portal>
    <Menu.Positioner class="z-50">
      <Menu.Content>
        {#each targets as target (target.value)}
          <Menu.Item value={target.value}>
            {#if target.download}<DownloadIcon class="size-4 opacity-60" />{:else}<ExternalLinkIcon class="size-4 opacity-60" />{/if}
            <Menu.ItemText>{target.label}</Menu.ItemText>
          </Menu.Item>
        {/each}
      </Menu.Content>
    </Menu.Positioner>
  </Portal>
</Menu>
