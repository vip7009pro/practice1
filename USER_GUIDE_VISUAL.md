# 🎨 USER GUIDE: Enhanced Semantic Engine Manager

*Hướng dẫn sử dụng giao diện quản lý Semantic Engine*

---

## 🌐 Accessing the Interface

### Location:
```
Main Menu → Tool (Công Cụ) → No-Code/Low-Code (Quản Lý Không Code)
           → Semantic Engine Manager (NEW TAB)
```

### Browser Path:
```
http://localhost:3001/
→ Click "Tool" in navigation
→ Click "No-Code/Low-Code" section
→ Click new tab "Semantic Engine Manager"
```

---

## 📑 Tab 1: Metadata Management

### Overview
Manage business metadata for all tables, columns, and relationships without JSON editing.

### A. Database Synchronization Section

**What it does:**
- Loads table schema directly from database
- Discovers columns automatically
- Detects foreign key relationships
- **Never overwrites** existing customizations

**Visual Display:**
```
┌─────────────────────────────────────────────┐
│ Database Synchronization                     │
├─────────────────────────────────────────────┤
│                                              │
│ [Refresh Button]    "Sync from Database"    │
│                                              │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐   │
│  │   25    │  │   120   │  │    15    │   │
│  │ Tables  │  │ Columns │  │ Relations│   │
│  │+3 new  │  │+36 new  │  │ +5 new   │   │
│  └─────────┘  └─────────┘  └──────────┘   │
│                                              │
│  Last Sync: 2026-03-28 10:30 AM              │
└─────────────────────────────────────────────┘
```

**How to Use:**
1. Click "Sync from Database" button
2. Wait for operation to complete (1-3 seconds)
3. Review report: See how many new items added
4. Check: Your existing metadata is preserved!

**Expected Result:**
- New tables from DB added ✅
- New columns discovered ✅
- Relationships auto-detected ✅
- Your custom business names KEPT ✅

---

### B. Tables Management Section

**Table List View:**
```
┌────────────────────────────────────────────────────┐
│ Tables (25)                      [+ Add Table]      │
├────────────────────────────────────────────────────┤
│ Table Name    │ Business Name  │ Type   │ Actions  │
├────────────────────────────────────────────────────┤
│ Customers     │ Khách Hàng     │ Custom │ [View]   │
│ Orders        │ Orders         │ From DB│ [Edit]   │
│ Products      │ Products       │ From DB│ [Edit]   │
│ InventoryLog  │ InventoryLog   │ From DB│ [Edit]   │
└────────────────────────────────────────────────────┘
```

**How to Add a Table:**
1. Click "[+ Add Table]" button
2. Fill form:
   ```
   Table Name:        Orders
   Business Name:     Đơn Hàng (Vietnamese!)
   Description:       Customer purchase orders
   Synonyms:          Đơn, Order, Sale
   Type:              Fact Table ✓
   ```
3. Click "Save"
4. Table appears in list

**How to Edit a Table:**
1. Find table in list
2. Click "[Edit]" button
3. Modify form fields
4. Click "Save"

**Key Fields:**
- **Table Name**: Database table name (auto-filled from DB)
- **Business Name**: What business calls it (e.g., "Khách Hàng" for "Customers")
- **Synonyms**: Alternative names (e.g., "Cust", "Customer", "KH")
- **Type**: Fact Table (measurable) vs Dimension Table (descriptive)

---

### C. Columns Management Section

**Column List View (After selecting a table):**
```
┌──────────────────────────────────────────────────┐
│ Columns in Customers (8)         [+ Add Column] │
├──────────────────────────────────────────────────┤
│ Column Name  │ Business Name │ Type    │ Measure │
├──────────────────────────────────────────────────┤
│ customer_id  │ Mã Khách Hàng │ Int     │ No      │
│ name         │ Tên Khách Hàng│ Varchar │ No      │
│ email        │ Email         │ Varchar │ No      │
│ total_spent  │ Tổng Chi Tiêu │ Decimal │ Yes ✓   │
│ purchase_qty │ Số Lần Mua    │ Int     │ Yes ✓   │
└──────────────────────────────────────────────────┘
```

**How to Add Column Metadata:**
1. Select a table first (or click from table list)
2. Click "[+ Add Column]"
3. Fill form:
   ```
   Table Name:      Customers (auto-filled)
   Column Name:     total_spent
   Business Name:   Tổng Chi Tiêu (Vietnamese!)
   Data Type:       Decimal
   Nullable:        Default (Yes)
   Type:            Measure ✓  (mark numeric data)
   ```
4. Click "Save"
5. Column appears in table list

**Key Fields:**
- **Column Name**: Database column name
- **Business Name**: Business term (Vietnamese preferred)
- **Data Type**: varchar, int, decimal, datetime, bit
- **Type**: Dimension (descriptive) vs Measure (numeric)
  - Mark numeric columns as "Measure" for calculations

---

### D. Relationships Management Section

**Relationship List View:**
```
┌───────────────────────────────────────────────────┐
│ Relationships (8)               [+ Add Rel]      │
├───────────────────────────────────────────────────┤
│ Name              │ Source      │ Target   │ Type │
├───────────────────────────────────────────────────┤
│ Orders_to_Cust    │ Orders.cust │ Cust.id  │ N:1  │
│ Items_to_Products │ Items.prod  │ Prod.id  │ N:1  │
│ Orders_to_Status  │ Orders.stat │ Stat.id  │ 1:N  │
└───────────────────────────────────────────────────┘
```

**How to Add Relationship:**
1. Click "[+ Add Relationship]" button
2. Fill form:
   ```
   Source Table:      Orders
   Source Column:     customer_id
   Target Table:      Customers
   Target Column:     id
   Cardinality:       N:1 (Many-to-One)
   Business Meaning:  Orders are placed by Customers
   ```
3. Click "Save"
4. Relationship appears in list

**Cardinality Types:**
- **1:1** - One Order has one Invoice
- **1:N** - One Customer has many Orders
- **N:1** - Many Orders belong to one Customer
- **N:N** - Orders connect to Products (many-to-many)

---

## 📚 Tab 2: Business Training

### Overview
Create training data without writing SQL. System auto-generates variations.

### A. Common Query Patterns Section

**What it shows:**
5 pre-built patterns specific to Vietnamese ERP.

**Pattern Display:**
```
┌────────────────────────────────────────────────┐
│ 📊 Common Query Patterns (Learn by Example)    │
├────────────────────────────────────────────────┤
│                                                 │
│ ▼ Sales Summary by Month                      │
│   Keywords: doanh số, bán hàng, tháng        │
│   Example Questions:                           │
│   • "Doanh số bán hàng theo tháng"            │
│   • "Tổng bán theo tháng năm nay"             │
│   • "Báo cáo doanh số hàng tháng"             │
│   SQL Template: [SHOW SQL...]                 │
│                                                 │
│ ▼ Product Performance                         │
│   Keywords: sản phẩm, bán chạy, hiệu suất    │
│   Example Questions:                           │
│   • "Sản phẩm nào bán chạy nhất?"             │
│   • "Top 10 sản phẩm theo doanh số"           │
│   ...                                          │
└────────────────────────────────────────────────┘
```

**How to Use Patterns:**
1. Expand a pattern to see questions
2. Copy any example question
3. Test in main semantic chatbot
4. System learns from your behavior

---

### B. Business Rule Creation

**What it does:**
Create conditions in plain language. System auto-generates:
- SQL variations
- Question patterns
- Synonym mappings

**Form Example:**
```
┌─────────────────────────────────────────────────┐
│ ⚙️  Business Rules (No SQL needed!)            │
├─────────────────────────────────────────────────┤
│                                                  │
│ Rule Name:        VIP Customer                 │
│ Applies To:       [Customers dropdown]          │
│ Condition:        "Total purchases > 1,000,000"│
│                  "AND active = true"            │
│                                                  │
│ [+ Create Business Rule]                        │
│                                                  │
│ Auto-Generated Variations:                      │
│ ✓ "Show me VIP customers"                      │
│ ✓ "Which customers are VIP"                    │
│ ✓ "List customers where VIP = true"            │
│                                                  │
└─────────────────────────────────────────────────┘
```

**How to Create a Rule:**
1. Click "[+ Create Business Rule]"
2. Fill form:
   ```
   Rule Name:     VIP Customer
   Table:         Customers
   Condition:     Total purchases > 1,000,000
   ```
3. Click "Create Rule"
4. System auto-generates variations!

**Use Cases for Rules:**
- `Hot Product`: quantity_sold > 100/month
- `Loyal Customer`: purchase_count >= 10 AND total_spent > 5M
- `Overdue Order`: order_date < 30 days ago AND NOT paid
- `Low Stock`: inventory < reorder_level
- `Premium Supplier`: delivery_success_rate > 95%

---

### C. Business Concept Mapping

**What it does:**
Describe what you want in business terms. System:
- Maps to SQL patterns
- Generates question variations
- Learns from relationships

**Form Example:**
```
┌──────────────────────────────────────────────────┐
│ 🎯 Business Concept Mapping                    │
├──────────────────────────────────────────────────┤
│                                                   │
│ Business Question: "Monthly revenue by product"  │
│ Primary Metric:    [Revenue dropdown]           │
│ Group By:          [Product dropdown]           │
│ Time Period:       [Monthly dropdown]           │
│                                                   │
│ [Map Business Concept]                          │
│                                                   │
│ Auto-Generated Questions:                        │
│ ✓ "Revenue by Product"                         │
│ ✓ "Monthly revenue analysis"                    │
│ ✓ "Revenue trends by Product"                   │
│ ✓ "Product revenue performance"                 │
│                                                   │
└──────────────────────────────────────────────────┘
```

**How to Map a Concept:**
1. Click "[+ Map Business Concept]"
2. Fill form:
   ```
   Question:      "Monthly revenue by category"
   Metric:        Revenue
   Dimension:     Product Category
   Time Period:   Monthly
   ```
3. Click "Map Concept"
4. System generates variations!

**Metric Options:**
- Revenue, Quantity, Count, Average, Total, Profit

**Dimension Options:**
- Product, Customer, Region, Time, Category

**Time Period Options:**
- None, Daily, Weekly, Monthly, Quarterly, Yearly

---

### D. Training Examples List

**Display:**
```
┌──────────────────────────────────────────────────┐
│ 📚 Training Examples (12)                       │
├──────────────────────────────────────────────────┤
│ Type       │ Description        │ Confidence  │  │
├──────────────────────────────────────────────────┤
│ Rule       │ VIP Customer       │ ████████░░ │  │
│ Concept    │ Monthly Sales      │ ████████░░ │  │
│ Pattern    │ Product Sales      │ ████████░░ │  │
│ Rule       │ Hot Product        │ █████████░ │  │
│                                                   │
│ [Delete] [Delete] [Delete]                      │
│                                                   │
└──────────────────────────────────────────────────┘
```

**How to Manage Examples:**
1. View all created training items
2. See confidence scores (higher = better)
3. Delete unwanted examples (click trash icon)
4. All auto-included in training

---

## 🔍 Tab 3: Debug Info

**Shows System Statistics:**
```
Total Tables:        25
Total Columns:       120
Total Relationships: 15
Training Examples:   12
Last Sync:           2026-03-28 10:30:45
```

---

## 🎯 Step-by-Step Workflows

### Workflow 1: First-Time Setup

```
1. SYNC DATABASE
   └─ Click "Sync from Database"
   └─ Get all existing tables/columns
   └─ Auto-detect relationships
   
2. CUSTOMIZE METADATA
   └─ Select tables
   └─ Edit business names (add Vietnamese)
   └─ Add synonyms
   └─ Mark measurement columns
   
3. CREATE TRAINING
   └─ Create 5-10 business rules
   └─ Map 3-5 business concepts
   └─ System learns automatically
   
4. TEST QUERIES
   └─ Go to main ERP Chat tab
   └─ Ask questions in Vietnamese
   └─ System understands! ✅
```

### Workflow 2: Add New Business Logic

```
1. GET NEW REQUIREMENTS
   └─ Business user wants "Top selling products"
   
2. IDENTIFY PATTERN
   └─ This matches "Product Performance" pattern
   └─ Or manually create "Hot Product" rule
   
3. CREATE RULE (no SQL!)
   └─ Rule Name: "Hot Product"
   └─ Table: Products
   └─ Condition: "Sales > threshold"
   
4. TEST
   └─ Ask "Show me hot products"
   └─ System recognizes automatically! ✅
```

### Workflow 3: Improve Recognition

```
1. GET FAILED QUERY
   └─ "Sản phẩm nào bán chạy?"
   └─ System didn't understand
   
2. ADD RULE
   └─ Create "Hot Product" rule
   └─ Add synonym: "bán chạy" = "hot"
   
3. ADD GLOSSARY
   └─ Add "bán chạy" → "Sales"
   └─ Add "sản phẩm" → "Product"
   
4. RETRY QUERY
   └─ System now understands! ✅
```

---

## 💡 Tips & Best Practices

### Metadata Tips
- ✅ Use Vietnamese business names
- ✅ Add multiple synonyms
- ✅ Mark numeric columns as Measures
- ✅ Include relationships from DB
- ✅ Sync regularly for new items

### Training Tips
- ✅ Start with 5 common patterns
- ✅ Create 10+ business rules
- ✅ Use plain language conditions
- ✅ Map important business concepts
- ✅ Test & refine based on feedback

### Business Rule Tips
```
Bad:    "amount > 1000000"
Good:   "Total purchases > 1,000,000 VND"

Bad:    "qty >= 100"
Good:   "Quantity sold > 100 per month"

Bad:    "status = 'A'"
Good:   "Active customers (status = Active)"
```

### Synonym Tips
```
Table: Customers
Synonyms: Khách Hàng, Cust, Customer, KH, người mua

Table: Orders
Synonyms: Đơn Hàng, Đơn, Order, Sale, purchase

Column: total_spent
Synonyms: Tổng Chi Tiêu, Tổng Tiền, Total Amount
```

---

## ❌ Troubleshooting

### Sync Doesn't Add New Items
**Problem**: Sync shows 0 new items
**Solution**: 
- Check database has new tables
- Verify metadata files not corrupted
- Try again after 30 seconds

### Form Validation Errors
**Problem**: Can't save form, validation errors
**Solution**:
- Check all required fields filled
- Table/Column names must match DB exactly
- Business names can be custom

### Business Rule Not Recognized
**Problem**: Created rule but system doesn't use it
**Solution**:
- Make condition clear and specific
- Add synonyms for domain terms
- Test with exact question format

### Training Example Shows Low Confidence
**Problem**: Confidence < 50%
**Solution**:
- Refine the rule/concept description
- Make it more specific
- Test with different questions

---

## 📱 Browser Requirements

- ✅ Chrome/Edge/Firefox (latest)
- ✅ Screen width: 1200px+ recommended
- ✅ JavaScript enabled
- ✅ Backend API running on localhost:3007

---

## 🎉 You're Ready!

You now have:
- ✅ Visual metadata management
- ✅ Database synchronization
- ✅ Business rule creation
- ✅ Business concept mapping
- ✅ 4 training approaches

**All without writing SQL!** 🚀

Try it now:
```
Tool → No-Code/Low-Code → Semantic Engine Manager
```

Questions? Check browser console for error details.
Happy querying! 😊
