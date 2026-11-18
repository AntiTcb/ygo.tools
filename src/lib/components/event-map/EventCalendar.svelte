<script lang="ts">
  import { onMount } from 'svelte';
  import type { Calendar, CalendarOptions, EventInput } from 'fullcalendar';
  import { addDays, formatDate, formatTime, overlapsRange } from '#lib/event-map/dates.js';
  import { describeEventTime, eventTimeHint } from '#lib/event-map/event-time.js';
  import type { CalendarRange, EventItem } from '#lib/event-map/types.js';
  // Raw SVG strings: the calendar renders its cards as plain DOM nodes.
  import ChevronLeft from '~icons/lucide/chevron-left?raw';
  import ChevronRight from '~icons/lucide/chevron-right?raw';
  import Globe from '~icons/lucide/globe?raw';
  import MapPin from '~icons/lucide/map-pin?raw';

  interface Props {
    events: EventItem[];
    selectedIds: string[];
    /** Date to navigate to when it changes, e.g. the selected weekend. */
    focusDate: string | null;
    /** Toggles an event's selection. */
    onselect: (id: string) => void;
    /** Called with the displayed range (month or week) as [start, end) YYYY-MM-DD dates. */
    onrangechange?: (range: CalendarRange) => void;
  }

  let { events, selectedIds, focusDate, onselect, onrangechange }: Props = $props();

  const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let el: HTMLDivElement;
  let calendar = $state<Calendar | null>(null);

  const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri, as FullCalendar day numbers (0 = Sunday)

  /** The date range currently displayed, as [start, end) YYYY-MM-DD. */
  let viewRange = $state<{ start: string; end: string } | null>(null);
  /** View type and dates last passed to onrangechange. */
  let reportedRange = '';

  /**
   * Events run on weekends, so weekday columns are hidden. A weekday is shown
   * when an event in the displayed range falls on it (e.g. the Friday of a
   * Fri–Sun YCS), so nothing ever disappears from the calendar.
   */
  const hiddenDays = $derived.by(() => {
    const used: boolean[] = []; // indexed by day of week
    for (const e of events) {
      if (viewRange && !overlapsRange(e, viewRange.start, viewRange.end)) continue;
      for (let d = e.date; d <= (e.endDate ?? e.date); d = addDays(d, 1)) {
        used[new Date(`${d}T00:00:00Z`).getUTCDay()] = true;
      }
    }
    return WEEKDAYS.filter((d) => !used[d]);
  });

  const toInput = (e: EventItem): EventInput => {
    return {
      id: e.id,
      title: e.host,
      start: e.startTime ? `${e.date}T${e.startTime}` : e.date,
      // All-day end dates are exclusive: a Fri–Sun event ends on Monday.
      end: e.endDate ? addDays(e.endDate, 1) : undefined,
      allDay: !e.startTime,
      extendedProps: { item: e },
    };
  };

  /** Wraps a bundled (trusted, build-time) Lucide SVG string in a span. */
  const icon = (svg: string, className = 'ev-icon'): HTMLElement => {
    const wrap = el_('span', className);
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = svg;
    return wrap;
  };

  /** A line of card text with a leading icon. */
  const iconLine = (className: string, svg: string, text: string): HTMLElement => {
    const line = el_('div', className);
    line.appendChild(icon(svg));
    line.appendChild(el_('span', 'ev-text', text));
    return line;
  };

  const el_ = (tag: string, className: string, text?: string): HTMLElement => {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  /** Short chip text, so cards stay narrow on small screens. */
  const CHIP_LABELS: Record<string, string> = { Advanced: 'Adv', Genesys: 'Gen' };

  /**
   * Builds the event card:
   *   10:00 AM Host name
   *   [Remote] [Adv] [Gen]
   *   📍 Venue name
   *      City, ST
   */
  const renderCard = (e: EventItem, selected: boolean): HTMLElement => {
    const card = el_('div', ['ev-card', `ev-${e.type}`, e.isRemote && 'ev-remote', selected && 'ev-selected'].filter(Boolean).join(' '));

    const title = el_('div', 'ev-title');
    const head = el_('div', 'ev-head');
    if (e.startTime) {
      const time = el_('span', 'ev-time', formatTime(e.startTime) + (e.tzNote ? ` ${e.tzNote}` : ''));
      const info = describeEventTime(e);
      time.title = eventTimeHint(e);
      // Underline only when hovering would tell the viewer something new.
      if (info && !info.same) time.classList.add('ev-time-converts');
      head.appendChild(time);
    }
    head.appendChild(el_('span', 'ev-host', e.host));
    title.appendChild(head);

    const chips = [...(e.isRemote ? ['Remote'] : []), ...e.formats];
    if (chips.length) {
      const row = el_('div', 'ev-formats');
      for (const label of chips) {
        const chip = el_('span', `ev-chip ev-chip-${label.toLowerCase()}`, CHIP_LABELS[label] ?? label);
        chip.title = label;
        row.appendChild(chip);
      }
      title.appendChild(row);
    }
    card.appendChild(title);

    if (e.isRemote) {
      card.appendChild(iconLine('ev-meta', Globe, 'Online'));
    } else if (e.venue) {
      const where = el_('div', 'ev-meta ev-where');
      where.appendChild(icon(MapPin));
      const lines = el_('div', 'ev-where-lines');
      // OTS venues are the store itself, so the name would just repeat the host.
      if (e.venue.name && e.venue.name !== e.host) {
        lines.appendChild(el_('div', 'ev-venue', e.venue.name));
      }
      // City and state keep cards short; the full address is in the details panel.
      const place = [e.venue.city, e.state].filter(Boolean).join(', ');
      lines.appendChild(el_('div', 'ev-address', place || e.venue.address));
      where.appendChild(lines);
      card.appendChild(where);
    }

    return card;
  };

  onMount(() => {
    let destroyed = false;

    (async () => {
      if (typeof globalThis.Temporal === 'undefined') await import('temporal-polyfill/global');
      const [{ Calendar }, dayGrid, list, classic] = await Promise.all([
        import('fullcalendar'),
        import('fullcalendar/daygrid'),
        import('fullcalendar/list'),
        import('fullcalendar/themes/classic'),
      ]);
      if (destroyed) return;

      const options: CalendarOptions = {
        plugins: [dayGrid.default, list.default, classic.default],
        // Month cells are too narrow for event cards on phones (below Tailwind's `md`).
        initialView: window.matchMedia('(min-width: 48rem)').matches ? 'dayGridMonth' : 'listMonth',
        initialDate: focusDate ?? undefined,
        headerToolbar: {
          start: 'prev,next today',
          center: 'title',
          end: 'dayGridMonth,dayGridWeek,listMonth',
        },
        buttons: {
          prev: { iconContent: () => ({ domNodes: [icon(ChevronLeft, 'inline-flex [&>svg]:size-4')] }) },
          next: { iconContent: () => ({ domNodes: [icon(ChevronRight, 'inline-flex [&>svg]:size-4')] }) },
        },
        height: 'auto',
        // Show every event in its day cell; never collapse into "+N more".
        dayMaxEvents: false,
        eventDisplay: 'block',
        eventClass: 'ev-host',
        hiddenDays,
        // Start weeks on Friday so each row is one Fri–Sun weekend (Friday is
        // hidden unless something like a YCS starts that day).
        firstDay: 5,
        datesSet: ({ view }) => {
          const start = isoDate(view.currentStart);
          const end = isoDate(view.currentEnd);
          const kind = view.type === 'dayGridWeek' ? 'week' : 'month';
          // Only report a real change: hiddenDays depends on this range, and
          // re-applying it (Friday appearing or disappearing) re-fires datesSet
          // with the same dates, which would restart the map's fit animation.
          const key = `${view.type}|${start}|${end}`;
          if (key === reportedRange) return;
          reportedRange = key;
          viewRange = { start, end };
          onrangechange?.({
            kind,
            start,
            end,
            // FullCalendar titles a week by its month; name the week explicitly instead.
            title: kind === 'week' ? `the week of ${formatDate(start)}` : view.title,
          });
        },
        eventClick: (info) => {
          info.jsEvent.preventDefault();
          onselect(info.event.id);
        },
      };
      calendar = new Calendar(el, options);
      calendar.render();
    })();

    return () => {
      destroyed = true;
      calendar?.destroy();
    };
  });

  $effect(() => {
    if (!calendar) return;
    const selected = new Set(selectedIds);
    calendar.setOption('events', events.map(toInput));
    calendar.setOption('eventContent', (info) => ({
      domNodes: [renderCard(info.event.extendedProps.item as EventItem, selected.has(info.event.id))],
    }));
  });

  let appliedHiddenDays = '';
  $effect(() => {
    const key = hiddenDays.join(',');
    if (!calendar || key === appliedHiddenDays) return;
    appliedHiddenDays = key;
    calendar.setOption('hiddenDays', hiddenDays);
  });

  $effect(() => {
    if (calendar && focusDate) calendar.gotoDate(focusDate);
  });
</script>

<div bind:this={el} class="ygo-calendar min-h-[28rem]"></div>
