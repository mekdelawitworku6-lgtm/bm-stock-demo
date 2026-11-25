class CustomerModel {
  final String id;
  final String name;
  final String? phoneNumber;
  final String? address;
  final String status;
  final String createdAt;
  final String updatedAt;

  CustomerModel({
    required this.id,
    required this.name,
    this.phoneNumber,
    this.address,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      phoneNumber: json['phoneNumber']?.toString(),
      address: json['address'],
      status: json['status'] ?? 'ACTIVE',
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }

  String get displayPhone => (phoneNumber != null && phoneNumber!.isNotEmpty) ? phoneNumber! : '—';
}
