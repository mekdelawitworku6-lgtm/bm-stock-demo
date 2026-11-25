import 'package:equatable/equatable.dart';
import '../../models/company_model.dart';

sealed class CompanyEvent extends Equatable {
  const CompanyEvent();

  @override
  List<Object?> get props => [];
}

class LoadCompanies extends CompanyEvent {
  final String? seedCompanyId;
  final String? seedCompanyName;

  const LoadCompanies({this.seedCompanyId, this.seedCompanyName});

  @override
  List<Object?> get props => [seedCompanyId, seedCompanyName];
}

class SelectCompany extends CompanyEvent {
  final CompanyModel company;

  const SelectCompany({required this.company});

  @override
  List<Object?> get props => [company];
}

class AddCompany extends CompanyEvent {
  final String name;
  final String? address;
  final String? email;
  final String? phone;

  const AddCompany({
    required this.name,
    this.address,
    this.email,
    this.phone,
  });

  @override
  List<Object?> get props => [name, address, email, phone];
}

class UpdateCompany extends CompanyEvent {
  final String id;
  final String name;
  final String? address;
  final String? email;
  final String? phone;

  const UpdateCompany({
    required this.id,
    required this.name,
    this.address,
    this.email,
    this.phone,
  });

  @override
  List<Object?> get props => [id, name, address, email, phone];
}

class DeleteCompany extends CompanyEvent {
  final String id;

  const DeleteCompany({required this.id});

  @override
  List<Object?> get props => [id];
}

class SyncAuthCompany extends CompanyEvent {
  final String companyId;
  final String companyName;

  const SyncAuthCompany({required this.companyId, required this.companyName});

  @override
  List<Object?> get props => [companyId, companyName];
}

class ClearCompanies extends CompanyEvent {
  const ClearCompanies();
}
