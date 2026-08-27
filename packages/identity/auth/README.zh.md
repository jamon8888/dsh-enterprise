# @deepseek-ai/dsh-auth

DeepSeek Harness (DSH) 的认证与身份能力缝合层。

## 概览

本包定义了 DSH 的核心认证授权服务，提供：

- **服务定义**：抽象 AuthService 类，包含标准认证操作
- **类型系统**：UserId、OrgId、SessionToken 的品牌类型，编译期类型安全
- **RBAC**：基于角色的访问控制，包含 Role 和 Permission 类型
- **配置**：通过 schemastery 进行模式验证的配置
- **Cordis 集成**：通过 ctx.auth 键注册插件

## 安装

```bash
pnpm add @deepseek-ai/dsh-auth
```

## 快速开始

```typescript
import { createAuthPlugin, AuthService } from '@deepseek-ai/dsh-auth'
import { Context } from 'cordis'

// 创建自定义认证实现
class MyAuthService extends AuthService {
  async validateToken(token: string) { /* ... */ }
  async getUser(userId) { /* ... */ }
  getPermissions(ctx) { /* ... */ }
  async createSessionToken(principal, ttlMs) { /* ... */ }
  async refreshToken(token) { /* ... */ }
  async revokeToken(token) { /* ... */ }
  // ... 其他抽象方法
}

// 注册到 Cordis
const ctx = new Context()
ctx.plugin(createAuthPlugin())
ctx.plugin(defineAuthPlugin(MyAuthService))

// 使用认证服务
const principal = await ctx.auth.validateToken(sessionToken)
if (principal && ctx.auth.can(principal, 'session', 'create')) {
  // 已授权
}
```

## 核心类型

### 品牌标识符

```typescript
type UserId = Brand<string, 'UserId'>
type OrgId = Brand<string, 'OrgId'>
type SessionToken = Brand<string, 'SessionToken'>
```

### 权限

DSH 资源的细粒度权限：

- session:* - 会话管理
- agent:* - Agent 生命周期
- tool:* - 工具执行
- sandbox:* - 沙箱管理
- org:* - 组织管理
- workspace:* - 工作区访问

### 角色

常见访问模式的预定义角色：

- org:admin - 组织管理员
- org:member - 组织成员
- workspace:owner - 工作区所有者
- workspace:editor - 工作区编辑者
- workspace:viewer - 工作区查看者（只读）

### Principal

带有角色和权限的已认证实体：

```typescript
interface Principal {
  userId: UserId
  orgId: OrgId
  roles: Role[]
  permissions: Permission[]
}
```

### UserProfile

扩展用户信息：

```typescript
interface UserProfile {
  userId: UserId
  orgId: OrgId
  email: string
  name: string
  avatarUrl?: string
  metadata: Record<string, unknown>
}
```

## 服务 API

### validateToken(token: string): Promise<Principal | null>

验证会话令牌并返回关联的主体。

### getUser(userId: UserId): Promise<UserProfile | null>

通过 ID 获取用户档案。

### getPermissions(ctx: PermissionContext): boolean

检查主体是否拥有资源/操作的权限。

### createSessionToken(principal: Principal, ttlMs?: number): Promise<SessionToken>

为主体创建新的会话令牌。

### refreshToken(token: SessionToken): Promise<SessionToken>

刷新现有会话令牌。

### revokeToken(token: SessionToken): Promise<void>

撤销会话令牌。

### can(principal: Principal, resource: string, action: string): boolean

权限检查的便捷方法。

### getEffectivePermissions(principal: Principal): Promise<string[]>

获取所有有效权限，包括角色派生的权限。

### getEffectiveRoles(principal: Principal): Promise<string[]>

获取所有有效角色，包括继承的角色。

### login(credentials: LoginCredentials): Promise<AuthResult>

使用凭据进行认证。

### logout(token: SessionToken): Promise<void>

登出并撤销会话。

## 配置

```typescript
interface AuthConfig {
  tokenTtlMs: number        // 默认：24 小时
  refreshTtlMs: number      // 默认：7 天
  issuer: string            // 默认：'dsh'
  audience: string          // 默认：'dsh-api'
  clockSkewMs: number       // 默认：60 秒
  providers: Record<string, unknown>
}
```

## 事件

在 Cordis 上下文中发出的认证生命周期事件：

- auth/token-issued - 创建新令牌
- auth/token-refreshed - 令牌已刷新
- auth/token-revoked - 令牌已撤销
- auth/token-validated - 尝试验证令牌

## 实现提供者

通过扩展 AuthService 创建具体实现：

```typescript
import { AuthService, defineAuthPlugin } from '@deepseek-ai/dsh-auth'

class OAuthAuthService extends AuthService {
  constructor(ctx: Context, config: AuthConfig) {
    super()
    // 初始化 OAuth 客户端
  }

  async validateToken(token: string) {
    // 验证 JWT、检查过期、获取用户
  }

  // ... 实现所有抽象方法
}

// 注册
ctx.plugin(defineAuthPlugin(OAuthAuthService))
```

## 集成点

### 会话头扩展 (dsh-session)

向会话头添加 ownerId: UserId 和 collaborators: UserId[]。

### 会话创建/加入

ctx.sessions.create/join 通过 ctx.auth 验证调用者。

### Web GUI

登录流程和会话所有权 UI 消费 ctx.auth。

### 子 Agent

Principal 自动传播到子会话。

## 许可证

MIT
