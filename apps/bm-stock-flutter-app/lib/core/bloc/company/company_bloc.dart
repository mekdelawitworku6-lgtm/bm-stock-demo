// Re-export the canonical company bloc implementation.
// core/bloc/ is the directory referenced by main.dart for provider registration.
// The actual implementation lives in core/blocs/ and is used by all feature screens.
// By re-exporting from here, both import paths resolve to the same Dart types,
// eliminating "Could not find correct Provider" errors.
export '../../blocs/company/company_bloc.dart';
export '../../blocs/company/company_event.dart';
export '../../blocs/company/company_state.dart';
