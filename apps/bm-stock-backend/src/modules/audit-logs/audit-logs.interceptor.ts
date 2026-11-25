import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogsService } from './audit-logs.service';
import { AuditAction } from './entities/audit-log.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Maps HTTP methods to audit actions
 */
function methodToAction(method: string): AuditAction | null {
  switch (method.toUpperCase()) {
    case 'POST':
      return AuditAction.CREATE;
    case 'PUT':
    case 'PATCH':
      return AuditAction.UPDATE;
    case 'DELETE':
      return AuditAction.DELETE;
    default:
      return null;
  }
}

/**
 * Extracts the module and entity type from the URL path
 */
function extractModuleInfo(path: string): { module: string; entityType: string } {
  // Strip /api/v1/ and query parameters
  const clean = path.replace(/^\/api\/v[0-9]+\//, '').replace(/^\//, '').split('?')[0];
  const segments = clean.split('/').filter(Boolean);

  let module = segments[0] || 'general';
  if (module === 'auth') {
    if (segments[1] === 'register') {
      return { module: 'users', entityType: 'User' };
    }
    return { module: 'auth', entityType: 'Auth' };
  }

  if (module === 'collections' && segments[1]) {
    const sub = segments[1].replace(/s$/, '');
    const entityType = sub.replace(/(^|-|_)([a-z])/g, (_, __, c) => c.toUpperCase());
    return { module: 'collections', entityType: entityType || 'Collection' };
  }

  if (module === 'inventory' && segments[1]) {
    const sub = segments[1].replace(/s$/, '');
    const entityType = sub.replace(/(^|-|_)([a-z])/g, (_, __, c) => c.toUpperCase());
    return { module: 'inventory', entityType: `Inventory${entityType}` };
  }

  // Format entity type: kebab/snake to PascalCase, remove trailing 's'
  const entityType = module
    .replace(/s$/, '')
    .replace(/(^|-|_)([a-z])/g, (_, __, c) => c.toUpperCase());

  return { module, entityType: entityType || 'General' };
}

/**
 * Detects specific actions from the URL path
 */
function detectSpecialAction(path: string, method: string): AuditAction | null {
  const lowerPath = path.toLowerCase();

  if (
    lowerPath.includes('/login') ||
    lowerPath.includes('/staff-first-login') ||
    lowerPath.includes('/cadmin-first-login') ||
    lowerPath.includes('/pin-unlock')
  ) {
    return AuditAction.LOGIN;
  }
  if (lowerPath.includes('/logout')) return AuditAction.LOGOUT;
  if (lowerPath.includes('/approve')) return AuditAction.APPROVE;
  if (lowerPath.includes('/reject')) return AuditAction.REJECT;
  if (lowerPath.includes('/assign') || lowerPath.includes('/bulk-assign') || lowerPath.includes('/attach')) {
    return AuditAction.ASSIGN;
  }
  if (lowerPath.includes('/toggle-status') || lowerPath.includes('/status')) return AuditAction.STATUS_CHANGE;
  if (
    lowerPath.includes('/reset-password') ||
    lowerPath.includes('/change-password') ||
    lowerPath.includes('/change-admin-pin') ||
    lowerPath.includes('/set-admin-pin')
  ) {
    return AuditAction.PASSWORD_RESET;
  }
  if (lowerPath.includes('/settings')) return AuditAction.SETTINGS_CHANGE;
  if (lowerPath.includes('/export')) return AuditAction.EXPORT;
  if (lowerPath.includes('/import')) return AuditAction.IMPORT;

  return methodToAction(method);
}

/**
 * Helper to safely decode a JWT token payload from Authorization header
 */
function decodeJwtPayload(authHeader?: string): Record<string, any> | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = match[1].trim();
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

/**
 * Builds a natural, informative description of the event
 */
function buildDescription(
  method: string,
  path: string,
  action: AuditAction,
  entityType: string,
  userName: string,
  entityName?: string,
  entityId?: string,
  extra?: string,
): string {
  const actor = userName || 'User';
  const target = entityName
    ? `'${entityName}'`
    : `${entityType}${entityId ? ` (${String(entityId).slice(0, 8)})` : ''}`;

  switch (action) {
    case AuditAction.LOGIN:
      return `${actor} logged in successfully`;
    case AuditAction.LOGOUT:
      return `${actor} logged out`;
    case AuditAction.CREATE:
      if (path.includes('/register')) {
        return `${actor} registered a new account`;
      }
      return `${actor} created ${target}${extra ? ` (${extra})` : ''}`;
    case AuditAction.UPDATE:
      return `${actor} updated ${target}`;
    case AuditAction.DELETE:
      return `${actor} deleted ${target}`;
    case AuditAction.APPROVE:
      return `${actor} approved ${target}`;
    case AuditAction.REJECT:
      return `${actor} rejected ${target}`;
    case AuditAction.ASSIGN:
      return `${actor} assigned ${target}`;
    case AuditAction.STATUS_CHANGE:
      return `${actor} changed status of ${target}`;
    case AuditAction.PASSWORD_RESET:
      return `${actor} reset or updated security credentials for ${target}`;
    case AuditAction.SETTINGS_CHANGE:
      return `${actor} updated system settings`;
    case AuditAction.EXPORT:
      return `${actor} exported ${target} report data`;
    case AuditAction.IMPORT:
      return `${actor} imported ${target} data`;
    default:
      return `${actor} performed ${action} on ${target}`;
  }
}

// Prefix patterns excluded from audit logging
const EXCLUDED_PREFIXES = [
  '/api/v1/audit-logs',
  '/audit-logs',
  '/health',
  '/api/v1/health',
  '/api/v1/dashboard',
  '/dashboard',
];

@Injectable()
export class AuditLogsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogsInterceptor.name);

  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method || 'GET';
    const rawUrl = request.originalUrl || request.url || '';
    const cleanUrl = rawUrl.split('?')[0];

    // Detect if this is an auditable operation
    const action = detectSpecialAction(cleanUrl, method);
    
    this.logger.debug(`[AUDIT-DEBUG] ${method} ${cleanUrl} → action=${action || 'SKIP'}`);
    
    if (!action) return next.handle();

    // Skip excluded paths
    if (EXCLUDED_PREFIXES.some((p) => cleanUrl.startsWith(p))) {
      this.logger.debug(`[AUDIT-DEBUG] Excluded: ${cleanUrl}`);
      return next.handle();
    }

    const { module: moduleName, entityType } = extractModuleInfo(cleanUrl);
    const headers = request.headers || {};
    const userAgent = headers['user-agent'] || '';
    const ip = request.ip || request.connection?.remoteAddress || '';
    const body = request.body;
    const params = request.params || {};
    const paramEntityId = params.id || params.userId || params.companyId || params.saleId || null;

    this.logger.log(`[AUDIT] Capturing ${method} ${cleanUrl} → action=${action}, module=${moduleName}, entity=${entityType}`);

    return next.handle().pipe(
      tap({
        next: (rawResponse) => {
          try {
            // Unpack ResponseDto if wrapped: { success: true, data: ... }
            const responseData =
              rawResponse &&
              typeof rawResponse === 'object' &&
              'data' in rawResponse &&
              rawResponse.success !== undefined
                ? rawResponse.data
                : rawResponse;

            // 1. Resolve Actor/User:
            // Check request.user, responseData.user, responseData.data.user, or JWT from Authorization header
            let actorUser = request.user;

            // Check if JWT token exists in header
            const authHeader = headers['authorization'] || headers['Authorization'];
            const decodedJwt = decodeJwtPayload(authHeader);

            if (!actorUser || !actorUser.id) {
              if (responseData?.user) {
                actorUser = responseData.user;
              } else if (responseData?.data?.user) {
                actorUser = responseData.data.user;
              } else if (decodedJwt) {
                actorUser = {
                  id: decodedJwt.sub || decodedJwt.id,
                  email: decodedJwt.email,
                  role: decodedJwt.role,
                  firstName: decodedJwt.firstName,
                  lastName: decodedJwt.lastName,
                  employeeName: decodedJwt.employeeName,
                };
              }
            }

            // Extract user fields
            const rawUserId = actorUser?.id || actorUser?.sub || decodedJwt?.sub || null;
            const userId = rawUserId && UUID_REGEX.test(rawUserId) ? rawUserId : null;

            let firstName = actorUser?.firstName || decodedJwt?.firstName || '';
            let lastName = actorUser?.lastName || decodedJwt?.lastName || '';
            const userEmail = actorUser?.email || decodedJwt?.email || body?.email || null;
            const userRole = actorUser?.role || decodedJwt?.role || (action === AuditAction.LOGIN ? 'user' : 'staff');

            let userName = `${firstName} ${lastName}`.trim();
            if (!userName && actorUser?.employeeName) {
              userName = actorUser.employeeName;
            }
            if (!userName && decodedJwt?.employeeName) {
              userName = decodedJwt.employeeName;
            }
            if (!userName && actorUser?.name) {
              userName = actorUser.name;
            }
            if (!userName && userEmail) {
              userName = userEmail.split('@')[0];
            }
            if (!userName) {
              userName = action === AuditAction.LOGIN ? 'System User' : 'Authorized User';
            }

            // 2. Resolve Entity Info:
            const rawEntityId =
              paramEntityId ||
              responseData?.id ||
              responseData?.sale?.id ||
              responseData?.user?.id ||
              responseData?.product?.id ||
              body?.id ||
              null;
            const entityId = rawEntityId ? String(rawEntityId).slice(0, 255) : undefined;

            const entityName =
              responseData?.invoiceNumber ||
              responseData?.name ||
              responseData?.title ||
              responseData?.productName ||
              responseData?.companyName ||
              responseData?.employeeName ||
              (responseData?.firstName
                ? `${responseData.firstName} ${responseData.lastName || ''}`.trim()
                : null) ||
              responseData?.customer?.name ||
              responseData?.product?.name ||
              responseData?.warehouse?.name ||
              responseData?.shop?.name ||
              body?.name ||
              body?.title ||
              body?.invoiceNumber ||
              body?.productName ||
              body?.companyName ||
              null;

            let extraInfo = '';
            if (responseData?.quantity) extraInfo = `${responseData.quantity} units`;
            else if (body?.quantity) extraInfo = `${body.quantity} units`;
            else if (responseData?.totalAmount) extraInfo = `Amount: ${responseData.totalAmount}`;
            else if (body?.totalAmount) extraInfo = `Amount: ${body.totalAmount}`;

            const description = buildDescription(
              method,
              cleanUrl,
              action,
              entityType,
              userName,
              entityName,
              entityId,
              extraInfo,
            );

            const newValues = this.sanitizeBody(body);

            this.auditLogsService
              .create({
                entityType,
                entityId,
                entityName: entityName ? String(entityName).slice(0, 255) : undefined,
                action,
                newValues: Object.keys(newValues || {}).length > 0 ? newValues : undefined,
                description,
                ipAddress: String(ip).slice(0, 45),
                userAgent: String(userAgent).slice(0, 500),
                userId: userId || undefined,
                userName: String(userName).slice(0, 255),
                userEmail: userEmail ? String(userEmail).slice(0, 255) : undefined,
                userRole: userRole ? String(userRole).slice(0, 100) : undefined,
                module: moduleName,
                method,
                endpoint: String(cleanUrl).slice(0, 500),
              })
              .catch((err) => {
                this.logger.warn(`Failed to save audit log: ${err?.message || err}`);
              });
          } catch (err: any) {
            this.logger.warn(`Error during audit interception: ${err?.message || err}`);
          }
        },
        error: () => {
          // Do not log failed operations
        },
      }),
    );
  }

  /**
   * Redact sensitive fields from the request body before logging
   */
  private sanitizeBody(body: any): Record<string, any> | null {
    if (!body || typeof body !== 'object') return null;

    const sensitiveFields = [
      'password',
      'newPassword',
      'currentPassword',
      'companyPassword',
      'pin',
      'token',
      'refreshToken',
      'secret',
    ];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
