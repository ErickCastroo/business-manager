import {
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  Settings2,
  ShoppingCart,
  Truck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

export type NavigationItem = {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

export type NavigationGroup = {
  items: readonly NavigationItem[];
  label: string;
};

export const navigationGroups: readonly NavigationGroup[] = [
  {
    label: 'General',
    items: [
      {
        description: 'Resumen operativo y accesos rápidos.',
        href: '/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
      },
    ],
  },
  {
    label: 'Operación',
    items: [
      {
        description: 'Punto de venta, historial y cuentas por cobrar.',
        href: '/sales',
        icon: ShoppingCart,
        label: 'Ventas',
      },
      {
        description: 'Productos, existencias y transferencias.',
        href: '/inventory',
        icon: Boxes,
        label: 'Inventario',
      },
      {
        description: 'Compras, proveedores y cuentas por pagar.',
        href: '/purchases',
        icon: Truck,
        label: 'Compras',
      },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        description: 'Cuentas, ingresos, egresos y transferencias.',
        href: '/finance',
        icon: WalletCards,
        label: 'Finanzas',
      },
      {
        description: 'Empleados y registro de pagos.',
        href: '/people',
        icon: UsersRound,
        label: 'Personal',
      },
      {
        description: 'Indicadores y consultas operativas.',
        href: '/reports',
        icon: BarChart3,
        label: 'Reportes',
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        description: 'Sucursales, usuarios, roles y configuración.',
        href: '/administration',
        icon: Settings2,
        label: 'Administración',
      },
    ],
  },
];

export const allNavigationItems = navigationGroups.flatMap((group) => group.items);

export const businessIdentity = {
  icon: Building2,
  name: 'Business Manager',
  subtitle: 'Entorno de preparación',
} as const;
