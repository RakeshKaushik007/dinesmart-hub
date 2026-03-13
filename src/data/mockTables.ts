export type TableStatus = "available" | "occupied" | "reserved";

export interface RestaurantTable {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  section: string;
  guestName?: string;
  orderTotal?: number;
  occupiedSince?: string;
  reservedFor?: string;
  reservedAt?: string;
}

export const restaurantTables: RestaurantTable[] = [
  { id: "t1", number: 1, seats: 2, status: "occupied", section: "Indoor", guestName: "Rahul S.", orderTotal: 640, occupiedSince: "12:30 PM" },
  { id: "t2", number: 2, seats: 2, status: "available", section: "Indoor" },
  { id: "t3", number: 3, seats: 4, status: "reserved", section: "Indoor", reservedFor: "Priya M.", reservedAt: "1:30 PM" },
  { id: "t4", number: 4, seats: 4, status: "occupied", section: "Indoor", guestName: "Amit K.", orderTotal: 1120, occupiedSince: "12:15 PM" },
  { id: "t5", number: 5, seats: 6, status: "available", section: "Indoor" },
  { id: "t6", number: 6, seats: 6, status: "occupied", section: "Indoor", guestName: "Deepa R.", orderTotal: 880, occupiedSince: "1:00 PM" },
  { id: "t7", number: 7, seats: 2, status: "available", section: "Outdoor" },
  { id: "t8", number: 8, seats: 4, status: "occupied", section: "Outdoor", guestName: "Vikram P.", orderTotal: 520, occupiedSince: "12:45 PM" },
  { id: "t9", number: 9, seats: 4, status: "reserved", section: "Outdoor", reservedFor: "Neha J.", reservedAt: "2:00 PM" },
  { id: "t10", number: 10, seats: 8, status: "available", section: "Outdoor" },
  { id: "t11", number: 11, seats: 2, status: "occupied", section: "Balcony", guestName: "Kiran D.", orderTotal: 380, occupiedSince: "1:10 PM" },
  { id: "t12", number: 12, seats: 4, status: "available", section: "Balcony" },
  { id: "t13", number: 13, seats: 2, status: "available", section: "Balcony" },
  { id: "t14", number: 14, seats: 6, status: "reserved", section: "Balcony", reservedFor: "Sanjay T.", reservedAt: "2:30 PM" },
  { id: "t15", number: 15, seats: 4, status: "occupied", section: "VIP", guestName: "Meera G.", orderTotal: 2240, occupiedSince: "12:00 PM" },
  { id: "t16", number: 16, seats: 8, status: "available", section: "VIP" },
];
