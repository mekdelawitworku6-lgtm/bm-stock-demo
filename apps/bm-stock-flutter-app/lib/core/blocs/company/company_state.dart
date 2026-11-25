import 'package:equatable/equatable.dart';
import '../../models/company_model.dart';

sealed class CompanyState extends Equatable {
  const CompanyState();

  @override
  List<Object?> get props => [];
}

class CompanyInitial extends CompanyState {
  const CompanyInitial();
}

class CompanyLoading extends CompanyState {
  const CompanyLoading();
}

class CompanyLoaded extends CompanyState {
  final List<CompanyModel> companies;
  final CompanyModel? selectedCompany;

  const CompanyLoaded({required this.companies, this.selectedCompany});

  CompanyLoaded copyWith({List<CompanyModel>? companies, CompanyModel? selectedCompany}) {
    return CompanyLoaded(
      companies: companies ?? this.companies,
      selectedCompany: selectedCompany ?? this.selectedCompany,
    );
  }

  @override
  List<Object?> get props => [companies, selectedCompany];
}

class CompanyError extends CompanyState {
  final String message;

  const CompanyError(this.message);

  @override
  List<Object?> get props => [message];
}

/// Emitted when the user tries to add a company beyond their sign-up allowance.
/// The backend records the request and this state triggers the approval / payment
/// popup on the user side.
class CompanyLimitExceeded extends CompanyState {
  final String message;
  final String companyName;

  const CompanyLimitExceeded({required this.message, required this.companyName});

  @override
  List<Object?> get props => [message, companyName];
}
