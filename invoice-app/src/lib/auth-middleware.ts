export type RequiredAuthRole = "admin" | "system";

export type AuthClaims = {
  role: RequiredAuthRole;
  subject: string;
  token: string;
};

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function getExpectedToken(role: RequiredAuthRole): string | undefined {
  if (role === "admin") {
    return process.env.SLICE_2_ADMIN_TOKEN;
  }

  return process.env.SLICE_2_SYSTEM_TOKEN;
}

function resolveDevelopmentFallback(role: RequiredAuthRole): string {
  return role === "admin" ? "dev-admin-token" : "dev-system-token";
}

export function verifyAuth(request: Request, requiredRole: RequiredAuthRole): AuthClaims {
  const authorization = request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (!authorization) {
    throw new AuthError(401, "unauthorized", "Missing authorization header.");
  }

  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthError(401, "unauthorized", "Authorization must use Bearer token format.");
  }

  const expectedToken = getExpectedToken(requiredRole);
  const fallbackToken = process.env.NODE_ENV === "development" ? resolveDevelopmentFallback(requiredRole) : undefined;
  const acceptableToken = expectedToken ?? fallbackToken;

  if (!acceptableToken) {
    throw new AuthError(500, "auth_not_configured", `Auth token for role '${requiredRole}' is not configured.`);
  }

  if (token !== acceptableToken) {
    throw new AuthError(403, "forbidden", "Insufficient permissions for this operation.");
  }

  return {
    role: requiredRole,
    subject: requiredRole,
    token,
  };
}

export function verifyAuthHeader(authorizationHeader: string | null, requiredRole: RequiredAuthRole): AuthClaims {
  const request = new Request("http://localhost", {
    headers: authorizationHeader ? { Authorization: authorizationHeader } : {},
  });

  return verifyAuth(request, requiredRole);
}