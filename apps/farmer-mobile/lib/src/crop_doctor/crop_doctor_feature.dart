import 'package:flutter_riverpod/flutter_riverpod.dart';

const _cropDoctorShellEnabled = bool.fromEnvironment(
  'CROP_DOCTOR_SHELL_ENABLED',
  defaultValue: false,
);

/// Controls the non-diagnostic Crop Doctor entry and photo guide.
///
/// This does not enable image upload or diagnosis. Those remain unavailable
/// until an approved backend/provider contract exists.
final cropDoctorShellEnabledProvider = Provider<bool>(
  (ref) => _cropDoctorShellEnabled,
);
