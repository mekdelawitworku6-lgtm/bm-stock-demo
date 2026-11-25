class SupplierModel {
  final String id;
  final String name;
  final String contact;
  final String? email;
  final String? address;
  final String? contactPerson;
  final String? taxNumber;
  final String? description;
  final String status;
  final double creditLimit;
  final int paymentTermsDays;
  final String createdAt;
  final String updatedAt;

  SupplierModel({
    required this.id,
    required this.name,
    required this.contact,
    this.email,
    this.address,
    this.contactPerson,
    this.taxNumber,
    this.description,
    required this.status,
    required this.creditLimit,
    required this.paymentTermsDays,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SupplierModel.fromJson(Map<String, dynamic> json) {
    return SupplierModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      contact: json['contact'] ?? '',
      email: json['email'],
      address: json['address'],
      contactPerson: json['contactPerson'],
      taxNumber: json['taxNumber'],
      description: json['description'],
      status: json['status'] ?? 'active',
      creditLimit: _toDouble(json['creditLimit']),
      paymentTermsDays: json['paymentTermsDays'] ?? 30,
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}
