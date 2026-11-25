import '../api/api_client.dart';

class IssueReportService {
  final ApiClient _api = ApiClient();

  Future<void> submitIssueReport({
    required String title,
    required String description,
    String? category,
    String? appType = 'flutter',
  }) async {
    await _api.post(
      '/issue-reports',
      body: {
        'title': title,
        'description': description,
        'category': category ?? 'General',
        'appType': appType,
      },
    );
  }
}
