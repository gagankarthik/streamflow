
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateProjectForm } from "@/components/forms/create-project-form";
import { CreateTaskForm } from "@/components/forms/create-task-form";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, or } from "firebase/firestore";
import { FolderPlus, ListChecks, AlertTriangle, CheckCircle, Target, CalendarClock, PieChart as PieChartIcon, BarChartHorizontalBig, Clock3, Activity, Filter } from "lucide-react";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend as RechartsLegend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { startOfDay, endOfDay, addDays, isWithinInterval, parseISO, isValid, isPast, subDays } from 'date-fns';

interface ProjectStatusData {
  name: string;
  value: number;
  fill: string;
}

interface TaskPriorityData {
  name: string;
  value: number;
  fill: string;
}

type CompletedTasksFilterRange = "today" | "last7days" | "last30days";

interface SummaryStats {
  totalProjects: number;
  activeTasks: number;
  criticalTasks: number;
  toDoTasks: number;
  tasksCompleted: number; // Renamed from tasksCompletedToday
  upcomingDeadlinesCount: number;
  overdueTasks: number;
  averageProjectProgress: number; // Percentage
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted))",
];

const ProjectStatusOrder: Record<string, number> = {
  "In Progress": 1,
  "To Do": 2,
  "Planning": 3,
  "On Hold": 4,
  "Completed": 5,
};

const TaskPriorityOrder: Record<string, number> = {
  "Critical": 1,
  "High": 2,
  "Medium": 3,
  "Low": 4,
};


export default function DashboardPage() {
  const { user } = useAuth();

  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalProjects: 0,
    activeTasks: 0,
    criticalTasks: 0,
    toDoTasks: 0,
    tasksCompleted: 0,
    upcomingDeadlinesCount: 0,
    overdueTasks: 0,
    averageProjectProgress: 0,
  });
  const [projectStatusData, setProjectStatusData] = useState<ProjectStatusData[]>([]);
  const [taskPriorityData, setTaskPriorityData] = useState<TaskPriorityData[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);

  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [completedTasksFilter, setCompletedTasksFilter] = useState<CompletedTasksFilterRange>("today");


  useEffect(() => {
    if (user && user.email && user.uid) {
      setIsLoadingCharts(true);
      let projectsListenerCalled = false;
      let tasksListenerCalled = false;

      const checkAllDataLoaded = () => {
        if (projectsListenerCalled && tasksListenerCalled) {
          setIsLoadingCharts(false);
        }
      };

      const projectsCol = collection(db, "projects");
      const qUserProjects = query(projectsCol, where("memberEmails", "array-contains", user.email));

      const unsubscribeProjects = onSnapshot(qUserProjects, (snapshot) => {
        let totalProgress = 0;
        let activeProjectsCount = 0;

        const statusCounts: Record<string, number> = {};
        snapshot.forEach(doc => {
          const project = doc.data();
          const status = project.status || "To Do";
          statusCounts[status] = (statusCounts[status] || 0) + 1;
          if (project.status !== "Completed") {
            totalProgress += project.progress || 0;
            activeProjectsCount++;
          }
        });

        const avgProgress = activeProjectsCount > 0 ? Math.round(totalProgress / activeProjectsCount) : 0;
        setSummaryStats(prevStats => ({
          ...prevStats,
          totalProjects: snapshot.size,
          averageProjectProgress: avgProgress,
        }));
        
        const formattedProjectStatus = Object.entries(statusCounts)
          .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] }))
          .sort((a,b) => (ProjectStatusOrder[a.name] || 99) - (ProjectStatusOrder[b.name] || 99));
        setProjectStatusData(formattedProjectStatus);
        projectsListenerCalled = true;
        checkAllDataLoaded();
      }, (error) => {
        console.error("Error fetching projects for dashboard: ", error);
        projectsListenerCalled = true;
        checkAllDataLoaded();
      });

      const tasksCol = collection(db, "tasks");
      const qUserTasks = query(tasksCol,
        or(
          where("ownerId", "==", user.uid),
          where("assigneeEmails", "array-contains", user.email)
        )
      );

      const unsubscribeTasks = onSnapshot(qUserTasks, (snapshot) => {
        let activeCount = 0;
        let criticalCount = 0;
        let todoCount = 0;
        let completedCount = 0;
        let upcomingCount = 0;
        let overdueCount = 0;
        const priorityCounts: Record<string, number> = {};

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const sevenDaysFromNow = addDays(todayStart, 7);

        let filterStartDate: Date;
        switch (completedTasksFilter) {
            case "last7days":
                filterStartDate = startOfDay(subDays(new Date(), 6)); // last 7 days including today
                break;
            case "last30days":
                filterStartDate = startOfDay(subDays(new Date(), 29)); // last 30 days including today
                break;
            case "today":
            default:
                filterStartDate = todayStart;
                break;
        }
        const filterEndDate = todayEnd;


        snapshot.forEach(doc => {
          const task = doc.data();
          const isTaskCompleted = task.status === "Completed";

          if (!isTaskCompleted) {
            activeCount++;
            if (task.priority === "Critical") {
              criticalCount++;
            }
            if (task.dueDate) {
              try {
                const dueDate = parseISO(task.dueDate);
                if (isValid(dueDate)) {
                  if (isWithinInterval(dueDate, { start: todayStart, end: sevenDaysFromNow })) {
                    upcomingCount++;
                  }
                  if (isPast(dueDate) && !isToday(dueDate)) {
                    overdueCount++;
                  }
                }
              } catch(e) { console.warn("Invalid due date for task", task.id, task.dueDate); }
            }
          } else { // Task is completed
             if (task.updatedAt instanceof Timestamp) {
                const completedDate = task.updatedAt.toDate();
                if (isWithinInterval(completedDate, { start: filterStartDate, end: filterEndDate })) {
                    completedCount++;
                }
             }
          }

          if (task.status === "To Do") {
            todoCount++;
          }

          if (!isTaskCompleted && task.priority) {
            priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
          }
        });

        setSummaryStats(prevStats => ({
          ...prevStats,
          activeTasks: activeCount,
          criticalTasks: criticalCount,
          toDoTasks: todoCount,
          tasksCompleted: completedCount,
          upcomingDeadlinesCount: upcomingCount,
          overdueTasks: overdueCount,
        }));

        const formattedTaskPriorities = Object.entries(priorityCounts)
          .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] }))
          .sort((a,b) => (TaskPriorityOrder[a.name] || 99) - (TaskPriorityOrder[b.name] || 99));
        setTaskPriorityData(formattedTaskPriorities);
        tasksListenerCalled = true;
        checkAllDataLoaded();
      }, (error) => {
        console.error("Error fetching tasks for dashboard: ", error);
        tasksListenerCalled = true;
        checkAllDataLoaded();
      });

      return () => {
        unsubscribeProjects();
        unsubscribeTasks();
      };
    } else if (!user) {
      setSummaryStats({ totalProjects: 0, activeTasks: 0, criticalTasks: 0, toDoTasks: 0, tasksCompleted: 0, upcomingDeadlinesCount: 0, overdueTasks: 0, averageProjectProgress: 0 });
      setProjectStatusData([]);
      setTaskPriorityData([]);
      setIsLoadingCharts(false);
    }
  }, [user, completedTasksFilter]);

  const userName = user?.displayName?.split(' ')[0] || "User";

  const handleProjectCreated = () => setIsCreateProjectDialogOpen(false);
  const handleTaskCreated = () => setIsCreateTaskDialogOpen(false);

  const pieChartConfig = useMemo(() => {
    const config: Record<string, { label: string, color: string }> = {};
    projectStatusData.forEach((item) => {
        config[item.name] = {
            label: item.name,
            color: item.fill
        };
    });
    return config;
  }, [projectStatusData]);

  const barChartConfig = useMemo(() => {
    const config: Record<string, { label: string, color: string }> = {};
    taskPriorityData.forEach((item) => {
        config[item.name] = {
            label: item.name,
            color: item.fill
        };
    });
    return config;
  }, [taskPriorityData]);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-md text-muted-foreground">
            Welcome back, {userName}! Here&apos;s an overview of your StreamFlow.
          </p>
        </div>
         <div className="flex flex-wrap gap-3 items-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default">
                        <Filter className="mr-2 h-4 w-4" />
                        Completed: {completedTasksFilter === "today" ? "Today" : completedTasksFilter === "last7days" ? "Last 7 Days" : "Last 30 Days"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter Completed Tasks</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={completedTasksFilter} onValueChange={(value) => setCompletedTasksFilter(value as CompletedTasksFilterRange)}>
                        <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="last7days">Last 7 Days</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="last30days">Last 30 Days</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="default">
                        <FolderPlus className="mr-2 h-4 w-4" /> New Project
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5 text-primary" />Create New Project</DialogTitle>
                    <DialogDescription>Fill in the details to start a new project.</DialogDescription>
                  </DialogHeader>
                  <CreateProjectForm onDialogOpenChange={setIsCreateProjectDialogOpen} onFormSubmitSuccess={handleProjectCreated} />
                </DialogContent>
            </Dialog>
            <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
                <DialogTrigger asChild>
                     <Button variant="outline" size="default">
                        <ListChecks className="mr-2 h-4 w-4" /> New Task
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" />Create New Task</DialogTitle>
                    <DialogDescription>Fill in the details to create a new task.</DialogDescription>
                  </DialogHeader>
                  <CreateTaskForm onDialogOpenChange={setIsCreateTaskDialogOpen} onFormSubmitSuccess={handleTaskCreated} />
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderPlus className="h-4 w-4"/>Total Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.totalProjects}</div>
          </CardContent>
        </Card>
         <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-indigo-600"/>Avg. Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.averageProjectProgress}%</div>
            <p className="text-xs text-muted-foreground pt-0.5">(Non-completed projects)</p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4"/>Active Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.activeTasks}</div>
            <p className="text-xs text-muted-foreground pt-0.5">Owned or assigned</p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Target className="h-4 w-4"/>To-Do Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.toDoTasks}</div>
          </CardContent>
        </Card>
         <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600"/>Tasks Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.tasksCompleted}</div>
             <p className="text-xs text-muted-foreground pt-0.5">
                {completedTasksFilter === "today" ? "Today" : completedTasksFilter === "last7days" ? "Last 7 Days" : "Last 30 Days"}
            </p>
          </CardContent>
        </Card>
         <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-blue-600"/>Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.upcomingDeadlinesCount}</div>
            <p className="text-xs text-muted-foreground pt-0.5">In next 7 days (active)</p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive"/>Critical Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.criticalTasks}</div>
            <p className="text-xs text-muted-foreground pt-0.5">Currently active</p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm rounded-lg">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-orange-600"/>Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{summaryStats.overdueTasks}</div>
            <p className="text-xs text-muted-foreground pt-0.5">Currently active</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary" />Project Status Breakdown</CardTitle>
                <CardDescription>Distribution of your projects by current status. Click legend to filter.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingCharts ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <LoadingSpinner className="mr-2"/>Loading chart data...
                    </div>
                ) : projectStatusData.length > 0 ? (
                    <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <RechartsTooltip
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                    content={<ChartTooltipContent hideLabel formatter={(value, name, props) => {
                                        const percent = props.payload?.percent;
                                        return (
                                            <div className="flex flex-col">
                                                <span>{`${props.name}: ${value}`}</span>
                                                {percent !== undefined && <span className="text-xs text-muted-foreground">{`${(percent * 100).toFixed(1)}%`}</span>}
                                            </div>
                                        );
                                    }} />}
                                />
                                <Pie
                                    data={projectStatusData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={90}
                                    labelLine={false}
                                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
                                        if ((percent * 100) < 3) return null;
                                        const RADIAN = Math.PI / 180;
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                        return (
                                            <text x={x} y={y} fill="hsl(var(--primary-foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="11px" fontWeight="medium">
                                                {`${(percent * 100).toFixed(0)}%`}
                                            </text>
                                        );
                                    }}
                                >
                                {projectStatusData.map((entry, index) => (
                                    <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={1}/>
                                ))}
                                </Pie>
                                <RechartsLegend
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    align="center"
                                    iconSize={10}
                                    wrapperStyle={{ fontSize: "12px", paddingTop: "15px", paddingBottom: "5px" }}
                                    formatter={(value, entry) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                       <PieChartIcon className="h-10 w-10 mb-2 opacity-50" />
                       No project data to display. Create a project to see stats here.
                    </div>
                )}
            </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChartHorizontalBig className="h-5 w-5 text-primary"/>Active Task Priorities</CardTitle>
                <CardDescription>Distribution of your active tasks by priority level.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoadingCharts ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <LoadingSpinner className="mr-2"/>Loading chart data...
                    </div>
                ) : taskPriorityData.length > 0 ? (
                    <ChartContainer config={barChartConfig} className="h-[300px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={taskPriorityData} layout="vertical" margin={{left: 10, right:20, top:5, bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={70}/>
                                <RechartsTooltip
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                 <RechartsLegend
                                    layout="horizontal"
                                    verticalAlign="top"
                                    align="right"
                                    iconSize={10}
                                    wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                                    formatter={(value, entry) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}

                                />
                                <Bar dataKey="value"  radius={[0, 4, 4, 0]} barSize={25}>
                                    {taskPriorityData.map((entry, index) => (
                                        <Cell key={`cell-${entry.name}`} fill={entry.fill} name={entry.name}/>
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                        <BarChartHorizontalBig className="h-10 w-10 mb-2 opacity-50"/>
                        No active task priority data to display. Create some tasks!
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

    