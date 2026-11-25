import 'dart:async';
import 'core/services/app_lock_service.dart';
import 'features/auth/app_lock_gate.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'core/bloc/auth/auth_bloc.dart';
import 'core/bloc/branch/branch_bloc.dart';
import 'core/bloc/commission/commission_bloc.dart';
import 'core/bloc/company/company_bloc.dart';
import 'core/bloc/customer/customer_bloc.dart';
import 'core/bloc/notification/notification_bloc.dart';
import 'core/bloc/product/product_bloc.dart';
import 'core/bloc/sale/sale_bloc.dart';
import 'core/models/sale_model.dart';
import 'core/bloc/supplier/supplier_bloc.dart';
import 'core/bloc/transfer/transfer_bloc.dart';
import 'core/bloc/borrowing/borrowing_bloc.dart';
import 'core/bloc/warehouse/warehouse_bloc.dart';
import 'core/localization/app_localizations.dart';
import 'core/localization/locale_provider.dart';
import 'core/providers/dashboard_provider.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/staff_provider.dart';
import 'core/providers/sale_provider.dart';
import 'core/providers/product_provider.dart';
import 'core/providers/report_provider.dart';
import 'core/widgets/company_scope_listener.dart';
import 'core/widgets/in_app_notification_listener.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/auth/verify_screen.dart';
import 'features/subscription/choose_plan_screen.dart';
import 'features/subscription/request_more_companies_screen.dart';
import 'features/home/main_shell.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/splash/splash_screen.dart';
import 'features/staff/staff_management_screen.dart';
import 'features/staff/staff_access_screen.dart';
import 'features/branch/branch_management_screen.dart';
import 'features/branch/transfer_request_screen.dart';
import 'features/sales/new_sale_screen.dart';
import 'features/reports/reports_screen.dart';
import 'features/products/product_entry_screen.dart';
import 'features/scan/scan_item_screen.dart';
import 'features/stock/stock_in_screen.dart';
import 'features/stock/stock_out_screen.dart';
import 'features/sales/sales_history_screen.dart';
import 'features/sales/credit_sales_screen.dart';
import 'features/shop/shop_store_screen.dart';
import 'features/shop/shop_list_screen.dart';
import 'features/credit/outstanding_credit_screen.dart';
import 'features/credit/record_payment_screen.dart';
import 'features/commission/commission_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/more/more_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/bank/bank_accounts_screen.dart';
import 'core/providers/bank_account_provider.dart';
import 'features/customers/customer_list_screen.dart';
import 'features/products/product_list_screen.dart';
import 'features/suppliers/supplier_list_screen.dart';
import 'features/warehouse/warehouse_list_screen.dart';
import 'features/warehouse/warehouse_dashboard_screen.dart';
import 'features/warehouse/warehouse_product_detail_screen.dart';
import 'features/shop/shop_dashboard_screen.dart';
import 'features/shop/shop_product_detail_screen.dart';
import 'features/transfer/create_transfer_screen.dart';
import 'features/transfer/transfer_history_screen.dart';
import 'features/transfer/transfer_detail_screen.dart';
import 'features/borrowing/borrowing_list_screen.dart';
import 'features/stock/stock_overview_screen.dart';
import 'features/purchases/purchases_screen.dart';
import 'features/receipt/receipt_verification_screen.dart';
import 'core/services/fcm_service.dart';

final RouteObserver<ModalRoute<void>> routeObserver = RouteObserver<ModalRoute<void>>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('[FLUTTER ERROR] ${details.exceptionAsString()}');
  };

  // Firebase must be initialised before registering the background handler or
  // accessing any Firebase API, otherwise the app crashes in release mode.
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    if (Firebase.apps.isNotEmpty) {
      try {
        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      } catch (e) {
        debugPrint('[MAIN] FirebaseMessaging background handler registration skipped/failed: $e');
      }
      unawaited(FcmService.instance.init());
    }
  } catch (e) {
    debugPrint('[MAIN] Firebase initialization failed or unsupported: $e');
  }

  AppLockService.instance.init();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        BlocProvider<AuthBloc>(create: (_) => AuthBloc()),
        BlocProvider<CompanyBloc>(create: (_) => CompanyBloc()),
        BlocProvider<BranchBloc>(create: (_) => BranchBloc()),
        BlocProvider<ProductBloc>(create: (_) => ProductBloc()),
        BlocProvider<WarehouseBloc>(create: (_) => WarehouseBloc()),
        BlocProvider<SaleBloc>(create: (_) => SaleBloc()),
        BlocProvider<TransferBloc>(create: (_) => TransferBloc()),
        BlocProvider<BorrowingBloc>(create: (_) => BorrowingBloc()),
        BlocProvider<SupplierBloc>(create: (_) => SupplierBloc()),
        BlocProvider<CustomerBloc>(create: (_) => CustomerBloc()),
        BlocProvider<NotificationBloc>(create: (_) => NotificationBloc()),
        BlocProvider<CommissionBloc>(create: (_) => CommissionBloc()),
        ChangeNotifierProvider(create: (_) => DashboardProvider()),
        ChangeNotifierProvider(create: (_) => BranchProvider()),
        ChangeNotifierProvider(create: (_) => StaffProvider()),
        ChangeNotifierProvider(create: (_) => SaleProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => ReportProvider()),
        ChangeNotifierProvider(create: (_) => BankAccountProvider()),
      ],
      child: Consumer<LocaleProvider>(
        builder: (context, localeProvider, child) {
          return CompanyScopeListener(
            child: InAppNotificationListener(
            child: MaterialApp(
              title: 'BM Stock',
              debugShowCheckedModeBanner: false,
              navigatorKey: appNavigatorKey,
              navigatorObservers: [routeObserver],
              scaffoldMessengerKey: appScaffoldMessengerKey,
              locale: localeProvider.locale,
              builder: (context, child) {
                return AppLockGate(child: child ?? const SizedBox.shrink());
              },
              supportedLocales: const [
                Locale('en', ''),
                Locale('am', ''),
                Locale('om', ''),
              ],
              localizationsDelegates: const [
                AppLocalizations.delegate,
                FallbackMaterialLocalizationsDelegate(),
                GlobalWidgetsLocalizations.delegate,
                FallbackCupertinoLocalizationsDelegate(),
              ],
              localeResolutionCallback: (locale, supportedLocales) {
                if (locale != null) {
                  for (var supportedLocale in supportedLocales) {
                    if (supportedLocale.languageCode == locale.languageCode) {
                      return supportedLocale;
                    }
                  }
                }
                return const Locale('en', '');
              },
              theme: ThemeData(
                useMaterial3: true,
                colorScheme: ColorScheme.fromSeed(
                  seedColor: const Color(0xFF025EA7),
                  primary: const Color(0xFF025EA7),
                  secondary: const Color(0xFFE3F2FD),
                  surface: Colors.white,
                ),
                textTheme: GoogleFonts.outfitTextTheme(
                  Theme.of(context).textTheme,
                ),
                scaffoldBackgroundColor: Colors.white,
                snackBarTheme: SnackBarThemeData(
                  behavior: SnackBarBehavior.floating,
                  backgroundColor: const Color(0xFF0F172A),
                  contentTextStyle: GoogleFonts.outfit(
                    fontSize: 14,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 4,
                ),
              ),
              initialRoute: '/',
              routes: {
                '/': (context) => const SplashScreen(),
                '/onboarding': (context) => const OnboardingScreen(),
                '/auth': (context) => const LoginScreen(),
                '/login': (context) => const LoginScreen(),
                '/register': (context) => const RegisterScreen(),
                '/verify': (context) => const VerifyScreen(),
                '/choose_plan': (context) => const ChoosePlanScreen(),
                '/request_more_companies': (context) => const RequestMoreCompaniesScreen(),
                '/awaiting_approval': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return AwaitingApprovalScreen(data: args);
                },
                '/home': (context) => const MainShell(),
                '/staff': (context) => const StaffManagementScreen(),
                '/staff-access': (context) => const StaffAccessScreen(),
                '/branch': (context) => const BranchManagementScreen(),
                '/transfer_request': (context) => const TransferRequestScreen(),
                '/new_sale': (context) => const NewSaleScreen(),
                '/reports': (context) => const ReportsScreen(),
                '/add_product': (context) => const ProductEntryScreen(),
                '/scan_item': (context) => const ScanItemScreen(),
                '/stock_in': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments;
                  final warehouseId = args is Map ? args['warehouseId'] as String? : null;
                  return StockInScreen(warehouseId: warehouseId);
                },
                '/stock_out': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments;
                  final warehouseId = args is Map ? args['warehouseId'] as String? : null;
                  return StockOutScreen(warehouseId: warehouseId);
                },
                '/sales': (context) => const SalesHistoryScreen(),
                '/credit_sales': (context) => const CreditSalesScreen(),
                '/shop': (context) => const ShopStoreScreen(),
                '/shop_list': (context) => const ShopListScreen(),
                '/outstanding_credit': (context) => const OutstandingCreditScreen(),
                '/record_payment': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return RecordPaymentScreen(
                    saleId: args?['saleId'],
                    sales: args?['sales'] as List<SaleModel>?,
                    customerName: args?['customerName'] ?? '',
                    amountDue: (args?['amountDue'] as num?)?.toDouble() ?? 0,
                  );
                },
                '/commission': (context) => const CommissionScreen(),
                '/more': (context) => const MoreScreen(),
                '/bank_accounts': (context) => const BankAccountsScreen(),
                '/settings': (context) => const SettingsScreen(),
                '/customers': (context) => const CustomerListScreen(),
                '/products': (context) => const ProductListScreen(),
                '/suppliers': (context) => const SupplierListScreen(),
                '/warehouses': (context) => const WarehouseListScreen(),
                '/notifications': (context) => const NotificationsScreen(),
                '/stock_overview': (context) => const StockOverviewScreen(),
                '/warehouse_dashboard': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return WarehouseDashboardScreen(
                    warehouseId: args?['warehouseId'] ?? '',
                    warehouseName: args?['warehouseName'] ?? 'Warehouse',
                  );
                },
                '/warehouse_product_detail': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return WarehouseProductDetailScreen(
                    warehouseId: args?['warehouseId'] ?? '',
                    productId: args?['productId'] ?? '',
                    productName: args?['productName'] ?? 'Product',
                  );
                },
                '/shop_dashboard': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return ShopDashboardScreen(
                    shopId: args?['shopId'] ?? '',
                    shopName: args?['shopName'] ?? 'Shop',
                  );
                },
                '/shop_product_detail': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return ShopProductDetailScreen(
                    shopId: args?['shopId'] ?? '',
                    productId: args?['productId'] ?? '',
                    productName: args?['productName'] ?? 'Product',
                  );
                },
                '/create_transfer': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return CreateTransferScreen(fromWarehouseId: args?['fromWarehouseId']);
                },
                '/transfer_history': (context) => const TransferHistoryScreen(),
                '/borrowings': (context) => const BorrowingListScreen(),
                '/purchases': (context) => const PurchasesScreen(),
                '/expenses': (context) => const PurchasesScreen(),
                '/verify_receipt': (context) => const ReceiptVerificationScreen(),
                '/transfer_detail': (context) {
                  final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
                  return TransferDetailScreen(transferId: args?['transferId'] ?? '');
                },
              },
            ),
            ),
          );
        },
      ),
    );
  }
}
