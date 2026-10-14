import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/finance";

export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cm = currentMonth();
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1">
      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Mês anterior">
        <ChevronLeft />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex min-w-36 items-center justify-center gap-2 px-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {monthLabel(value)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[-1, 0, 1, 2, 3, 6].map((n) => {
              const m = shiftMonth(cm, n);
              return (
                <Button key={n} size="sm" variant={m === value ? "default" : "secondary"} onClick={() => onChange(m)}>
                  {n === 0 ? "Atual" : n === -1 ? "Anterior" : `+${n}m`}
                </Button>
              );
            })}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Personalizado</p>
            <Input type="month" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
          </div>
        </PopoverContent>
      </Popover>
      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => onChange(shiftMonth(value, 1))} aria-label="Próximo mês">
        <ChevronRight />
      </Button>
    </div>
  );
}
