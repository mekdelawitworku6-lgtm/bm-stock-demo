/// Normalizes API payloads from [ApiClient] into a list of JSON maps.
///
/// Handles:
/// - raw lists
/// - paginated `{ data: [...] }` objects (after one unwrap)
/// - double-wrapped `{ data: { data: [...] } }` edge cases
List<Map<String, dynamic>> parseApiList(dynamic result) {
  if (result is List) {
    return result
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  if (result is Map) {
    final map = Map<String, dynamic>.from(result);
    final first = map['data'];
    if (first is List) {
      return first
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    if (first is Map) {
      final nested = Map<String, dynamic>.from(first);
      final second = nested['data'];
      if (second is List) {
        return second
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    }
  }

  return [];
}

Map<String, dynamic> parseApiMap(dynamic result) {
  if (result is Map<String, dynamic>) return result;
  if (result is Map) return Map<String, dynamic>.from(result);
  return {};
}
