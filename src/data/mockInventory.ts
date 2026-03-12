export type StockStatus = "good" | "low" | "out" | "expiring";

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minThreshold: number;
  costPerUnit: number;
  expiryDate: string | null;
  status: StockStatus;
  lastRestocked: string;
}

export interface Recipe {
  id: string;
  dishName: string;
  category: string;
  sellingPrice: number;
  costPrice: number;
  ingredients: { ingredientId: string; quantity: number; unit: string }[];
  isAvailable: boolean;
}

export interface StockAlert {
  id: string;
  type: "low_stock" | "expiring" | "out_of_stock";
  ingredientName: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export const ingredients: Ingredient[] = [
  { id: "1", name: "Paneer", category: "Dairy", currentStock: 12, unit: "kg", minThreshold: 5, costPerUnit: 320, expiryDate: "2026-03-18", status: "good", lastRestocked: "2026-03-10" },
  { id: "2", name: "Chicken Breast", category: "Protein", currentStock: 3, unit: "kg", minThreshold: 8, costPerUnit: 280, expiryDate: "2026-03-14", status: "low", lastRestocked: "2026-03-09" },
  { id: "3", name: "Basmati Rice", category: "Grains", currentStock: 25, unit: "kg", minThreshold: 10, costPerUnit: 85, expiryDate: null, status: "good", lastRestocked: "2026-03-08" },
  { id: "4", name: "Tomatoes", category: "Vegetables", currentStock: 8, unit: "kg", minThreshold: 5, costPerUnit: 40, expiryDate: "2026-03-15", status: "expiring", lastRestocked: "2026-03-07" },
  { id: "5", name: "Cooking Oil", category: "Oils", currentStock: 0, unit: "L", minThreshold: 5, costPerUnit: 180, expiryDate: null, status: "out", lastRestocked: "2026-03-01" },
  { id: "6", name: "Garam Masala", category: "Spices", currentStock: 2.5, unit: "kg", minThreshold: 1, costPerUnit: 650, expiryDate: "2026-06-20", status: "good", lastRestocked: "2026-03-05" },
  { id: "7", name: "Onions", category: "Vegetables", currentStock: 15, unit: "kg", minThreshold: 10, costPerUnit: 35, expiryDate: null, status: "good", lastRestocked: "2026-03-10" },
  { id: "8", name: "Cream", category: "Dairy", currentStock: 1.5, unit: "L", minThreshold: 3, costPerUnit: 220, expiryDate: "2026-03-16", status: "low", lastRestocked: "2026-03-08" },
  { id: "9", name: "Green Chilli", category: "Vegetables", currentStock: 0.8, unit: "kg", minThreshold: 1, costPerUnit: 80, expiryDate: "2026-03-14", status: "low", lastRestocked: "2026-03-09" },
  { id: "10", name: "Curd", category: "Dairy", currentStock: 4, unit: "kg", minThreshold: 3, costPerUnit: 60, expiryDate: "2026-03-17", status: "good", lastRestocked: "2026-03-11" },
  { id: "11", name: "Salt", category: "Spices", currentStock: 8, unit: "kg", minThreshold: 2, costPerUnit: 20, expiryDate: null, status: "good", lastRestocked: "2026-03-01" },
  { id: "12", name: "Disposable Plates", category: "Cutlery", currentStock: 50, unit: "pcs", minThreshold: 100, costPerUnit: 3, expiryDate: null, status: "low", lastRestocked: "2026-03-06" },
];

export const recipes: Recipe[] = [
  {
    id: "r1", dishName: "Paneer Butter Masala", category: "Main Course", sellingPrice: 320, costPrice: 98,
    ingredients: [
      { ingredientId: "1", quantity: 0.2, unit: "kg" },
      { ingredientId: "4", quantity: 0.15, unit: "kg" },
      { ingredientId: "8", quantity: 0.05, unit: "L" },
      { ingredientId: "7", quantity: 0.1, unit: "kg" },
      { ingredientId: "6", quantity: 0.01, unit: "kg" },
      { ingredientId: "5", quantity: 0.03, unit: "L" },
    ],
    isAvailable: false,
  },
  {
    id: "r2", dishName: "Chicken Biryani", category: "Main Course", sellingPrice: 380, costPrice: 142,
    ingredients: [
      { ingredientId: "2", quantity: 0.25, unit: "kg" },
      { ingredientId: "3", quantity: 0.2, unit: "kg" },
      { ingredientId: "7", quantity: 0.15, unit: "kg" },
      { ingredientId: "6", quantity: 0.015, unit: "kg" },
      { ingredientId: "10", quantity: 0.05, unit: "kg" },
      { ingredientId: "5", quantity: 0.04, unit: "L" },
    ],
    isAvailable: false,
  },
  {
    id: "r3", dishName: "Dal Tadka", category: "Main Course", sellingPrice: 220, costPrice: 45,
    ingredients: [
      { ingredientId: "4", quantity: 0.1, unit: "kg" },
      { ingredientId: "7", quantity: 0.08, unit: "kg" },
      { ingredientId: "9", quantity: 0.02, unit: "kg" },
      { ingredientId: "5", quantity: 0.02, unit: "L" },
      { ingredientId: "6", quantity: 0.005, unit: "kg" },
      { ingredientId: "11", quantity: 0.005, unit: "kg" },
    ],
    isAvailable: false,
  },
  {
    id: "r4", dishName: "Jeera Rice", category: "Sides", sellingPrice: 150, costPrice: 32,
    ingredients: [
      { ingredientId: "3", quantity: 0.15, unit: "kg" },
      { ingredientId: "5", quantity: 0.02, unit: "L" },
      { ingredientId: "11", quantity: 0.003, unit: "kg" },
    ],
    isAvailable: false,
  },
];

export const stockAlerts: StockAlert[] = [
  { id: "a1", type: "out_of_stock", ingredientName: "Cooking Oil", message: "Cooking Oil is completely out of stock. 3 dishes disabled.", timestamp: "2026-03-12T08:30:00", resolved: false },
  { id: "a2", type: "low_stock", ingredientName: "Chicken Breast", message: "Chicken Breast at 37% of minimum threshold.", timestamp: "2026-03-12T07:15:00", resolved: false },
  { id: "a3", type: "expiring", ingredientName: "Tomatoes", message: "Tomatoes expiring in 3 days (Mar 15).", timestamp: "2026-03-12T06:00:00", resolved: false },
  { id: "a4", type: "low_stock", ingredientName: "Cream", message: "Cream at 50% of minimum threshold.", timestamp: "2026-03-12T05:45:00", resolved: false },
  { id: "a5", type: "low_stock", ingredientName: "Disposable Plates", message: "Disposable Plates at 50% of minimum threshold.", timestamp: "2026-03-11T22:00:00", resolved: true },
];
