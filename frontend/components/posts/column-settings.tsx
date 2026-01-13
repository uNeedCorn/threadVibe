"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings2, GripVertical, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { ColumnConfig } from "@/hooks/use-column-config";

interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggle: (id: string) => void;
}

function SortableColumnItem({ column, onToggle }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isLocked = column.locked === true;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-1.5 px-1 rounded ${
        isDragging ? "bg-muted opacity-50" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 text-sm">{column.label}</span>
      {isLocked ? (
        <span className="text-[10px] text-muted-foreground px-1">固定</span>
      ) : (
        <Switch
          checked={column.visible}
          onCheckedChange={() => onToggle(column.id)}
          className="scale-75"
        />
      )}
    </div>
  );
}

interface ColumnSettingsProps {
  columns: ColumnConfig[];
  onToggle: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onReset: () => void;
}

export function ColumnSettings({
  columns,
  onToggle,
  onReorder,
  onReset,
}: ColumnSettingsProps) {
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  };

  const visibleCount = columns.filter(c => c.visible).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="size-4" />
          <span>欄位設定</span>
          <span className="text-muted-foreground">({visibleCount}/{columns.length})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">顯示欄位</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={onReset}
            >
              <RotateCcw className="size-3" />
              重置
            </Button>
          </div>

          <Separator />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                {columns.sort((a, b) => a.order - b.order).map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Separator />

          <p className="text-[11px] text-muted-foreground">
            拖拉調整順序，點擊開關切換顯示
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
