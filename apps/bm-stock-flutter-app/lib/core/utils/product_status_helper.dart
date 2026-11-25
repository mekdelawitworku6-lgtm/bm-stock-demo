/// Maps UI active/inactive toggles to backend [ProductStatus] values.
///
/// Backend enum: `available`, `unavailable`, `discontinued`
class ProductStatusHelper {
  static const apiAvailable = 'available';
  static const apiUnavailable = 'unavailable';
  static const apiDiscontinued = 'discontinued';

  /// UI values: `active` | `inactive`
  static String toUi(String? apiStatus) {
    final status = (apiStatus ?? apiAvailable).toLowerCase();
    if (status == apiUnavailable || status == apiDiscontinued) return 'inactive';
    return 'active';
  }

  static String toApi(String uiStatus) {
    return uiStatus == 'inactive' ? apiUnavailable : apiAvailable;
  }

  static String normalizeImportValue(String raw) {
    final value = raw.trim().toLowerCase();
    if (value == 'inactive' || value == 'unavailable' || value == 'discontinued') {
      return apiUnavailable;
    }
    return apiAvailable;
  }
}
