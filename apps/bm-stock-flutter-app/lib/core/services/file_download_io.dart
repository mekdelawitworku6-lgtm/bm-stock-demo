import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

Future<bool> downloadBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  try {
    Directory? dir;
    if (Platform.isAndroid) {
      dir = Directory('/storage/emulated/0/Download');
      if (!await dir.exists()) {
        dir = await getExternalStorageDirectory();
      }
    } else {
      dir = await getDownloadsDirectory();
    }
    dir ??= await getApplicationDocumentsDirectory();

    final file = File('${dir.path}${Platform.pathSeparator}$filename');
    await file.writeAsBytes(bytes);
    return true;
  } catch (_) {
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}${Platform.pathSeparator}$filename');
      await file.writeAsBytes(bytes);
      return true;
    } catch (_) {
      return false;
    }
  }
}

Future<bool> shareBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  try {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}${Platform.pathSeparator}$filename');
    await file.writeAsBytes(bytes);
    final result = await Share.shareXFiles(
      [XFile(file.path, mimeType: mimeType)],
      fileNameOverrides: [filename],
    );
    return result.status != ShareResultStatus.unavailable;
  } catch (_) {
    return false;
  }
}

Future<bool> previewBytes(
  Uint8List bytes,
  String filename,
  String mimeType,
) async {
  try {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}${Platform.pathSeparator}$filename');
    await file.writeAsBytes(bytes);
    final uri = Uri.file(file.path);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
      return true;
    }
    // Fallback: try share sheet so user can pick a viewer
    return shareBytes(bytes, filename, mimeType);
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
