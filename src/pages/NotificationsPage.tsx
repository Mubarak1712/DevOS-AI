import { Bell, Check, CheckCheck, AlertCircle, Rocket, Github, Shield, Brain, LucideIcon } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/api';
import { formatRelativeTime } from '@/lib/utils';
import { useState } from 'react';

const notificationTypes: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  build_failed: { icon: AlertCircle, color: 'text-error-500', bg: 'bg-error-100' },
  deployment_down: { icon: Rocket, color: 'text-error-500', bg: 'bg-error-100' },
  deployment_recovered: { icon: Rocket, color: 'text-success-500', bg: 'bg-success-100' },
  repository_inactive: { icon: Github, color: 'text-warning-500', bg: 'bg-warning-100' },
  ssl_expiring: { icon: Shield, color: 'text-warning-500', bg: 'bg-warning-100' },
  ai_suggestion: { icon: Brain, color: 'text-primary-500', bg: 'bg-primary-100' },
};

function NotificationIcon({ type }: { type: string }) {
  const config = notificationTypes[type] || { icon: Bell, color: 'text-neutral-500', bg: 'bg-neutral-100' };
  const IconComponent = config.icon;
  return (
    <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
      <IconComponent className={`w-5 h-5 ${config.color}`} />
    </div>
  );
}

export function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const { data: notifications = [], isLoading, refetch } = useNotifications(activeTab === 'unread');
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead.mutateAsync(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead.mutateAsync();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-neutral-500 mt-1">Stay informed about your projects and deployments</p>
        </div>
        <div className="flex gap-3">
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllAsRead} isLoading={markAllAsRead.isPending}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-primary-50 text-primary-600'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'unread'
              ? 'bg-primary-50 text-primary-600'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => refetch()}
          className="ml-auto px-4 py-2 rounded-lg text-neutral-600 hover:bg-neutral-100"
        >
          Refresh
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-neutral-200 animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-neutral-200 rounded w-2/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Bell className="w-8 h-8" />}
            title="No notifications"
            description={
              activeTab === 'unread'
                ? "You've read all your notifications!"
                : "You're all caught up! New notifications will appear here."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`p-4 hover:shadow-card-hover transition-shadow ${
                !notification.read ? 'border-l-4 border-l-primary-500' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <NotificationIcon type={notification.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-neutral-900">{notification.title}</h3>
                      <p className="text-sm text-neutral-600 mt-1">{notification.message}</p>
                    </div>
                    <span className="text-xs text-neutral-400 whitespace-nowrap ml-4">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
