import 'package:flutter/foundation.dart';
import '../services/bank_account_service.dart';

class BankAccount {
  final String id;
  final String bankName;
  final String accountNumber;
  final double initialBalance;
  double currentBalance;
  final String note;

  BankAccount({
    required this.id,
    required this.bankName,
    required this.accountNumber,
    required this.initialBalance,
    required this.currentBalance,
    this.note = '',
  });

  factory BankAccount.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) {
      if (v == null) return 0.0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0.0;
    }

    String accNo = json['accountNumber'] ?? '';
    if (accNo.length > 4) {
      final last4 = accNo.substring(accNo.length - 4);
      final maskLen = accNo.length - 4;
      accNo = '${accNo.substring(0, 4)}${'*' * (maskLen > 10 ? 10 : maskLen)}$last4';
    }

    return BankAccount(
      id: json['id'] ?? '',
      bankName: json['bankName'] ?? 'Bank Account',
      accountNumber: accNo,
      initialBalance: toDouble(json['initialBalance']),
      currentBalance: toDouble(json['currentBalance']),
      note: json['note'] ?? '',
    );
  }
}

class BankExpense {
  final String id;
  final String? bankAccountId;
  final double amount;
  final String reason;
  final DateTime date;

  BankExpense({
    required this.id,
    this.bankAccountId,
    required this.amount,
    required this.reason,
    required this.date,
  });

  factory BankExpense.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) {
      if (v == null) return 0.0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0.0;
    }

    return BankExpense(
      id: json['id'] ?? '',
      bankAccountId: json['bankAccountId'] ?? json['bankAccount']?['id'],
      amount: toDouble(json['amount']),
      reason: json['reason'] ?? '',
      date: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) ?? DateTime.now() : DateTime.now(),
    );
  }
}

class BankAccountProvider with ChangeNotifier {
  final _service = BankAccountService();

  List<BankAccount> _accounts = [];
  List<BankExpense> _expenses = [];
  bool _isLoading = false;
  bool _isBalanceVisible = true;

  double _todaySales = 0.0;
  double _productSales = 0.0;
  double _totalExpenses = 0.0;
  double _commission = 0.0;
  double _netProfit = 0.0;

  List<BankAccount> get accounts => _accounts;
  List<BankExpense> get expenses => _expenses;
  bool get isLoading => _isLoading;
  bool get isBalanceVisible => _isBalanceVisible;

  double get totalBalance {
    if (_accounts.isEmpty) return 0.0;
    return _accounts.fold(0.0, (sum, acc) => sum + acc.currentBalance);
  }

  double get todaySales => _todaySales;
  double get productSales => _productSales;
  double get totalExpenses => _totalExpenses;
  double get commission => _commission;
  double get netProfit => _netProfit;

  void toggleBalanceVisibility() {
    _isBalanceVisible = !_isBalanceVisible;
    notifyListeners();
  }

  Future<void> loadData({String? companyId}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final accList = await _service.getAccounts(companyId: companyId);
      _accounts = accList.map((e) => BankAccount.fromJson(Map<String, dynamic>.from(e))).toList();

      final expList = await _service.getExpenses(companyId: companyId);
      _expenses = expList.map((e) => BankExpense.fromJson(Map<String, dynamic>.from(e))).toList();

      final summary = await _service.getSummary(companyId: companyId);
      double toDouble(dynamic v) {
        if (v == null) return 0.0;
        if (v is num) return v.toDouble();
        return double.tryParse(v.toString()) ?? 0.0;
      }

      _todaySales = toDouble(summary['todaySales']);
      _productSales = toDouble(summary['productSales']);
      _totalExpenses = toDouble(summary['totalExpenses']);
      _commission = toDouble(summary['commission']);
      _netProfit = toDouble(summary['netProfit']);
    } catch (e) {
      debugPrint('[BankAccountProvider] Error loading bank data from Postgres: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addBankAccount({
    required String bankName,
    required String accountNumber,
    required double initialBalance,
    String note = '',
    String? companyId,
  }) async {
    try {
      await _service.createAccount({
        'bankName': bankName,
        'accountNumber': accountNumber,
        'initialBalance': initialBalance,
        'note': note,
        if (companyId != null) 'companyId': companyId,
      });
      await loadData(companyId: companyId);
    } catch (e) {
      debugPrint('[BankAccountProvider] Error creating bank account: $e');
      rethrow;
    }
  }

  Future<void> addBalance({
    required String bankAccountId,
    required double amount,
    String? note,
    String? companyId,
  }) async {
    try {
      await _service.addBalance({
        'bankAccountId': bankAccountId,
        'amount': amount,
        if (note != null && note.isNotEmpty) 'note': note,
      });
      await loadData(companyId: companyId);
    } catch (e) {
      debugPrint('[BankAccountProvider] Error adding balance: $e');
      rethrow;
    }
  }

  Future<void> addExpense({
    required double amount,
    required String reason,
    String? bankAccountId,
    String? companyId,
  }) async {
    try {
      await _service.createExpense({
        'amount': amount,
        'reason': reason,
        if (bankAccountId != null) 'bankAccountId': bankAccountId,
        if (companyId != null) 'companyId': companyId,
      });
      await loadData(companyId: companyId);
    } catch (e) {
      debugPrint('[BankAccountProvider] Error creating expense: $e');
      rethrow;
    }
  }

  Future<void> addSaleIncome(double amount, {String? companyId}) async {
    await loadData(companyId: companyId);
  }
}
