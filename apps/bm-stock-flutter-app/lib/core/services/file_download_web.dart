import 'dart:js_interop';
import 'dart:typed_data';
import 'package:share_plus/share_plus.dart';
import 'package:web/web.dart';

Future<bool> downloadBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  try {
    final blobParts = ([bytes.toJS].toJS) as JSArray<BlobPart>;
    final blob = Blob(blobParts, BlobPropertyBag(type: mimeType));
    final url = URL.createObjectURL(blob);
    final anchor = document.createElement('a') as HTMLAnchorElement
      ..href = url
      ..download = filename;
    document.body?.appendChild(anchor);
    anchor.click();
    // Keep blob URL alive until browser completes download
    Future.delayed(const Duration(seconds: 45), () {
      anchor.remove();
      URL.revokeObjectURL(url);
    });
    return true;
  } catch (_) {
    return false;
  }
}

Future<bool> shareBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  try {
    final result = await Share.shareXFiles(
      [XFile.fromData(bytes, name: filename, mimeType: mimeType)],
      fileNameOverrides: [filename],
    );
    if (result.status == ShareResultStatus.success ||
        result.status == ShareResultStatus.dismissed) {
      return true;
    }
  } catch (_) {}
  // If sharing is unsupported on this browser (e.g. desktop), fallback to direct download
  return downloadBytes(bytes, filename, mimeType);
}

Future<bool> previewBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  try {
    final blobParts = ([bytes.toJS].toJS) as JSArray<BlobPart>;
    final blob = Blob(blobParts, BlobPropertyBag(type: mimeType));
    final url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke after a long delay to allow the tab to load
    Future.delayed(const Duration(minutes: 5), () {
      URL.revokeObjectURL(url);
    });
    return true;
  } catch (_) {
    return false;
  }
}

Future<bool> downloadOrShareBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  return downloadBytes(bytes, filename, mimeType);
}
