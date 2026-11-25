import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../../constants/Colors";
import {
  AppNotification,
  useGetNotificationsQuery,
  useMarkAllAsReadMutation,
  useMarkAsReadMutation,
} from "../../../lib/Api/notificationApi";

interface NotificationsScreenProps {
  navigation: any;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { data: notifications = [], isLoading, refetch } = useGetNotificationsQuery({ limit: 50 });
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const todayNotifications = notifications.filter((n) => new Date(n.createdAt) >= today);
  const thisWeekNotifications = notifications.filter((n) => {
    const d = new Date(n.createdAt);
    return d >= weekAgo && d < today;
  });
  const olderNotifications = notifications.filter((n) => new Date(n.createdAt) < weekAgo);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (_) {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id).unwrap();
    } catch (_) {}
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_sale":
        return { name: "receipt" as const, color: "#16A34A" };
      case "credit":
        return { name: "credit-card" as const, color: "#D97706" };
      case "low_stock":
        return { name: "alert-triangle" as const, color: "#DC2626" };
      case "payment":
        return { name: "dollar-sign" as const, color: COLORS.PRIMARY };
      case "transfer":
        return { name: "repeat" as const, color: "#8B5CF6" };
      case "commission":
        return { name: "bar-chart-2" as const, color: "#06B6D4" };
      default:
        return { name: "info" as const, color: "#64748B" };
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 80 }} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {todayNotifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>TODAY</Text>
            {todayNotifications.map((n) => (
              <NotificationTile key={n.id} notification={n} timeAgo={timeAgo} getIcon={getIcon} onPress={() => handleMarkRead(n.id)} />
            ))}
          </>
        )}

        {thisWeekNotifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>THIS WEEK</Text>
            {thisWeekNotifications.map((n) => (
              <NotificationTile key={n.id} notification={n} timeAgo={timeAgo} getIcon={getIcon} onPress={() => handleMarkRead(n.id)} />
            ))}
          </>
        )}

        {olderNotifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>EARLIER</Text>
            {olderNotifications.map((n) => (
              <NotificationTile key={n.id} notification={n} timeAgo={timeAgo} getIcon={getIcon} onPress={() => handleMarkRead(n.id)} />
            ))}
          </>
        )}

        {notifications.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Feather name="bell" size={56} color="#ccc" />
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const NotificationTile = ({
  notification,
  timeAgo,
  getIcon,
  onPress,
}: {
  notification: AppNotification;
  timeAgo: (d: string) => string;
  getIcon: (t: string) => { name: any; color: string };
  onPress: () => void;
}) => {
  const icon = getIcon(notification.type);

  return (
    <TouchableOpacity
      style={[styles.tile, !notification.isRead && styles.tileUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: icon.color + "18" }]}>
        <Feather name={icon.name} size={18} color={icon.color} />
      </View>
      <View style={styles.tileContent}>
        <View style={styles.tileHeader}>
          <Text style={styles.tileTitle} numberOfLines={1}>
            {notification.title}
          </Text>
          {!notification.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.tileMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.tileTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    marginLeft: 16,
  },
  markReadText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  tile: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tileUnread: {
    backgroundColor: "#025EA708",
    borderColor: "#025EA726",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  tileContent: {
    flex: 1,
    marginLeft: 12,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: 6,
  },
  tileMessage: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
    lineHeight: 18,
  },
  tileTime: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
});

export default NotificationsScreen;
