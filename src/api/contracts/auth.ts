export type PlatformRole='SUPER_ADMIN'|'SCHOOL_ADMIN'|'PRINCIPAL'|'TEACHER'|'STUDENT'|'PARENT'|'ACCOUNTANT';
export type MobilePlatform='IOS'|'ANDROID';
export interface OrganizationBranding{themeKey:string;primaryColor:string;accentColor:string;hasLogo:boolean;logoPath:string|null}
export interface AuthUser{id:string;fullName:string;email:string;role:PlatformRole;status:string;organizationId:string|null;organization:{id:string;name:string;slug:string;branding:OrganizationBranding}|null}
export interface MobileSession{accessToken:string;refreshToken:string;accessTokenExpiresAt:string;refreshTokenExpiresAt:string;sessionId:string;sessionFamilyId:string;user:AuthUser}
export interface MobileLoginRequest{email:string;password:string;deviceId:string;platform:MobilePlatform;appVersion?:string}
export interface MobileRefreshRequest{refreshToken:string}
