class ShopModel {
  final String id;
  final String name;
  final String? location;
  final String warehouseName;
  final String companyName;
  final int unitsInStock;
  final int unitsStored;
  final String? managerName;
  final String createdAt;
  final String updatedAt;

  ShopModel({
    required this.id,
    required this.name,
    this.location,
    required this.warehouseName,
    required this.companyName,
    required this.unitsInStock,
    required this.unitsStored,
    this.managerName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ShopModel.fromJson(Map<String, dynamic> json) {
    return ShopModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      location: json['location'],
      warehouseName: json['warehouseName'] ?? '',
      companyName: json['companyName'] ?? '',
      unitsInStock: _toInt(json['unitsInStock']),
      unitsStored: _toInt(json['unitsStored']),
      managerName: json['managerName'],
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }
}
