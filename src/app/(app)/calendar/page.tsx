
"use client";

import * as React from "react";
import {
  addMonths,
  format,
  isSameDay,
  startOfDay,
  parseISO,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  eachDayOfInterval,
  getHours,
  getMinutes,
  differenceInMinutes,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  isValid
} from "date-fns";
import { ChevronLeft, ChevronRight, PlusCircle, CalendarIcon as PageCalendarIcon, Clock, Eye, ListChecks } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateTaskForm, type Assignee } from "@/components/forms/create-task-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";


import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, DocumentData, or } from "firebase/firestore";

interface CalendarTask {
  id: string;
  title: string;
  dueDate: Date;
  startTime?: string; // "HH:mm"
  endTime?: string;   // "HH:mm"
  description?: string;
  assignees?: Assignee[];
  assigneeEmails?: string[]; // Added for querying
  projectId?: string;
  projectName?: string;
}

const parseTaskDate = (dateInput: string | Timestamp | undefined): Date | null => {
  if (!dateInput) return null;
  try {
    let parsedDate: Date;
    if (dateInput instanceof Timestamp) {
      parsedDate = dateInput.toDate();
    } else if (typeof dateInput === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [year, month, day] = dateInput.split('-').map(Number);
        parsedDate = new Date(Date.UTC(year, month - 1, day));
      } else {
        parsedDate = parseISO(dateInput);
      }
    } else {
      return null;
    }

    if (isValid(parsedDate)) {
      return startOfDay(parsedDate);
    }
  } catch (e) {
    console.error("Error parsing date:", dateInput, e);
  }
  return null;
};

const HOUR_HEIGHT_PX = 50;

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDisplayMonth, setCurrentDisplayMonth] = React.useState<Date>(startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(startOfDay(new Date()));
  const [tasks, setTasks] = React.useState<CalendarTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<string>("month");
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = React.useState(false);


  React.useEffect(() => {
    if (user && user.email) {
      setIsLoadingTasks(true);
      const tasksCol = collection(db, "tasks");
      const q = query(tasksCol,
        or(
          where("ownerId", "==", user.uid),
          where("assigneeEmails", "array-contains", user.email) // Updated query
        )
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTasks: CalendarTask[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as DocumentData;
          const dueDate = parseTaskDate(data.dueDate);
          if (dueDate) {
            fetchedTasks.push({
              id: doc.id,
              title: data.title || "Untitled Task",
              description: data.description,
              dueDate: dueDate,
              startTime: data.startTime,
              endTime: data.endTime,
              assignees: data.assignees || [],
              assigneeEmails: data.assigneeEmails || [],
              projectId: data.projectId,
              projectName: data.projectName,
            });
          }
        });
        setTasks(fetchedTasks);
        setIsLoadingTasks(false);
      }, (error) => {
        console.error("Error fetching tasks: ", error);
        setIsLoadingTasks(false);
      });

      return () => unsubscribe();
    } else {
      setTasks([]);
      setIsLoadingTasks(false);
    }
  }, [user]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        setSelectedDate(startOfDay(date));
    } else {
        setSelectedDate(undefined);
    }
  };

  const navigateDate = (direction: 'prev' | 'next', unit: 'day' | 'week') => {
    if (selectedDate) {
      let newSelectedDate;
      if (unit === 'day') {
        newSelectedDate = direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
      } else { // unit === 'week'
        newSelectedDate = direction === 'prev' ? subWeeks(selectedDate, 1) : addWeeks(selectedDate, 1);
      }
      setSelectedDate(newSelectedDate);
      setCurrentDisplayMonth(newSelectedDate);
    }
  };

  const eventDays = React.useMemo(() => {
    return tasks.map(task => task.dueDate);
  }, [tasks]);

  const modifiers = { hasEvent: eventDays };
  const modifiersClassNames = { hasEvent: "day-has-event" };

  const tasksForSelectedDate = selectedDate
    ? tasks.filter(task => isSameDay(task.dueDate, selectedDate))
    : [];

  const selectedWeekStart = selectedDate ? startOfWeek(selectedDate, { weekStartsOn: 1 /* Monday */ }) : null;
  const selectedWeekEnd = selectedDate ? endOfWeek(selectedDate, { weekStartsOn: 1 /* Monday */ }) : null;

  const daysInSelectedWeek = selectedWeekStart && selectedWeekEnd ? eachDayOfInterval({ start: selectedWeekStart, end: selectedWeekEnd }) : [];

  const tasksForDay = (day: Date) => tasks.filter(task => isSameDay(task.dueDate, day));

  const getTaskPositionAndHeight = (task: CalendarTask) => {
    if (!task.startTime || !task.endTime) return null;

    const [startH, startM] = task.startTime.split(':').map(Number);
    const [endH, endM] = task.endTime.split(':').map(Number);

    const top = (startH + startM / 60) * HOUR_HEIGHT_PX;
    const bottom = (endH + endM / 60) * HOUR_HEIGHT_PX;
    const height = Math.max(HOUR_HEIGHT_PX / 2, bottom - top);

    return { top, height };
  };

  const renderTaskListItems = (tasksToRender: CalendarTask[], showDay: boolean = false) => {
     if (isLoadingTasks && !tasksToRender.length) {
        return (
            <div className="flex items-center justify-center p-4">
            <LoadingSpinner /> <span className="ml-2">Loading tasks...</span>
            </div>
        );
    }
    if (tasksToRender.length === 0) {
        return <p className="text-muted-foreground text-sm">No tasks scheduled for this period.</p>;
    }
    return (
        <div className="space-y-3">
        {tasksToRender.sort((a,b) => {
            if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
            if (a.startTime) return -1;
            if (b.startTime) return 1;
            return a.dueDate.getTime() - b.dueDate.getTime();
        }).map((event) => (
            <Link href={`/tasks/${event.id}`} key={event.id} className="block group">
              <Card className="p-3 shadow-sm hover:shadow-md transition-shadow hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full border-2 border-primary bg-background flex-shrink-0 group-hover:bg-primary/20"></div>
                  <div className="flex-1">
                      <p className="font-medium text-foreground group-hover:text-primary">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                      {showDay && `${format(event.dueDate, "EEE, MMM dd")} - `}
                      {event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : "All day"}
                      </p>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"/>
                  </div>
              </Card>
            </Link>
        ))}
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        actions={
          <Button variant="outline" onClick={() => {
            const today = startOfDay(new Date());
            setCurrentDisplayMonth(today);
            setSelectedDate(today);
          }}>
            Today
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>

        <TabsContent value="month">
          <Card className="shadow-lg">
            <CardContent className="p-0 md:p-4 flex flex-col items-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={currentDisplayMonth}
                onMonthChange={setCurrentDisplayMonth}
                numberOfMonths={2}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                className="p-0 rounded-md [&_td]:w-10 [&_td]:h-10 [&_button]:w-10 [&_button]:h-10 sm:[&_td]:w-12 sm:[&_td]:h-12 sm:[&_button]:w-12 sm:[&_button]:h-12"
                classNames={{
                  months: "flex flex-col sm:flex-row gap-4 sm:gap-8",
                  caption_label: "text-lg font-medium",
                  nav_button: "h-8 w-8",
                  day: "text-sm",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90",
                }}
              />
            </CardContent>
          </Card>

          {selectedDate && (
            <div className="mt-4">
                <h2 className="text-xl font-semibold text-foreground mb-3">
                    Tasks for {format(selectedDate, "MMMM dd, yyyy")}
                </h2>
                {renderTaskListItems(tasksForSelectedDate)}
            </div>
          )}

          <div className="mt-8">
            <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" /> New Task
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" />Create New Task</DialogTitle>
                        <DialogDescription>Fill in the details to create a new task. It will appear on the calendar if it has a due date.</DialogDescription>
                    </DialogHeader>
                    <CreateTaskForm onDialogOpenChange={setIsCreateTaskDialogOpen} onFormSubmitSuccess={() => setIsCreateTaskDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="week">
            <Card className="shadow-lg p-4 sm:p-6">
                {selectedDate && selectedWeekStart && selectedWeekEnd ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <Button variant="ghost" size="icon" onClick={() => navigateDate('prev', 'week')} disabled={!selectedDate}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <h2 className="text-xl font-semibold text-foreground text-center">
                                Week: {format(selectedWeekStart, "MMM dd")} - {format(selectedWeekEnd, "MMM dd, yyyy")}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => navigateDate('next', 'week')} disabled={!selectedDate}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                        {isLoadingTasks && !daysInSelectedWeek.some(day => tasksForDay(day).length > 0) ? (
                             <div className="flex items-center justify-center p-4 min-h-[200px]">
                                <LoadingSpinner /> <span className="ml-2">Loading weekly tasks...</span>
                             </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4">
                                {daysInSelectedWeek.map(day => (
                                    <div key={day.toString()} className="border rounded-lg p-3 bg-muted/20">
                                        <p className="font-semibold text-sm text-center mb-2 pb-2 border-b">
                                            {format(day, "EEE dd")}
                                        </p>
                                        {tasksForDay(day).length > 0 ? (
                                            <ScrollArea className="h-48">
                                                <ul className="space-y-2 pr-2">
                                                    {tasksForDay(day).sort((a,b) => {
                                                        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
                                                        if (a.startTime) return -1;
                                                        if (b.startTime) return 1;
                                                        return 0;
                                                    }).map(task => (
                                                        <li key={task.id}>
                                                            <Link href={`/tasks/${task.id}`} className="block group">
                                                                <Card className="p-2.5 shadow-sm hover:shadow-md transition-shadow text-xs hover:bg-card cursor-pointer">
                                                                    <p className="font-medium text-foreground group-hover:text-primary truncate">{task.title}</p>
                                                                    <p className="text-muted-foreground">
                                                                        {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "All day"}
                                                                    </p>
                                                                </Card>
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </ScrollArea>
                                        ) : (
                                            <p className="text-xs text-muted-foreground text-center py-2">No tasks</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground min-h-[200px]">
                        <p>Select a date in the 'Month' view to see weekly tasks, or click 'Today'.</p>
                    </div>
                )}
            </Card>
        </TabsContent>

        <TabsContent value="day">
            <Card className="shadow-lg p-4 sm:p-6">
                {selectedDate ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                             <Button variant="ghost" size="icon" onClick={() => navigateDate('prev', 'day')} disabled={!selectedDate}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <h2 className="text-xl font-semibold text-foreground text-center">
                                Schedule for {format(selectedDate, "MMMM dd, yyyy")}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => navigateDate('next', 'day')} disabled={!selectedDate}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                        {isLoadingTasks && !tasksForSelectedDate.length ? (
                             <div className="flex items-center justify-center p-4 min-h-[300px]">
                                <LoadingSpinner /> <span className="ml-2">Loading tasks for the day...</span>
                             </div>
                        ) : (
                        <>
                            {tasksForSelectedDate.filter(t => !t.startTime || !t.endTime).length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-md font-semibold text-muted-foreground mb-2">All-day Tasks</h3>
                                    <div className="space-y-2">
                                    {tasksForSelectedDate.filter(t => !t.startTime || !t.endTime).map(task => (
                                        <Link href={`/tasks/${task.id}`} key={task.id} className="block group">
                                            <Card className="p-3 shadow-sm hover:shadow-md transition-shadow hover:bg-muted/50 cursor-pointer">
                                                 <p className="font-medium text-foreground group-hover:text-primary">{task.title}</p>
                                            </Card>
                                        </Link>
                                    ))}
                                    </div>
                                    <Separator className="my-4"/>
                                </div>
                            )}

                            <div className="relative">
                                <ScrollArea className="h-[600px] pr-4">
                                    <div className="relative">
                                        {Array.from({ length: 24 }).map((_, hour) => (
                                        <div
                                            key={`hour-marker-${hour}`}
                                            className="h-[--hour-height] border-t border-border flex items-start"
                                            style={{ '--hour-height': `${HOUR_HEIGHT_PX}px` } as React.CSSProperties}
                                        >
                                            <span className="text-xs text-muted-foreground -translate-y-1/2 pr-2 bg-background relative z-10">
                                                {`${String(hour).padStart(2, '0')}:00`}
                                            </span>
                                        </div>
                                        ))}

                                        {tasksForSelectedDate.filter(t => t.startTime && t.endTime).map(task => {
                                        const pos = getTaskPositionAndHeight(task);
                                        if (!pos) return null;
                                        return (
                                            <Link href={`/tasks/${task.id}`} key={task.id} className="block absolute left-16 right-0 group cursor-pointer"
                                                  style={{ top: `${pos.top}px`, height: `${pos.height}px` }}>
                                                <Card
                                                    className="p-2 shadow-md hover:shadow-lg transition-shadow bg-primary/10 border-primary/30 text-primary-foreground h-full overflow-hidden hover:bg-primary/20"
                                                >
                                                    <p className="font-semibold text-xs text-primary truncate group-hover:text-primary-dark">{task.title}</p>
                                                    <p className="text-xs text-primary/80">{task.startTime} - {task.endTime}</p>
                                                </Card>
                                            </Link>
                                        );
                                        })}
                                    </div>
                                </ScrollArea>
                                {tasksForSelectedDate.filter(t => t.startTime && t.endTime).length === 0 && tasksForSelectedDate.filter(t => !t.startTime || !t.endTime).length === 0 && (
                                     <p className="text-muted-foreground text-sm text-center py-10">No tasks scheduled for this day.</p>
                                )}
                            </div>
                        </>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground min-h-[300px]">
                        <p>Select a date in the 'Month' view to see the daily schedule, or click 'Today'.</p>
                    </div>
                )}
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


    