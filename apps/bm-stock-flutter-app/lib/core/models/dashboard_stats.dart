class DashboardStats {
  final double totalSales;
  final int totalInvoices;
  final double todaySales;
  final int todayInvoices;
  final int productsCredit;
  final int creditCustomers;
  final double totalOutstandingCredit;
  final int creditCustomersWithBalance;
  final double totalCredit;
  final double unpaidCredit;
  final double partiallyPaidCredit;
  final double paidCredit;
  final double overdueCredit;
  final int lowStockCount;
  final int expiredCount;

  DashboardStats({
    double? totalSales,
    int? totalInvoices,
    required this.todaySales,
    required this.todayInvoices,
    required this.productsCredit,
    required this.creditCustomers,
    this.totalOutstandingCredit = 0,
    this.creditCustomersWithBalance = 0,
    this.totalCredit = 0,
    this.unpaidCredit = 0,
    this.partiallyPaidCredit = 0,
    this.paidCredit = 0,
    this.overdueCredit = 0,
    required this.lowStockCount,
    required this.expiredCount,
  })  : totalSales = totalSales ?? todaySales,
        totalInvoices = totalInvoices ?? todayInvoices;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    final todaySalesVal = _toDouble(json['todaySales'] ?? json['todayRevenue'] ?? json['totalRevenue']);
    final todayInvoicesVal = json['todayInvoices'] ?? json['todaySales'] ?? 0;
    final totalSalesVal = _toDouble(json['allTimeRevenue'] ?? json['totalSalesRevenue'] ?? json['totalRevenue'] ?? todaySalesVal);
    final totalInvoicesVal = json['allTimeSales'] ?? json['totalSalesCount'] ?? json['totalSales'] ?? todayInvoicesVal;

    return DashboardStats(
      totalSales: totalSalesVal,
      totalInvoices: totalInvoicesVal,
      todaySales: todaySalesVal,
      todayInvoices: todayInvoicesVal,
      productsCredit: json['productsCredit'] ?? 0,
      creditCustomers: json['creditCustomers'] ?? 0,
      totalOutstandingCredit: _toDouble(json['totalOutstandingCredit']),
      creditCustomersWithBalance: json['creditCustomersWithBalance'] ?? 0,
      totalCredit: _toDouble(json['totalCredit']),
      unpaidCredit: _toDouble(json['unpaidCredit']),
      partiallyPaidCredit: _toDouble(json['partiallyPaidCredit']),
      paidCredit: _toDouble(json['paidCredit']),
      overdueCredit: _toDouble(json['overdueCredit']),
      lowStockCount: json['lowStockCount'] ?? 0,
      expiredCount: json['expiredCount'] ?? 0,
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}
