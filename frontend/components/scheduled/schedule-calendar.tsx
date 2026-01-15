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

// 事件顏色對應 (使用 Tailwind CSS 顏色)
const STATUS_COLORS = {
  scheduled: { bg: "rgb(20, 184, 166)", text: "white" },      // Teal 500
  publishing: { bg: "rgb(245, 158, 11)", text: "white" },     // Amber 500
  published: { bg: "rgb(34, 197, 94)", text: "white" },       // Green 500
  failed: { bg: "rgb(239, 68, 68)", text: "white" },          // Red 500
  cancelled: { bg: "rgb(120, 113, 108)", text: "white" },     // Stone 500
} as const;

// 自訂事件樣式
const eventStyleGetter: EventPropGetter<ScheduleEvent> = (event) => {
  const colors = STATUS_COLORS[event.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.scheduled;

  return {
    style: {
      backgroundColor: colors.bg,
      color: colors.text,
      borderRadius: "6px",
      opacity: event.status === "cancelled" ? 0.5 : 1,
      border: "none",
      fontSize: "12px",
      padding: "2px 6px",
    },
  };
};

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
        draggableAccessor={() => true}
        eventPropGetter={eventStyleGetter}
        messages={messages}
        formats={formats}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        step={30}
        timeslots={2}
        min={new Date(2020, 0, 1, 0, 0, 0)}
        max={new Date(2020, 0, 1, 23, 59, 59)}
        style={{ height: "100%" }}
        popup
        tooltipAccessor={(event) => event.text || event.title}
      />
    </div>
  );
}

export { Views };
