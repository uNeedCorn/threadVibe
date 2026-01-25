"use client";

import { useCallback, useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type Event,
  type EventPropGetter,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { zhTW } from "date-fns/locale";
import { cn } from "@/lib/utils";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

// 設定 date-fns localizer
const locales = { "zh-TW": zhTW };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// 事件介面繼承 Event
export interface ScheduleEvent extends Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  mediaType: string;
  text: string | null;
  createdAt: Date;
  creatorName: string | null;
  topicTag: string | null;
  source?: "scheduled" | "synced";
  currentViews?: number;
  currentLikes?: number;
}

// 加入拖曳功能的 Calendar
const DnDCalendar = withDragAndDrop<ScheduleEvent>(Calendar);

interface ScheduleCalendarProps {
  events: ScheduleEvent[];
  onEventDrop: (eventId: string, newStart: Date) => void;
  onEventClick: (event: ScheduleEvent) => void;
  onSelectSlot?: (start: Date, end: Date) => void;
  view: View;
  onViewChange: (view: View) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  className?: string;
}

// 狀態設定（顏色與標籤）
const STATUS_CONFIG = {
  scheduled: { bg: "rgb(14, 116, 144)", text: "white", label: "排程中" },      // Cyan 700
  publishing: { bg: "rgb(217, 119, 6)", text: "white", label: "發布中" },      // Amber 600
  published: { bg: "rgb(22, 163, 74)", text: "white", label: "排程發布" },     // Green 600 - 排程後發布
  immediate: { bg: "rgb(139, 92, 246)", text: "white", label: "立即發布" },    // Violet 500 - Compose 立即發布
  failed: { bg: "rgb(220, 38, 38)", text: "white", label: "失敗" },            // Red 600
  cancelled: { bg: "rgb(87, 83, 78)", text: "white", label: "已取消" },        // Stone 600
  synced: { bg: "rgb(99, 102, 241)", text: "white", label: "直接發布" },       // Indigo 500 - Threads App 發布
} as const;

// 自訂事件樣式
const eventStyleGetter: EventPropGetter<ScheduleEvent> = (event) => {
  const config = STATUS_CONFIG[event.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;

  return {
    style: {
      backgroundColor: config.bg,
      color: config.text,
      borderRadius: "6px",
      opacity: event.status === "cancelled" ? 0.5 : 1,
      border: "none",
      fontSize: "11px",
      padding: "1px 4px",
    },
  };
};

// 自訂事件內容元件
function EventContent({ event }: { event: ScheduleEvent }) {
  const config = STATUS_CONFIG[event.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <span
        className="shrink-0 rounded px-1 text-[10px] font-medium"
        style={{
          backgroundColor: "rgba(255,255,255,0.25)",
        }}
      >
        {config.label}
      </span>
      <span className="truncate">{event.title}</span>
    </div>
  );
}

// 中文化訊息
const messages = {
  today: "今天",
  previous: "上一頁",
  next: "下一頁",
  month: "月",
  week: "週",
  day: "日",
  agenda: "議程",
  date: "日期",
  time: "時間",
  event: "事件",
  noEventsInRange: "此期間沒有排程",
  showMore: (total: number) => `+${total} 更多`,
};

export function ScheduleCalendar({
  events,
  onEventDrop,
  onEventClick,
  onSelectSlot,
  view,
  onViewChange,
  date,
  onDateChange,
  className,
}: ScheduleCalendarProps) {
  // 處理拖曳事件
  const handleEventDrop = useCallback(
    ({ event, start }: EventInteractionArgs<ScheduleEvent>) => {
      onEventDrop(event.id, start as Date);
    },
    [onEventDrop]
  );

  // 處理點擊事件
  const handleSelectEvent = useCallback(
    (event: ScheduleEvent) => {
      onEventClick(event);
    },
    [onEventClick]
  );

  // 處理選擇時間槽
  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      onSelectSlot?.(start, end);
    },
    [onSelectSlot]
  );

  // 格式化標題
  const formats = useMemo(
    () => ({
      monthHeaderFormat: "yyyy年 M月",
      weekdayFormat: (date: Date) => format(date, "EEE", { locale: zhTW }),
      dayHeaderFormat: "M月d日 EEE",
      dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, "M月d日", { locale: zhTW })} - ${format(end, "M月d日", { locale: zhTW })}`,
      timeGutterFormat: "HH:mm",
      eventTimeRangeFormat: ({ start }: { start: Date; end: Date }) =>
        format(start, "HH:mm", { locale: zhTW }),
      agendaDateFormat: "M月d日 EEE",
      agendaTimeFormat: "HH:mm",
      agendaTimeRangeFormat: ({ start }: { start: Date; end: Date }) =>
        format(start, "HH:mm", { locale: zhTW }),
    }),
    []
  );

  // 自訂元件
  const components = useMemo(
    () => ({
      event: ({ event }: { event: ScheduleEvent }) => <EventContent event={event} />,
    }),
    []
  );

  return (
    <div className={cn("schedule-calendar h-full", className)}>
      <DnDCalendar
        localizer={localizer}
        events={events}
        view={view}
        onView={onViewChange}
        date={date}
        onNavigate={onDateChange}
        onEventDrop={handleEventDrop}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        resizable={false}
        draggableAccessor={(event) => event.status === "scheduled" && event.source !== "synced"}
        eventPropGetter={eventStyleGetter}
        components={components}
        messages={messages}
        formats={formats}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        step={30}
        timeslots={2}
        min={new Date(2020, 0, 1, 0, 0, 0)}
        max={new Date(2020, 0, 1, 23, 59, 59)}
        style={{ height: "100%" }}
        popup
        dayLayoutAlgorithm="no-overlap"
        tooltipAccessor={(event) => event.text || event.title}
      />
    </div>
  );
}

export { Views };
