import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../api/api_client.dart';
import '../../api/api_exceptions.dart';
import '../../api/api_response.dart';
import '../../models/company_model.dart';
import 'company_event.dart';
import 'company_state.dart';

class CompanyBloc extends Bloc<CompanyEvent, CompanyState> {
  final ApiClient _api = ApiClient();

  CompanyBloc() : super(const CompanyInitial()) {
    on<LoadCompanies>(_onLoadCompanies);
    on<SyncAuthCompany>(_onSyncAuthCompany);
    on<SelectCompany>(_onSelectCompany);
    on<AddCompany>(_onAddCompany);
    on<UpdateCompany>(_onUpdateCompany);
    on<DeleteCompany>(_onDeleteCompany);
    on<ClearCompanies>(_onClearCompanies);
  }

  Future<void> _onLoadCompanies(LoadCompanies event, Emitter<CompanyState> emit) async {
    final previous = state is CompanyLoaded ? state as CompanyLoaded : null;
    if (previous == null) {
      emit(const CompanyLoading());
    }

    try {
      final result = await _api.get('/companies', queryParams: {'limit': '100'});
      final list = parseApiList(result)
          .map((e) => CompanyModel.fromJson(e))
          .where((c) => c.id.isNotEmpty && c.name.isNotEmpty)
          .toList();

      _mergeSeedCompany(list, event.seedCompanyId, event.seedCompanyName);

      final prefs = await SharedPreferences.getInstance();
      final savedId = prefs.getString('selected_company_id') ??
          event.seedCompanyId ??
          previous?.selectedCompany?.id;

      CompanyModel? selected;
      if (savedId != null && savedId.isNotEmpty) {
        selected = list.cast<CompanyModel?>().firstWhere(
              (c) => c!.id == savedId,
              orElse: () => null,
            );
      }
      selected ??= list.isNotEmpty ? list.first : null;

      if (selected != null) {
        await prefs.setString('selected_company_id', selected.id);
        await prefs.setString(
          'companies',
          json.encode(list.map((c) => c.toJson()).toList()),
        );
      }

      emit(CompanyLoaded(companies: list, selectedCompany: selected));
    } on UnauthorizedException catch (_) {
      await _emitSeededOrError(event, emit);
    } catch (e) {
      await _emitSeededOrError(event, emit);
    }
  }

  Future<void> _emitSeededOrError(LoadCompanies event, Emitter<CompanyState> emit) async {
    if (event.seedCompanyId?.isEmpty ?? true) {
      emit(const CompanyError('Session expired. Please log in again.'));
      return;
    }

    String name = event.seedCompanyName ?? '';
    if (name.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      final companiesJson = prefs.getString('companies');
      if (companiesJson != null) {
        try {
          final cachedList = (json.decode(companiesJson) as List)
              .map((e) => CompanyModel.fromJson(e as Map<String, dynamic>))
              .toList();
          final cached = cachedList.where((c) => c.id == event.seedCompanyId).firstOrNull;
          if (cached != null) name = cached.name;
        } catch (_) {}
      }
    }
    if (name.isEmpty) {
      name = 'Business';
    }

    final seeded = CompanyModel(id: event.seedCompanyId!, name: name);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('selected_company_id', seeded.id);
    await prefs.setString('companies', json.encode([seeded.toJson()]));
    emit(CompanyLoaded(companies: [seeded], selectedCompany: seeded));
  }

  void _mergeSeedCompany(
    List<CompanyModel> list,
    String? seedCompanyId,
    String? seedCompanyName,
  ) {
    if (seedCompanyId == null ||
        seedCompanyId.isEmpty ||
        seedCompanyName == null ||
        seedCompanyName.isEmpty) {
      return;
    }
    if (list.any((c) => c.id == seedCompanyId)) return;
    list.insert(
      0,
      CompanyModel(id: seedCompanyId, name: seedCompanyName),
    );
  }

  Future<void> _onSyncAuthCompany(SyncAuthCompany event, Emitter<CompanyState> emit) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('selected_company_id', event.companyId);
    _api.setSelectedCompanyId(event.companyId);
    final seeded = CompanyModel(id: event.companyId, name: event.companyName);
    await prefs.setString('companies', json.encode([seeded.toJson()]));
    final companies = [seeded];
    emit(CompanyLoaded(companies: companies, selectedCompany: seeded));
  }

  Future<void> _onSelectCompany(SelectCompany event, Emitter<CompanyState> emit) async {
    if (state is CompanyLoaded) {
      final current = state as CompanyLoaded;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('selected_company_id', event.company.id);
      _api.setSelectedCompanyId(event.company.id);
      emit(CompanyLoaded(
        companies: current.companies,
        selectedCompany: event.company,
      ));
    }
  }

  Future<void> _onAddCompany(AddCompany event, Emitter<CompanyState> emit) async {
    try {
      final payload = <String, dynamic>{
        'name': event.name.trim(),
        'address': event.address ?? 'Not specified',
      };
      if (event.email != null) payload['email'] = event.email;
      if (event.phone != null) payload['phoneNumber'] = event.phone;

      final result = await _api.post('/companies', body: payload);
      final created = CompanyModel.fromJson(parseApiMap(result));

      final current = state is CompanyLoaded ? state as CompanyLoaded : null;
      final updated = <CompanyModel>[
        if (created.id.isNotEmpty) created,
        ...?current?.companies.where((c) => c.id != created.id),
      ];
      if (created.id.isEmpty) {
        add(const LoadCompanies());
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('selected_company_id', created.id);
      _api.setSelectedCompanyId(created.id);
      emit(CompanyLoaded(companies: updated, selectedCompany: created));

      add(LoadCompanies(
        seedCompanyId: created.id,
        seedCompanyName: created.name,
      ));
    } on ApiException catch (e) {
      if (e is ForbiddenException) {
        emit(CompanyLimitExceeded(
          message: e.message,
          companyName: event.name,
        ));
      } else {
        emit(CompanyError(e.message));
      }
      if (state is! CompanyLoaded) {
        add(const LoadCompanies());
      }
    } catch (e) {
      emit(CompanyError('Failed to add company: $e'));
      if (state is! CompanyLoaded) {
        add(const LoadCompanies());
      }
    }
  }

  Future<void> _onUpdateCompany(UpdateCompany event, Emitter<CompanyState> emit) async {
    try {
      final payload = <String, dynamic>{
        'name': event.name,
      };
      if (event.address != null) payload['address'] = event.address;
      if (event.email != null) payload['email'] = event.email;
      if (event.phone != null) payload['phoneNumber'] = event.phone;

      await _api.put('/companies/${event.id}', body: payload);

      if (state is CompanyLoaded) {
        final current = state as CompanyLoaded;
        final updated = current.companies.map((c) {
          if (c.id == event.id) {
            return CompanyModel(
              id: c.id,
              name: event.name,
              email: event.email,
              phone: event.phone,
              address: event.address,
            );
          }
          return c;
        }).toList();
        emit(CompanyLoaded(
          companies: updated,
          selectedCompany: current.selectedCompany?.id == event.id
              ? CompanyModel(
                  id: event.id,
                  name: event.name,
                  email: event.email,
                  phone: event.phone,
                  address: event.address,
                )
              : current.selectedCompany,
        ));
      }
    } catch (e) {
      emit(CompanyError('Failed to update company: $e'));
    }
  }

  Future<void> _onDeleteCompany(DeleteCompany event, Emitter<CompanyState> emit) async {
    try {
      await _api.delete('/companies/${event.id}');

      if (state is CompanyLoaded) {
        final current = state as CompanyLoaded;
        final updated = current.companies.where((c) => c.id != event.id).toList();
        CompanyModel? newSelected = current.selectedCompany;
        if (current.selectedCompany?.id == event.id) {
          newSelected = updated.isNotEmpty ? updated.first : null;
          final prefs = await SharedPreferences.getInstance();
          if (newSelected != null) {
            await prefs.setString('selected_company_id', newSelected.id);
          } else {
            await prefs.remove('selected_company_id');
          }
        }
        emit(CompanyLoaded(companies: updated, selectedCompany: newSelected));
      }
    } catch (e) {
      emit(CompanyError('Failed to delete company: $e'));
    }
  }

  Future<void> _onClearCompanies(ClearCompanies event, Emitter<CompanyState> emit) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('selected_company_id');
    await prefs.remove('companies');
    emit(const CompanyInitial());
  }
}
