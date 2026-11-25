import 'package:flutter/material.dart';

/// Scroll physics that allow pull-to-refresh even when content is shorter than the viewport.
const refreshScrollPhysics = AlwaysScrollableScrollPhysics(
  parent: BouncingScrollPhysics(),
);

/// Wraps [child] in a vertically scrollable area so [RefreshIndicator] works on empty/short content.
Widget refreshableScrollChild({required Widget child}) {
  return LayoutBuilder(
    builder: (context, constraints) {
      return SingleChildScrollView(
        physics: refreshScrollPhysics,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: constraints.maxHeight,
            minWidth: constraints.maxWidth,
          ),
          child: Center(child: child),
        ),
      );
    },
  );
}
