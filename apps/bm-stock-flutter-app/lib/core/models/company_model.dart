import 'package:equatable/equatable.dart';

class CompanyModel extends Equatable {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? address;
  final String? description;
  final DateTime? createdAt;

  const CompanyModel({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.address,
    this.description,
    this.createdAt,
  });

  @override
  List<Object?> get props => [id, name, email, phone, address, description, createdAt];

  factory CompanyModel.fromJson(Map<String, dynamic> json) {
    return CompanyModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString(),
      phone: json['phone']?.toString() ?? json['phoneNumber']?.toString(),
      address: json['address']?.toString(),
      description: json['description']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'address': address,
      if (description != null) 'description': description,
    };
  }
}
