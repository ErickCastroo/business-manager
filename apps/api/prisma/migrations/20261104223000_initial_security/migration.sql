BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[Currencies] (
    [CurrencyCode] CHAR(3) NOT NULL,
    [Name] NVARCHAR(50) NOT NULL,
    [Symbol] NVARCHAR(10) NOT NULL,
    [DecimalPlaces] TINYINT NOT NULL,
    [IsActive] BIT NOT NULL,
    CONSTRAINT [Currencies_pkey] PRIMARY KEY CLUSTERED ([CurrencyCode])
);

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [UserId] BIGINT NOT NULL IDENTITY(1,1),
    [Email] NVARCHAR(200) NOT NULL,
    [PasswordHash] NVARCHAR(500) NOT NULL,
    [FirstName] NVARCHAR(100) NOT NULL,
    [LastName] NVARCHAR(100),
    [Phone] NVARCHAR(30),
    [Status] TINYINT NOT NULL,
    [EmailVerifiedAt] DATETIME2,
    [LastLoginAt] DATETIME2,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Users_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2,
    CONSTRAINT [Users_pkey] PRIMARY KEY CLUSTERED ([UserId]),
    CONSTRAINT [UQ_Users_Email] UNIQUE NONCLUSTERED ([Email])
);

-- CreateTable
CREATE TABLE [dbo].[Businesses] (
    [BusinessId] BIGINT NOT NULL IDENTITY(1,1),
    [Name] NVARCHAR(150) NOT NULL,
    [LegalName] NVARCHAR(200),
    [TaxId] NVARCHAR(30),
    [Email] NVARCHAR(200),
    [Phone] NVARCHAR(30),
    [BaseCurrencyCode] CHAR(3) NOT NULL,
    [Timezone] NVARCHAR(80) NOT NULL,
    [AllowNegativeStock] BIT NOT NULL CONSTRAINT [Businesses_AllowNegativeStock_df] DEFAULT 0,
    [Status] TINYINT NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Businesses_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2,
    CONSTRAINT [Businesses_pkey] PRIMARY KEY CLUSTERED ([BusinessId])
);

-- CreateTable
CREATE TABLE [dbo].[Branches] (
    [BranchId] BIGINT NOT NULL IDENTITY(1,1),
    [BusinessId] BIGINT NOT NULL,
    [Code] NVARCHAR(20) NOT NULL,
    [Name] NVARCHAR(120) NOT NULL,
    [Phone] NVARCHAR(30),
    [AddressLine1] NVARCHAR(200),
    [AddressLine2] NVARCHAR(200),
    [City] NVARCHAR(100),
    [State] NVARCHAR(100),
    [CountryCode] CHAR(2) NOT NULL CONSTRAINT [Branches_CountryCode_df] DEFAULT 'MX',
    [PostalCode] NVARCHAR(15),
    [Timezone] NVARCHAR(80) NOT NULL,
    [IsMain] BIT NOT NULL,
    [IsActive] BIT NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Branches_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2,
    CONSTRAINT [Branches_pkey] PRIMARY KEY CLUSTERED ([BranchId]),
    CONSTRAINT [UQ_Branches_BusinessId_Code] UNIQUE NONCLUSTERED ([BusinessId],[Code]),
    CONSTRAINT [AK_Branches_BusinessId_BranchId] UNIQUE NONCLUSTERED ([BusinessId],[BranchId])
);

-- CreateTable
CREATE TABLE [dbo].[Roles] (
    [RoleId] BIGINT NOT NULL IDENTITY(1,1),
    [BusinessId] BIGINT NOT NULL,
    [Code] NVARCHAR(50) NOT NULL,
    [Name] NVARCHAR(80) NOT NULL,
    [Description] NVARCHAR(250),
    [IsSystem] BIT NOT NULL,
    [IsActive] BIT NOT NULL,
    CONSTRAINT [Roles_pkey] PRIMARY KEY CLUSTERED ([RoleId]),
    CONSTRAINT [UQ_Roles_BusinessId_Code] UNIQUE NONCLUSTERED ([BusinessId],[Code]),
    CONSTRAINT [AK_Roles_BusinessId_RoleId] UNIQUE NONCLUSTERED ([BusinessId],[RoleId])
);

-- CreateTable
CREATE TABLE [dbo].[Permissions] (
    [PermissionId] INT NOT NULL IDENTITY(1,1),
    [Code] NVARCHAR(100) NOT NULL,
    [Description] NVARCHAR(250) NOT NULL,
    CONSTRAINT [Permissions_pkey] PRIMARY KEY CLUSTERED ([PermissionId]),
    CONSTRAINT [UQ_Permissions_Code] UNIQUE NONCLUSTERED ([Code])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermissions] (
    [RoleId] BIGINT NOT NULL,
    [PermissionId] INT NOT NULL,
    CONSTRAINT [PK_RolePermissions] PRIMARY KEY CLUSTERED ([RoleId],[PermissionId])
);

-- CreateTable
CREATE TABLE [dbo].[BusinessUsers] (
    [BusinessUserId] BIGINT NOT NULL IDENTITY(1,1),
    [BusinessId] BIGINT NOT NULL,
    [UserId] BIGINT NOT NULL,
    [RoleId] BIGINT NOT NULL,
    [IsOwner] BIT NOT NULL,
    [IsActive] BIT NOT NULL,
    [JoinedAt] DATETIME2 NOT NULL CONSTRAINT [BusinessUsers_JoinedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [BusinessUsers_pkey] PRIMARY KEY CLUSTERED ([BusinessUserId]),
    CONSTRAINT [UQ_BusinessUsers_BusinessId_UserId] UNIQUE NONCLUSTERED ([BusinessId],[UserId]),
    CONSTRAINT [AK_BusinessUsers_BusinessId_BusinessUserId] UNIQUE NONCLUSTERED ([BusinessId],[BusinessUserId])
);

-- CreateTable
CREATE TABLE [dbo].[UserBranchAccess] (
    [BusinessId] BIGINT NOT NULL,
    [BusinessUserId] BIGINT NOT NULL,
    [BranchId] BIGINT NOT NULL,
    CONSTRAINT [PK_UserBranchAccess] PRIMARY KEY CLUSTERED ([BusinessUserId],[BranchId])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshTokens] (
    [RefreshTokenId] BIGINT NOT NULL IDENTITY(1,1),
    [UserId] BIGINT NOT NULL,
    [TokenHash] CHAR(64) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [RevokedAt] DATETIME2,
    [ReplacedByTokenId] BIGINT,
    [UserAgent] NVARCHAR(500),
    [IpAddress] NVARCHAR(45),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [RefreshTokens_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshTokens_pkey] PRIMARY KEY CLUSTERED ([RefreshTokenId]),
    CONSTRAINT [UQ_RefreshTokens_TokenHash] UNIQUE NONCLUSTERED ([TokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLogs] (
    [AuditLogId] BIGINT NOT NULL IDENTITY(1,1),
    [BusinessId] BIGINT NOT NULL,
    [BusinessUserId] BIGINT,
    [BranchId] BIGINT,
    [Action] NVARCHAR(40) NOT NULL,
    [EntityType] NVARCHAR(80) NOT NULL,
    [EntityId] NVARCHAR(80) NOT NULL,
    [BeforeJson] NVARCHAR(max),
    [AfterJson] NVARCHAR(max),
    [RequestId] NVARCHAR(80),
    [IpAddress] NVARCHAR(45),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [AuditLogs_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLogs_pkey] PRIMARY KEY CLUSTERED ([AuditLogId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Businesses_BaseCurrencyCode] ON [dbo].[Businesses]([BaseCurrencyCode]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RolePermissions_PermissionId] ON [dbo].[RolePermissions]([PermissionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_BusinessUsers_UserId] ON [dbo].[BusinessUsers]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_BusinessUsers_BusinessId_RoleId] ON [dbo].[BusinessUsers]([BusinessId], [RoleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_UserBranchAccess_BusinessId_BranchId] ON [dbo].[UserBranchAccess]([BusinessId], [BranchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RefreshTokens_UserId_ExpiresAt] ON [dbo].[RefreshTokens]([UserId], [ExpiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RefreshTokens_UserId_RevokedAt] ON [dbo].[RefreshTokens]([UserId], [RevokedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RefreshTokens_ReplacedByTokenId] ON [dbo].[RefreshTokens]([ReplacedByTokenId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AuditLogs_BusinessId_CreatedAt] ON [dbo].[AuditLogs]([BusinessId], [CreatedAt] DESC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AuditLogs_BusinessId_Entity] ON [dbo].[AuditLogs]([BusinessId], [EntityType], [EntityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AuditLogs_BusinessId_BusinessUserId] ON [dbo].[AuditLogs]([BusinessId], [BusinessUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AuditLogs_BusinessId_BranchId] ON [dbo].[AuditLogs]([BusinessId], [BranchId]);

-- AddForeignKey
ALTER TABLE [dbo].[Businesses] ADD CONSTRAINT [Businesses_BaseCurrencyCode_fkey] FOREIGN KEY ([BaseCurrencyCode]) REFERENCES [dbo].[Currencies]([CurrencyCode]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Branches] ADD CONSTRAINT [Branches_BusinessId_fkey] FOREIGN KEY ([BusinessId]) REFERENCES [dbo].[Businesses]([BusinessId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Roles] ADD CONSTRAINT [Roles_BusinessId_fkey] FOREIGN KEY ([BusinessId]) REFERENCES [dbo].[Businesses]([BusinessId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermissions] ADD CONSTRAINT [RolePermissions_RoleId_fkey] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles]([RoleId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermissions] ADD CONSTRAINT [RolePermissions_PermissionId_fkey] FOREIGN KEY ([PermissionId]) REFERENCES [dbo].[Permissions]([PermissionId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BusinessUsers] ADD CONSTRAINT [BusinessUsers_BusinessId_fkey] FOREIGN KEY ([BusinessId]) REFERENCES [dbo].[Businesses]([BusinessId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BusinessUsers] ADD CONSTRAINT [BusinessUsers_UserId_fkey] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BusinessUsers] ADD CONSTRAINT [BusinessUsers_BusinessId_RoleId_fkey] FOREIGN KEY ([BusinessId], [RoleId]) REFERENCES [dbo].[Roles]([BusinessId],[RoleId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserBranchAccess] ADD CONSTRAINT [UserBranchAccess_BusinessId_BusinessUserId_fkey] FOREIGN KEY ([BusinessId], [BusinessUserId]) REFERENCES [dbo].[BusinessUsers]([BusinessId],[BusinessUserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserBranchAccess] ADD CONSTRAINT [UserBranchAccess_BusinessId_BranchId_fkey] FOREIGN KEY ([BusinessId], [BranchId]) REFERENCES [dbo].[Branches]([BusinessId],[BranchId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshTokens] ADD CONSTRAINT [RefreshTokens_UserId_fkey] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([UserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshTokens] ADD CONSTRAINT [RefreshTokens_ReplacedByTokenId_fkey] FOREIGN KEY ([ReplacedByTokenId]) REFERENCES [dbo].[RefreshTokens]([RefreshTokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLogs] ADD CONSTRAINT [AuditLogs_BusinessId_fkey] FOREIGN KEY ([BusinessId]) REFERENCES [dbo].[Businesses]([BusinessId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLogs] ADD CONSTRAINT [AuditLogs_BusinessId_BusinessUserId_fkey] FOREIGN KEY ([BusinessId], [BusinessUserId]) REFERENCES [dbo].[BusinessUsers]([BusinessId],[BusinessUserId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLogs] ADD CONSTRAINT [AuditLogs_BusinessId_BranchId_fkey] FOREIGN KEY ([BusinessId], [BranchId]) REFERENCES [dbo].[Branches]([BusinessId],[BranchId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
