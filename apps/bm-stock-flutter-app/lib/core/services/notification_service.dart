import '../api/api_client.dart';
import '../api/api_response.dart';
import '../models/notification_model.dart';

class NotificationService {
  final ApiClient _api = ApiClient();

  Future<List<AppNotification>> getAll({int limit = 50, int offset = 0}) async {
    final response = await _api.get(
      '/notifications',
      queryParams: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );
    return parseApiList(response).map((json) => AppNotification.fromJson(json)).toList();
  }

  Future<int> getUnreadCount() async {
    final response = await _api.get('/notifications/unread-count');
    final map = parseApiMap(response);
    final count = map['count'];
    if (count is int) return count;
    return int.tryParse('$count') ?? 0;
  }

  Future<void> markAsRead(String id) async {
    await _api.patch('/notifications/$id/read');
  }

  Future<void> markAllAsRead() async {
    await _api.patch('/notifications/read-all');
  }
}
