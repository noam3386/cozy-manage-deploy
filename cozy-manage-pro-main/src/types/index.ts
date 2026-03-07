export type UserRole = 'owner' | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  floor?: string;
  size?: number;
  image?: string;
  status: 'occupied' | 'vacant' | 'preparing';
  ownerId: string;
  doorCode?: string;
  safeCode?: string;
  notes?: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  guestCount: number;
  source: 'airbnb' | 'booking' | 'direct' | 'manual';
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface ServiceRequest {
  id: string;
  propertyId: string;
  type: 'cleaning' | 'windows' | 'laundry' | 'beds' | 'maintenance' | 'other';
  status: 'new' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  date: string;
  time?: string;
  notes?: string;
  price?: number;
  createdAt: string;
}

export interface Issue {
  id: string;
  propertyId: string;
  category: 'electric' | 'plumbing' | 'ac' | 'gas' | 'appliances' | 'internet' | 'door' | 'leak' | 'pests' | 'other';
  priority: 'emergency' | 'high' | 'normal';
  title: string;
  description: string;
  images?: string[];
  status: 'new' | 'reviewing' | 'quote_pending' | 'assigned' | 'in_progress' | 'completed' | 'closed';
  approvedBudget?: number;
  actualCost?: number;
  vendorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  ownerId: string;
  propertyId?: string;
  type: 'monthly_fee' | 'service' | 'repair' | 'other';
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  paidDate?: string;
  description: string;
}

export interface Vendor {
  id: string;
  name: string;
  specialty: string[];
  phone: string;
  email?: string;
  rating: 'excellent' | 'good' | 'average' | 'poor';
  areas: string[];
}

export interface Task {
  id: string;
  propertyId: string;
  type: 'cleaning' | 'windows' | 'beds' | 'repair' | 'inspection';
  status: 'new' | 'scheduled' | 'in_progress' | 'pending_approval' | 'completed' | 'closed';
  assignedTo?: string;
  dueDate: string;
  description: string;
  priority: 'high' | 'normal' | 'low';
}

export interface ArrivalDeparture {
  id: string;
  propertyId: string;
  type: 'arrival' | 'departure';
  date: string;
  time?: string;
  guestCount?: number;
  services: {
    cleaning: boolean;
    windows: boolean;
    beds: { single: number; double: number };
    laundry: boolean;
    supplies: string[];
  };
  notes?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed';
}
