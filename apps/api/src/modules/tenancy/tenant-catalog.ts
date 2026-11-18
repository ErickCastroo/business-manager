export type SeedCurrency = Readonly<{
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}>;

export type SeedPermission = Readonly<{
  code: string;
  description: string;
}>;

export const SEED_CURRENCIES = [
  {
    code: 'MXN',
    name: 'Peso mexicano',
    symbol: 'MX$',
    decimalPlaces: 2,
    isActive: true,
  },
  {
    code: 'USD',
    name: 'Dólar estadounidense',
    symbol: 'US$',
    decimalPlaces: 2,
    isActive: true,
  },
] as const satisfies readonly SeedCurrency[];

export const SEED_PERMISSIONS = [
  { code: 'business.read', description: 'Consultar la información general del negocio.' },
  {
    code: 'business.settings.manage',
    description: 'Administrar la configuración general del negocio.',
  },
  { code: 'branches.read', description: 'Consultar sucursales.' },
  { code: 'branches.manage', description: 'Crear y actualizar sucursales.' },
  { code: 'users.read', description: 'Consultar usuarios y membresías del negocio.' },
  { code: 'users.manage', description: 'Administrar usuarios y membresías del negocio.' },
  { code: 'products.read', description: 'Consultar productos.' },
  { code: 'products.manage', description: 'Crear y actualizar productos.' },
  { code: 'inventory.read', description: 'Consultar existencias y movimientos de inventario.' },
  { code: 'inventory.adjust', description: 'Registrar ajustes autorizados de inventario.' },
  { code: 'inventory.transfer', description: 'Transferir inventario entre almacenes.' },
  { code: 'sales.read', description: 'Consultar ventas.' },
  { code: 'sales.create', description: 'Crear y completar ventas.' },
  { code: 'sales.change_price', description: 'Modificar precios durante una venta.' },
  { code: 'sales.discount', description: 'Aplicar descuentos durante una venta.' },
  { code: 'sales.cancel', description: 'Cancelar ventas completadas.' },
  { code: 'customers.read', description: 'Consultar clientes.' },
  { code: 'customers.manage', description: 'Crear y actualizar clientes.' },
  { code: 'receivables.read', description: 'Consultar cuentas por cobrar.' },
  { code: 'receivables.collect', description: 'Registrar cobros de cuentas por cobrar.' },
  { code: 'purchases.read', description: 'Consultar compras.' },
  { code: 'purchases.create', description: 'Crear y completar compras.' },
  { code: 'purchases.cancel', description: 'Cancelar compras completadas.' },
  { code: 'suppliers.read', description: 'Consultar proveedores.' },
  { code: 'suppliers.manage', description: 'Crear y actualizar proveedores.' },
  { code: 'payables.read', description: 'Consultar cuentas por pagar.' },
  { code: 'payables.pay', description: 'Registrar pagos de cuentas por pagar.' },
  { code: 'finance.read', description: 'Consultar cuentas y movimientos financieros.' },
  {
    code: 'finance.transaction.create',
    description: 'Registrar ingresos y egresos financieros manuales.',
  },
  { code: 'finance.transfer', description: 'Transferir fondos entre cuentas financieras.' },
  { code: 'finance.adjust', description: 'Registrar ajustes financieros autorizados.' },
  { code: 'employees.read', description: 'Consultar empleados.' },
  { code: 'employees.manage', description: 'Crear y actualizar empleados.' },
  { code: 'employees.pay', description: 'Registrar pagos y anticipos a empleados.' },
  { code: 'reports.read', description: 'Consultar reportes del negocio.' },
  { code: 'audit.read', description: 'Consultar el historial de auditoría del negocio.' },
] as const satisfies readonly SeedPermission[];

export const BUSINESS_ACTIVE = 1;
export type PermissionCode = (typeof SEED_PERMISSIONS)[number]['code'];

const allPermissions = SEED_PERMISSIONS.map(({ code }) => code);

export const DEFAULT_ROLES = [
  { code: 'OWNER', name: 'Propietario', permissions: allPermissions },
  {
    code: 'ADMIN',
    name: 'Administrador',
    permissions: allPermissions.filter((code) => code !== 'business.settings.manage'),
  },
  {
    code: 'CASHIER',
    name: 'Cajero',
    permissions: [
      'business.read',
      'branches.read',
      'products.read',
      'inventory.read',
      'sales.read',
      'sales.create',
      'customers.read',
    ],
  },
  {
    code: 'INVENTORY',
    name: 'Inventario',
    permissions: [
      'business.read',
      'branches.read',
      'products.read',
      'products.manage',
      'inventory.read',
      'inventory.adjust',
      'inventory.transfer',
    ],
  },
  {
    code: 'FINANCE',
    name: 'Finanzas',
    permissions: [
      'business.read',
      'branches.read',
      'sales.read',
      'customers.read',
      'receivables.read',
      'receivables.collect',
      'purchases.read',
      'suppliers.read',
      'payables.read',
      'payables.pay',
      'finance.read',
      'finance.transaction.create',
      'finance.transfer',
      'reports.read',
    ],
  },
] as const satisfies ReadonlyArray<{
  code: string;
  name: string;
  permissions: readonly PermissionCode[];
}>;
