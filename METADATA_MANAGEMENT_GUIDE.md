# 🚀 Semantic ERP Chatbot - Enhanced Metadata Management & Business Training

## Cải Tiến Chính

### 1. 📊 **Quản Lý Metadata Trực Quan (Visual Metadata Management)**

Thay vì chỉ có JSON editing, hiện đã có giao diện form trực quan cho phép:

#### **a) Đồng Bộ từ Database (Database Synchronization)**
- **Endpoint**: `GET /ai/v2/metadata/sync`
- **Tính năng**:
  - Tự động tải schema từ database
  - Smart merge: Không ghi đè metadata hiện có
  - Chỉ thêm bảng, cột, relationship **mới** từ DB
  - Report chi tiết: số bảng/cột/relationship thêm vào
  
**Cách dùng**:
```
Metadata Management Tab → Database Synchronization → [Sync from Database]
```

**Logic Smart Sync**:
- Bảng có sẵn → không ghi đè
- Cột có sẵn → không ghi đè  
- Relationship có sẵn → không ghi đè
- Chỉ thêm những thứ mới từ DB vào

#### **b) Quản Lý Bảng (Visual Table Management)**
- Form input cho: Table Name, Business Name (Tiếng Việt), Description, Synonyms
- Automatically mark tables từ DB sync
- Support both Fact Tables & Dimension Tables

**Endpoints**:
```
POST /ai/v2/metadata/tables     - Thêm/cập nhật bảng
GET  /ai/v2/metadata/tables     - Lấy danh sách bảng
```

#### **c) Quản Lý Cột (Visual Column Management)**
- Load columns cho table được chọn
- Edit: Column Name, Business Name, Data Type, Nullable, Measure flag
- Automatically detect measure columns (numeric types)

**Endpoints**:
```
POST /ai/v2/metadata/columns/:tableName  - Thêm/cập nhật cột
GET  /ai/v2/metadata/columns/:tableName  - Lấy columns của bảng
```

#### **d) Quản Lý Relationship (Visual Relationship Builder)**
- Drag-drop style relationship creation
- Support: 1:1, 1:N, N:1, N:N relationships
- Business meaning optional description

**Endpoints**:
```
POST /ai/v2/metadata/relationships  - Thêm/cập nhật relationship
GET  /ai/v2/metadata/relationships  - Lấy danh sách relationships
```

---

### 2. 🎓 **Alternative Business Logic Training Approaches**

Thay vì phải viết câu hỏi + SQL cho mỗi query, hiện có 4 cách tiếp cận:

#### **Approach 1: Pattern-Based Learning (Học từ Pattern Có Sẵn)**
- System cung cấp 5+ common patterns trong Vietnamese ERP
- Mỗi pattern có:
  - Keywords từ domain
  - SQL template
  - Example questions (tự động generate variations)
  
**Patterns có sẵn**:
1. **Sales Summary by Month** - Doanh số theo tháng
2. **Product Performance** - Sản phẩm bán chạy
3. **Customer Analysis** - Phân tích khách hàng
4. **Inventory Status** - Tập kinh luận tồn kho
5. **Revenue Analysis** - Phân tích doanh thu

**Endpoint**:
```
GET /ai/v2/training/patterns
```

#### **Approach 2: Business Rule Creation (Tạo Rule Không Cần SQL)**
- **Tính năng**: Viết rule bằng natural language, hệ thống tự động tạo SQL variations

**Ví dụ**:
```
Rule Name: VIP Customer
Applies To: Customers table
Condition: "Total purchases > 1,000,000 VND"

↓ System auto-generates:
- "Show customers that are VIP"
- "Which customers are VIP customers"
- "List all customers where total purchases > 1,000,000"
```

**Endpoints**:
```
POST /ai/v2/training/rule      - Tạo business rule
GET  /ai/v2/training/examples  - Lấy danh sách rules
```

#### **Approach 3: Semantic Mapping (Ánh Xạ Khái Niệm Business)**
- Không viết SQL, mô tả bằng **các thành phần**:
  - **Primary Metric**: Cái gì cần đo (Revenue, Quantity, Count)
  - **Dimension**: Nhóm theo cái gì (Product, Customer, Region)
  - **Time Period**: Theo thời gian nào (Daily, Monthly, Yearly)

**Ví dụ**:
```
Business Question: "Monthly revenue by product category"
Primary Metric: Revenue
Group By Dimension: Product
Time Period: Monthly

↓ System auto-generates:
- "Revenue by Product Category"
- "Monthly revenue analysis"
- "Revenue trends by Product"
```

**Endpoint**:
```
POST /ai/v2/training/concept - Map business concept to SQL
```

#### **Approach 4: Auto-Variations from Relationships**
- Hệ thống tự động tạo variations dựa vào metadata relationships
- Ví dụ nếu có relationship `Orders -> Customers`:
  - "Total orders per customer"
  - "Average order value by customer"
  - "Customers with most orders"

---

## 🎯 **Cách Sử Dụng**

### **Tab 1: Metadata Management**

#### Bước 1: Sync từ Database
```
1. Nhấn "Sync from Database"
2. Xem report: bao nhiêu bảng/cột/relationships được thêm
3. Metadata hiện có sẽ không bị ghi đè
```

#### Bước 2: Fine-tune Metadata
```
1. Chọn bảng muốn edit
2. Nhấn "View Columns" để xem columns
3. Edit Business Names (Tiếng Việt) cho bảng/cột
4. Thêm Synonyms (từ ngữ thay thế)
5. Mark measure columns (numeric data)
```

#### Bước 3: Thêm Relationships (nếu DB chưa có)
```
1. Nhấn "Add Relationship"
2. Chọn Source Table, Column
3. Chọn Target Table, Column
4. Chọn Cardinality (1:1, 1:N, N:1, N:N)
5. Nhấn Save
```

### **Tab 2: Business Training**

#### Cách 1: Học từ Common Patterns
```
1. Expand một pattern (e.g., "Sales Summary by Month")
2. Xem example questions tự động được tạo
3. System sẽ học từ những patterns này
```

#### Cách 2: Tạo Business Rule (Không viết SQL!)
```
1. Nhấn "+ Create Business Rule"
2. Nhập Rule Name (e.g., "VIP Customer")
3. Chọn table nó apply vào (e.g., Customers)
4. Viết condition bằng plain language:
   "Total purchases > 1,000,000 AND active = true"
5. Nhấn "Create Rule"

↓ System tự động:
- Tạo SQL variations
- Learn keyword patterns
- Support cả tiếng Việt lẫn tiếng Anh
```

#### Cách 3: Map Business Concept
```
1. Nhấn "+ Map Business Concept"
2. Mô tả business question: "Sales by region monthly"
3. Chọn Primary Metric: "Revenue"
4. Chọn Dimension: "Region"
5. Chọn Time Period: "Monthly"
6. Nhấn "Map Concept"

↓ System tự động:
- Tạo các questions variations
- Map các keywords đến SQL patterns
- Learning từ relationship metadata
```

---

## 📝 **API Endpoints Reference**

### **Metadata Management**
```
GET    /ai/v2/metadata/sync                    - Sync metadata từ DB
GET    /ai/v2/metadata/tables                 - Danh sách bảng
GET    /ai/v2/metadata/columns/:tableName    - Columns của bảng
GET    /ai/v2/metadata/relationships         - Danh sách relationships

POST   /ai/v2/metadata/tables               - Thêm/Update bảng
POST   /ai/v2/metadata/columns              - Thêm/Update cột
POST   /ai/v2/metadata/relationships        - Thêm/Update relationship
```

### **Business Training**
```
GET    /ai/v2/training/patterns              - Common patterns
GET    /ai/v2/training/examples              - Training examples

POST   /ai/v2/training/rule                  - Tạo business rule
POST   /ai/v2/training/concept              - Map business concept
DELETE /ai/v2/training/examples/:id         - Xóa training example
```

---

## 🔄 **Smart Sync Logic**

**Problem**: Khi sync từ DB, làm sao tránh ghi đè metadata đã customize?

**Solution**: Kiểm tra tất cả items trước khi thêm:

```javascript
// Pseudo-code
existingTables = load from JSON
dbTables = load from database

for each dbTable:
  if dbTable NOT in existingTables:
    ADD to existingTables  ✅
  else:
    SKIP (don't overwrite) ✅

// Kết quả:
- Bảng cũ giữ nguyên business_name, synonyms, description
- Chỉ thêm bảng mới từ DB
- No data loss, only enhancement!
```

---

## 💡 **Best Practices**

### **Metadata Management**
1. **Sync từ DB trước** - Get real schema
2. **Edit Business Names** - Thêm tiếng Việt meaningful names
3. **Add Synonyms** - "Khách hàng" = "Cust" = "Customer"
4. **Mark Measures** - Chỉ định numeric columns
5. **Define Relationships** - Thêm business relationships nếu DB chưa có

### **Business Training**
1. **Học từ Patterns** - Customize 5 patterns có sẵn
2. **Tạo 5-10 Rules** - VIP customers, hot products, etc
3. **Map 3-5 Concepts** - Monthly sales, product performance
4. **Test & Refine** - Xem system hiểu không
5. **Iterate** - Thêm rules dựa trên user feedback

---

## 🎁 **Bonus: Vietnamese ERP Specific**

System được tối ưu cho Vietnamese ERP terms:
- Doanh số, bán hàng, tổng tiền
- Sản phẩm, khách hàng, nhà cung cấp
- Tồn kho, xuất nhập kho
- Báo cáo, phân tích, chiến lược

Tất cả business rules & concepts support tiếng Việt! 🇻🇳

---

## 🚨 **Troubleshooting**

### Sync không thêm columns
- Check: Column đã tồn tại trong metadata JSON?
- Solution: Delete existing column, re-sync

### Business rule không được nhận dạng
- Check: Condition viết rõ ràng không?
- Solution: Thêm synonyms cho domain terms

### Mapping concept không tạo variations
- Check: Dimension valid không? (Product, Customer, Region, etc)
- Solution: Custom add thêm terms vào glossary

---

## 📊 **Example: Full Workflow**

**Scenario**: Quản lý ERP bán lẻ cần: "Top 10 sản phẩm bán chạy"

### Step 1: Metadata Setup
```
1. Sync by DB
   → Load Orders, Products, Customers tables
   → Load all columns automatically
   
2. Edit Business Names:
   Orders:          "Đơn Hàng"
   Products:        "Sản Phẩm"
   order_date:      "Ngày Đặt Hàng"
   unit_price:      "Giá Đơn Vị"
   quantity:        "Số Lượng"
   
3. Add synonyms:
   "sản phẩm" = "hàng hóa" = "items"
   "bán chạy" = "hot products" 
   
4. Mark measures:
   unit_price ✓
   quantity ✓
   total_amount ✓
```

### Step 2: Business Training
```
1. Learn from Pattern:
   - "Product Performance" pattern
   - Already has SQL template for product rankings
   
2. Create Rule:
   - "Hot Product" = quantity > 100/month
   - Auto-generates variations
   
3. Map Concept:
   - Business Question: "Top selling products"
   - Metric: "Quantity"
   - Dimension: "Product"
   - Time: "Monthly"
   
4. Ask natural questions:
✅ "Sản phẩm nào bán chạy nhất?"
✅ "Top 10 hàng hóa theo doanh số"
✅ "Hàng bán hot nhất tháng này"
```

**Result**: System automatically handles all 3 questions! 🎉

---

## 📚 **More Resources**

- See `/semantic-query-engine/metadata/` for JSON structure
- Check `/routes/ai.js` for all V2 endpoints
- Review `trainingService.ts` for training logic
- Use `dbSyncService.ts` for DB schema detection

**Questions?** Check error messages in browser console or backend logs!
