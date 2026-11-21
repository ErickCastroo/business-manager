BEGIN TRY
BEGIN TRAN;

CREATE TABLE [dbo].[MembershipInvitations] (
    [MembershipInvitationId] BIGINT NOT NULL IDENTITY(1,1),
    [BusinessId] BIGINT NOT NULL,
    [Email] NVARCHAR(200) NOT NULL,
    [RoleId] BIGINT NOT NULL,
    [BranchIdsJson] NVARCHAR(MAX) NOT NULL,
    [TokenHash] CHAR(64) NOT NULL,
    [ExpiresAt] DATETIME2 NOT NULL,
    [AcceptedAt] DATETIME2,
    CONSTRAINT [MembershipInvitations_pkey] PRIMARY KEY CLUSTERED ([MembershipInvitationId]),
    CONSTRAINT [UQ_MembershipInvitations_TokenHash] UNIQUE NONCLUSTERED ([TokenHash]),
    CONSTRAINT [UQ_MembershipInvitations_BusinessId_Email] UNIQUE NONCLUSTERED ([BusinessId], [Email]),
    CONSTRAINT [MembershipInvitations_BusinessId_fkey]
        FOREIGN KEY ([BusinessId]) REFERENCES [dbo].[Businesses]([BusinessId]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [MembershipInvitations_BusinessId_RoleId_fkey]
        FOREIGN KEY ([BusinessId], [RoleId]) REFERENCES [dbo].[Roles]([BusinessId], [RoleId]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE NONCLUSTERED INDEX [IX_MembershipInvitations_BusinessId_RoleId]
ON [dbo].[MembershipInvitations]([BusinessId], [RoleId]);

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW;
END CATCH
