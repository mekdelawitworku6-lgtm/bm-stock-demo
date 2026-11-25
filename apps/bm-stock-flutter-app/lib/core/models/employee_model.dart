import 'dart:convert';

class EmployeeModel {
  final String id;
  final String name;
  final String phoneNumber;
  final double baseCommissionRate;
  final String baseCommissionType;
  final double salesAmount;
  final String? jobTitle;
  final String? role;
  final String? userId;
  final String? userFullName;
  final String? shopName;
  final String? warehouseName;
  final String? shopId;
  final String? warehouseId;
  final String? authMethod;
  final String? assignedPassword;
  final String? assignedPin;
  final Map<String, dynamic>? permissions;
  final bool isOwner;
  final String createdAt;
  final String updatedAt;

  EmployeeModel({
    required this.id,
    required this.name,
    required this.phoneNumber,
    required this.baseCommissionRate,
    this.baseCommissionType = 'percent',
    required this.salesAmount,
    this.jobTitle,
    this.role,
    this.userId,
    this.userFullName,
    this.shopName,
    this.warehouseName,
    this.shopId,
    this.warehouseId,
    this.authMethod,
    this.assignedPassword,
    this.assignedPin,
    this.permissions,
    this.isOwner = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory EmployeeModel.fromJson(Map<String, dynamic> json) {
    final rateRaw = json['baseCommissionRate'];
    final double rate = rateRaw == null
        ? 0.0
        : rateRaw is num
            ? rateRaw.toDouble()
            : double.tryParse(rateRaw.toString()) ?? 0.0;

    final salesRaw = json['salesAmount'];
    final double sales = salesRaw == null
        ? 0.0
        : salesRaw is num
            ? salesRaw.toDouble()
            : double.tryParse(salesRaw.toString()) ?? 0.0;

    return EmployeeModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      phoneNumber: json['phoneNumber'] ?? '',
      baseCommissionRate: rate,
      baseCommissionType: (json['baseCommissionType'] as String?) ??
          (json['permissions'] is Map && json['permissions']['baseCommissionType'] != null
              ? json['permissions']['baseCommissionType'].toString()
              : 'percent'),
      salesAmount: sales,
      jobTitle: json['jobTitle'],
      role: json['role'] as String?,
      userId: json['userId']?.toString(),
      userFullName: json['userFullName'] as String?,
      shopName: json['shopName'] as String?,
      warehouseName: json['warehouseName'] as String?,
      shopId: json['shopId']?.toString(),
      warehouseId: json['warehouseId']?.toString(),
      authMethod: json['authMethod'] as String?,
      assignedPassword: json['assignedPassword'] as String?,
      assignedPin: json['assignedPin'] as String?,
      permissions: json['permissions'] != null
          ? (json['permissions'] is Map
              ? Map<String, dynamic>.from(json['permissions'])
              : (json['permissions'] is String
                  ? () {
                      try {
                        final decoded = jsonDecode(json['permissions']);
                        return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
                      } catch (_) {
                        return null;
                      }
                    }()
                  : null))
          : null,
      isOwner: json['isOwner'] == true,
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }
}
