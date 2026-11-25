class WarehouseModel {
  final String id;
  final String name;
  final String? location;
  final String? description;
  final int? capacity;
  final String? companyName;
  final String? managerName;
  final int unitsInStock;
  final int unitsStored;
  final String createdAt;
  final String updatedAt;

  WarehouseModel({
    required this.id,
    required this.name,
    this.location,
    this.description,
    this.capacity,
    this.companyName,
    this.managerName,
    required this.unitsInStock,
    required this.unitsStored,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WarehouseModel.fromJson(Map<String, dynamic> json) {
    return WarehouseModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      location: json['location'],
      description: json['description'],
      capacity: json['capacity'],
      companyName: json['companyName'],
      managerName: json['managerName'],
      unitsInStock: json['unitsInStock'] ?? 0,
      unitsStored: json['unitsStored'] ?? 0,
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }
}
