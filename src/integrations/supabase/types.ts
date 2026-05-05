export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          manager_user_id: string | null
          name: string
          phone: string | null
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name: string
          phone?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name?: string
          phone?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_summaries: {
        Row: {
          avg_order_value: number | null
          branch_id: string | null
          cancellation_count: number | null
          card_revenue: number | null
          cash_revenue: number | null
          created_at: string
          dine_in_orders: number | null
          gross_profit: number | null
          id: string
          online_orders: number | null
          peak_hour: number | null
          summary_date: string
          swiggy_revenue: number | null
          takeaway_orders: number | null
          total_cost: number | null
          total_orders: number | null
          total_revenue: number | null
          upi_revenue: number | null
          wastage_cost: number | null
          zomato_revenue: number | null
        }
        Insert: {
          avg_order_value?: number | null
          branch_id?: string | null
          cancellation_count?: number | null
          card_revenue?: number | null
          cash_revenue?: number | null
          created_at?: string
          dine_in_orders?: number | null
          gross_profit?: number | null
          id?: string
          online_orders?: number | null
          peak_hour?: number | null
          summary_date: string
          swiggy_revenue?: number | null
          takeaway_orders?: number | null
          total_cost?: number | null
          total_orders?: number | null
          total_revenue?: number | null
          upi_revenue?: number | null
          wastage_cost?: number | null
          zomato_revenue?: number | null
        }
        Update: {
          avg_order_value?: number | null
          branch_id?: string | null
          cancellation_count?: number | null
          card_revenue?: number | null
          cash_revenue?: number | null
          created_at?: string
          dine_in_orders?: number | null
          gross_profit?: number | null
          id?: string
          online_orders?: number | null
          peak_hour?: number | null
          summary_date?: string
          swiggy_revenue?: number | null
          takeaway_orders?: number | null
          total_cost?: number | null
          total_orders?: number | null
          total_revenue?: number | null
          upi_revenue?: number | null
          wastage_cost?: number | null
          zomato_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_summaries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          branch_id: string | null
          category: string | null
          cost_per_unit: number
          created_at: string
          current_stock: number
          expiry_date: string | null
          id: string
          last_restocked: string | null
          min_threshold: number
          name: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          expiry_date?: string | null
          id?: string
          last_restocked?: string | null
          min_threshold?: number
          name: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          expiry_date?: string | null
          id?: string
          last_restocked?: string | null
          min_threshold?: number
          name?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          branch_id: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          name: string
          prep_time_minutes: number | null
          selling_price: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name: string
          prep_time_minutes?: number | null
          selling_price?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name?: string
          prep_time_minutes?: number | null
          selling_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          is_nc: boolean | null
          is_refunded: boolean
          is_void: boolean | null
          item_name: string
          menu_item_id: string | null
          nc_reason: string | null
          notes: string | null
          order_id: string
          quantity: number
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          total_price: number
          unit_price: number
          void_reason: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_nc?: boolean | null
          is_refunded?: boolean
          is_void?: boolean | null
          item_name: string
          menu_item_id?: string | null
          nc_reason?: string | null
          notes?: string | null
          order_id: string
          quantity?: number
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          total_price?: number
          unit_price?: number
          void_reason?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_nc?: boolean | null
          is_refunded?: boolean
          is_void?: boolean | null
          item_name?: string
          menu_item_id?: string | null
          nc_reason?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          total_price?: number
          unit_price?: number
          void_reason?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          aggregator_settled: boolean
          aggregator_settled_at: string | null
          aggregator_settled_by: string | null
          aggregator_settlement_notes: string | null
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number
          discount_type: string | null
          discount_value: number | null
          id: string
          notes: string | null
          order_number: number
          order_source: Database["public"]["Enums"]["order_source"]
          order_type: Database["public"]["Enums"]["order_type"]
          payment_mode: string
          reopen_reason: string | null
          service_charge: number | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          aggregator_settled?: boolean
          aggregator_settled_at?: string | null
          aggregator_settled_by?: string | null
          aggregator_settlement_notes?: string | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          order_source?: Database["public"]["Enums"]["order_source"]
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_mode?: string
          reopen_reason?: string | null
          service_charge?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          aggregator_settled?: boolean
          aggregator_settled_at?: string | null
          aggregator_settled_by?: string | null
          aggregator_settlement_notes?: string | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          order_source?: Database["public"]["Enums"]["order_source"]
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_mode?: string
          reopen_reason?: string | null
          service_charge?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          pos_pin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          pos_pin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          pos_pin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          ingredient_id: string | null
          ingredient_name: string
          purchase_order_id: string
          quantity: number
          received_quantity: number | null
          total_cost: number
          unit: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          purchase_order_id: string
          quantity?: number
          received_quantity?: number | null
          total_cost?: number
          unit?: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number | null
          total_cost?: number
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          po_number: number
          received_date: string | null
          status: Database["public"]["Enums"]["po_status"]
          total_amount: number
          updated_at: string
          vendor_name: string
          vendor_phone: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: number
          received_date?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          updated_at?: string
          vendor_name: string
          vendor_phone?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: number
          received_date?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          updated_at?: string
          vendor_name?: string
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          menu_item_id: string
          quantity: number
          unit: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          menu_item_id: string
          quantity?: number
          unit?: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          menu_item_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          qr_code_url: string | null
          seats: number
          section: string
          status: string
          table_number: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          qr_code_url?: string | null
          seats?: number
          section?: string
          status?: string
          table_number: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          qr_code_url?: string | null
          seats?: number
          section?: string
          status?: string
          table_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          owner_user_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_user_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_user_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          branch_id: string | null
          created_at: string
          employee_id: string
          end_time: string | null
          id: string
          orders_handled: number | null
          shift_date: string
          start_time: string
          total_sales: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          employee_id: string
          end_time?: string | null
          id?: string
          orders_handled?: number | null
          shift_date?: string
          start_time?: string
          total_sales?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          orders_handled?: number | null
          shift_date?: string
          start_time?: string
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          ingredient_id: string | null
          ingredient_name: string
          message: string
          resolved: boolean
          resolved_at: string | null
          type: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          type?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          total_cost: number | null
          type: string
          unit: string
          unit_cost: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          type?: string
          unit?: string
          unit_cost?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          type?: string
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          branch_id: string | null
          cleared_at: string | null
          created_at: string
          guest_count: number | null
          guest_name: string | null
          id: string
          order_id: string | null
          seated_at: string
          table_id: string
        }
        Insert: {
          branch_id?: string | null
          cleared_at?: string | null
          created_at?: string
          guest_count?: number | null
          guest_name?: string | null
          id?: string
          order_id?: string | null
          seated_at?: string
          table_id: string
        }
        Update: {
          branch_id?: string | null
          cleared_at?: string | null
          created_at?: string
          guest_count?: number | null
          guest_name?: string | null
          id?: string
          order_id?: string | null
          seated_at?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          branch_id: string | null
          created_at: string
          custom_role_name: string | null
          id: string
          is_active: boolean
          parent_user_id: string | null
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          custom_role_name?: string | null
          id?: string
          is_active?: boolean
          parent_user_id?: string | null
          permissions?: string[]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          custom_role_name?: string | null
          id?: string
          is_active?: boolean
          parent_user_id?: string | null
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      wastage_logs: {
        Row: {
          branch_id: string | null
          category: string | null
          cost: number
          created_at: string
          id: string
          ingredient_id: string | null
          ingredient_name: string
          logged_by: string | null
          notes: string | null
          quantity: number
          reason: string
          unit: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          logged_by?: string | null
          notes?: string | null
          quantity?: number
          reason?: string
          unit?: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          logged_by?: string | null
          notes?: string | null
          quantity?: number
          reason?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "wastage_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_logs_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_descendant_user_ids: {
        Args: { _root_user_id: string }
        Returns: string[]
      }
      get_user_branch_ids: { Args: { _user_id: string }; Returns: string[] }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "owner"
        | "branch_manager"
        | "employee"
      order_source: "pos" | "swiggy" | "zomato" | "qr" | "phone"
      order_status:
        | "new"
        | "accepted"
        | "preparing"
        | "ready"
        | "dispatched"
        | "completed"
        | "cancelled"
        | "pending_adjustment"
      order_type: "dine_in" | "takeaway" | "online"
      payment_mode:
        | "cash"
        | "upi"
        | "card"
        | "wallet"
        | "mixed"
        | "pending"
        | "zomato_pay"
        | "swiggy_dineout"
        | "easydiner"
      po_status: "draft" | "sent" | "partial" | "received" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "owner", "branch_manager", "employee"],
      order_source: ["pos", "swiggy", "zomato", "qr", "phone"],
      order_status: [
        "new",
        "accepted",
        "preparing",
        "ready",
        "dispatched",
        "completed",
        "cancelled",
        "pending_adjustment",
      ],
      order_type: ["dine_in", "takeaway", "online"],
      payment_mode: [
        "cash",
        "upi",
        "card",
        "wallet",
        "mixed",
        "pending",
        "zomato_pay",
        "swiggy_dineout",
        "easydiner",
      ],
      po_status: ["draft", "sent", "partial", "received", "cancelled"],
    },
  },
} as const
