
"use client";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, CheckCheck, Trash2, BellOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react"; // For potential future data fetching

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "task" | "comment" | "reminder" | "invite" | "general"; // Added general type
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "task": return <BellRing className="h-5 w-5 text-blue-500" />;
    case "comment": return <BellRing className="h-5 w-5 text-green-500" />; // Consider MessageSquare
    case "reminder": return <BellRing className="h-5 w-5 text-yellow-500" />; // Consider CalendarClock
    case "invite": return <BellRing className="h-5 w-5 text-purple-500" />; // Consider UserPlus
    default: return <BellRing className="h-5 w-5 text-gray-500" />;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // In a real app, manage read/unread state, fetch notifications from Firebase
  // useEffect(() => {
  //   // fetch notifications and setNotifications(data)
  // }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`You have ${unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'no unread notifications'}.`}
        actions={
          notifications.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" disabled={unreadCount === 0}><CheckCheck className="mr-2 h-4 w-4" /> Mark all as read</Button>
              <Button variant="outline" className="hidden sm:flex text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Clear all
              </Button>
            </div>
          ) : null
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg">You're all caught up!</p>
              <p className="text-sm">You have no new notifications at the moment.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`flex items-start space-x-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                    !notification.read ? "bg-primary/5 border-primary/20" : "bg-card"
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold ${!notification.read ? "text-foreground" : "text-foreground/80"}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <Badge variant="default" className="h-2.5 w-2.5 p-0 rounded-full bg-primary ring-2 ring-background" aria-label="Unread notification"></Badge>
                      )}
                    </div>
                    <p className={`text-sm ${!notification.read ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{notification.time}</p>
                  </div>
                  {/* Consider replacing with DropdownMenu for more options like "Mark as read", "View task" */}
                  <Button variant="ghost" size="icon" className="self-start text-muted-foreground hover:text-foreground h-8 w-8"> 
                    <span className="sr-only">Notification options</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
