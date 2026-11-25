import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/blocs/company/company_bloc.dart';
import '../../../core/blocs/company/company_event.dart';
import '../../../core/blocs/company/company_state.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/models/company_model.dart';

const _kBlue = Color(0xFF025EA7);
const _kBlueDark = Color(0xFF024A85);
const _kSlate = Color(0xFF64748B);
const _kInk = Color(0xFF0F172A);
const _kBorder = Color(0xFFE2E8F0);
const _kBg = Color(0xFFF8FAFC);

class CompanySwitcher extends StatelessWidget {
  const CompanySwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CompanyBloc, CompanyState>(
      builder: (context, state) {
        final companyName = state is CompanyLoaded ? state.selectedCompany?.name : null;

        return GestureDetector(
          onTap: () => _showCompanySheet(context),
          child: Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: _kBlueDark,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.business, size: 16, color: Colors.white),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    companyName ?? context.tr('company_name'),
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.expand_more, size: 18, color: Colors.white),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showCompanySheet(BuildContext outerContext) {
    showDialog(
      context: outerContext,
      builder: (ctx) {
        return BlocBuilder<CompanyBloc, CompanyState>(
          bloc: outerContext.read<CompanyBloc>(),
          builder: (context, state) {
            final isLoading = state is CompanyLoading;
            final rawCompanies = state is CompanyLoaded ? state.companies : <CompanyModel>[];
            final companies = rawCompanies.where((c) {
              final nameLower = c.name.trim().toLowerCase();
              return !nameLower.contains('for 1 year') &&
                  !nameLower.contains('for 6 month') &&
                  !nameLower.contains('for 1 month') &&
                  nameLower != 'for 1 year';
            }).toList();
            final selected = state is CompanyLoaded ? state.selectedCompany : null;

            return Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top + kToolbarHeight + 16,
                ),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  elevation: 8,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.9,
                      maxHeight: MediaQuery.of(context).size.height * 0.55,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                context.tr('company_name'),
                                style: GoogleFonts.outfit(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: _kInk,
                                ),
                              ),
                              GestureDetector(
                                onTap: () => Navigator.pop(ctx),
                                child: const Icon(Icons.close, size: 20, color: _kSlate),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (isLoading && companies.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 24),
                              child: Center(child: CircularProgressIndicator()),
                            )
                          else if (companies.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 20),
                              child: Center(
                                child: Text(
                                  context.tr('no_results_found'),
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    color: _kSlate,
                                  ),
                                ),
                              ),
                            )
                          else
                            Expanded(
                              child: SingleChildScrollView(
                                child: Column(
                                  children: companies
                                      .map(
                                        (company) => _CompanyTile(
                                          company: company,
                                          isSelected: company.id == selected?.id,
                                          onTap: () {
                                            outerContext.read<CompanyBloc>().add(SelectCompany(company: company));
                                            Navigator.pop(ctx);
                                          },
                                        ),
                                      )
                                      .toList(),
                                ),
                              ),
                            ),
                          const SizedBox(height: 8),
                          const Divider(height: 1, color: _kBorder),
                          const SizedBox(height: 8),
                          _AddCompanyTile(
                            onTap: () {
                              Navigator.pop(ctx);
                              _showAddCompanyDialog(outerContext);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showAddCompanyDialog(BuildContext context) {
    final nameController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            context.tr('company_name'),
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
          content: Form(
            key: formKey,
            child: SizedBox(
              width: double.maxFinite,
              child: TextFormField(
                controller: nameController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: context.tr('company_name'),
                  hintStyle: GoogleFonts.outfit(color: _kSlate),
                  filled: true,
                  fillColor: _kBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: _kBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: _kBorder),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                ),
                style: GoogleFonts.outfit(fontSize: 15, color: _kInk),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? context.tr('required') : null,
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                context.tr('cancel'),
                style: GoogleFonts.outfit(color: _kSlate),
              ),
            ),
            TextButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(ctx);
                context.read<CompanyBloc>().add(AddCompany(
                  name: nameController.text.trim(),
                  address: context.tr('not_specified'),
                ));
              },
              child: Text(
                context.tr('add'),
                style: GoogleFonts.outfit(
                  color: _kBlue,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CompanyTile extends StatelessWidget {
  final CompanyModel company;
  final bool isSelected;
  final VoidCallback onTap;

  const _CompanyTile({
    required this.company,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: isSelected ? _kBlue.withValues(alpha: 0.08) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? _kBlue.withValues(alpha: 0.15)
                        : _kBorder,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.business,
                    size: 18,
                    color: isSelected ? _kBlue : _kSlate,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    company.name,
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: _kInk,
                    ),
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.check_circle, size: 20, color: _kBlue),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AddCompanyTile extends StatelessWidget {
  final VoidCallback onTap;

  const _AddCompanyTile({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: _kBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _kBlue.withValues(alpha: 0.3),
                    width: 1.5,
                  ),
                ),
                child: const Icon(Icons.add, size: 18, color: _kBlue),
              ),
              const SizedBox(width: 12),
              Text(
                context.tr('add'),
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: _kBlue,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}