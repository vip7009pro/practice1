"use strict";
/**
 * Alternative Business Logic Training Service
 * Approaches:
 * 1. Pattern-based learning from existing queries
 * 2. Relationship-driven query variations
 * 3. Natural language concept mapping
 * 4. Business logic rule extraction
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const logger = logger_1.createLogger('TrainingService');
class TrainingService {
    constructor(metadataService) {
        this.metadataService = metadataService;
        this.trainingFile = path_1.default.join(__dirname, '../metadata/training.json');
    }
    /**
     * Approach 1: Extract common SQL patterns from database
     * Learn from existing queries to understand common patterns
     */
    async learFromCommonPatterns() {
        try {
            // Pre-defined common patterns in Vietnamese ERP context
            const patterns = [
                {
                    pattern_name: 'Sales Summary by Month',
                    keywords: ['doanh số', 'bán hàng', 'tháng', 'tổng', 'báo cáo'],
                    sql_template: `
            SELECT 
              FORMAT(CAST(EOMONTH(OrderDate) AS DATE), 'yyyy-MM') AS Month,
              SUM(TotalAmount) AS TotalSales,
              COUNT(DISTINCT OrderID) AS OrderCount
            FROM {SALES_TABLE}
            WHERE OrderDate >= DATEADD(MONTH, -12, GETDATE())
            GROUP BY EOMONTH(OrderDate)
            ORDER BY Month DESC
          `,
                    required_tables: ['Orders', 'Sales'],
                    optional_joins: [
                        { table: 'Customers', on: 'CustomerID' },
                        { table: 'Products', on: 'ProductID' },
                    ],
                    example_questions: [
                        'Doanh số bán hàng theo tháng',
                        'Tổng bán theo tháng năm nay',
                        'Báo cáo doanh số hàng tháng',
                        'Chi tiết bán hàng từng tháng',
                    ],
                },
                {
                    pattern_name: 'Product Performance',
                    keywords: ['sản phẩm', 'bán chạy', 'hiệu suất', 'doanh số', 'đơn hàng'],
                    sql_template: `
            SELECT TOP 20
              ProductName,
              COUNT(DISTINCT OrderID) AS OrderCount,
              SUM(Quantity) AS TotalQuantity,
              SUM(TotalAmount) AS TotalSales,
              ROUND(AVG(UnitPrice * Quantity), 2) AS AvgOrderValue
            FROM {SALES_DETAIL_TABLE}
            JOIN {PRODUCT_TABLE} ON ProductID = ID
            WHERE OrderDate >= DATEADD(MONTH, -6, GETDATE())
            GROUP BY ProductID, ProductName
            ORDER BY TotalSales DESC
          `,
                    required_tables: ['SalesDetail', 'Products'],
                    optional_joins: [
                        { table: 'Categories', on: 'CategoryID' },
                        { table: 'Suppliers', on: 'SupplierID' },
                    ],
                    example_questions: [
                        'Sản phẩm bán chạy nhất',
                        'Top 10 sản phẩm theo doanh số',
                        'Hiệu suất bán hàng từng sản phẩm',
                        'Sản phẩm nào bán tốt nhất',
                    ],
                },
                {
                    pattern_name: 'Customer Analysis',
                    keywords: ['khách hàng', 'khách', 'bán cho', 'tổng tiền', 'lần mua'],
                    sql_template: `
            SELECT 
              CustomerName,
              COUNT(DISTINCT OrderID) AS PurchaseCount,
              SUM(TotalAmount) AS TotalSpent,
              ROUND(AVG(TotalAmount), 2) AS AvgOrderValue,
              MAX(OrderDate) AS LastPurchaseDate
            FROM {ORDERS_TABLE}
            JOIN {CUSTOMERS_TABLE} ON CustomerID = ID
            WHERE OrderDate >= DATEADD(MONTH, -12, GETDATE())
            GROUP BY CustomerID, CustomerName
            ORDER BY TotalSpent DESC
          `,
                    required_tables: ['Orders', 'Customers'],
                    optional_joins: [
                        { table: 'Locations', on: 'LocationID' },
                        { table: 'CustomerSegments', on: 'SegmentID' },
                    ],
                    example_questions: [
                        'Khách hàng mua nhiều nhất',
                        'Danh sách khách hàng VIP',
                        'Tổng tiền mỗi khách hàng',
                        'Khách hàng nào không mua hàng gì cả',
                    ],
                },
                {
                    pattern_name: 'Inventory Status',
                    keywords: ['kho', 'tồn kho', 'hàng tồn', 'lượng', 'số lượng'],
                    sql_template: `
            SELECT 
              ProductName,
              WarehouseName,
              QuantityOnHand,
              ReorderLevel,
              CASE WHEN QuantityOnHand <= ReorderLevel THEN 'Need Reorder' 
                   ELSE 'In Stock' END AS Status,
              LastStockDate
            FROM {INVENTORY_TABLE}
            JOIN {PRODUCTS_TABLE} ON ProductID = ID
            JOIN {WAREHOUSES_TABLE} ON WarehouseID = ID
            ORDER BY WarehouseName, Status, ProductName
          `,
                    required_tables: ['Inventory', 'Products', 'Warehouses'],
                    optional_joins: [
                        { table: 'StockMovements', on: 'InventoryID' },
                        { table: 'Suppliers', on: 'SupplierID' },
                    ],
                    example_questions: [
                        'Tập kinh luận tồn kho',
                        'Hàng tồn kho mỗi cái',
                        'Sản phẩm cần gọi hàng',
                        'Khó khăn kho ở đâu',
                    ],
                },
            ];
            return patterns;
        }
        catch (error) {
            logger.error('Failed to learn patterns', error);
            throw error;
        }
    }
    /**
     * Approach 2: Generate query variations from relationships
     * Use metadata relationships to automatically suggest query variations
     */
    async generateVariationsFromRelationships(businessConcept) {
        try {
            const allTables = this.metadataService.getAllTables();
            const variations = [];
            // Generate variations based on different join perspectives
            for (const table of allTables) {
                if (table.business_name.includes(businessConcept)) {
                    // Variation 1: Filter by this table
                    variations.push(`Show ${businessConcept} grouped by ${table.table_name}`);
                    // Variation 2: Join with related tables
                    const columns = this.metadataService.getColumns(table.table_name);
                    for (const col of columns) {
                        if (col.is_measure) {
                            variations.push(`Total ${col.business_name} by ${table.business_name}`);
                            variations.push(`Average ${col.business_name} per ${table.business_name}`);
                        }
                    }
                }
            }
            return variations;
        }
        catch (error) {
            logger.error('Failed to generate variations', error);
            return [];
        }
    }
    /**
     * Approach 3: Business Logic Rule Creation
     * Let user define business rules instead of SQL
     * Rules like: "A customer is VIP if total sales > 1000000"
     */
    async createBusinessRule(rule) {
        try {
            const id = `rule_${Date.now()}`;
            const example = {
                id,
                source_type: 'rule',
                business_concept: rule.name,
                natural_language: `"${rule.name}" applies when ${rule.condition}`,
                variations: [
                    `Show ${rule.applies_to} that ${rule.condition}`,
                    `Which ${rule.applies_to} are ${rule.name}`,
                    `List all ${rule.applies_to} where ${rule.condition}`,
                ],
                confidence: 0.85,
                created_at: new Date().toISOString(),
            };
            this.addTrainingExample(example);
            return example;
        }
        catch (error) {
            logger.error('Failed to create business rule', error);
            throw error;
        }
    }
    /**
     * Approach 4: Semantic Mapping
     * User describes what they want in business terms, system maps to SQL
     */
    async mapBusinessConceptToSQL(concept) {
        try {
            const id = `concept_${Date.now()}`;
            // Build natural language variations automatically
            const variations = [
                `${concept.primary_metric} by ${concept.dimension}`,
                `Show me ${concept.primary_metric.toLowerCase()} per ${concept.dimension.toLowerCase()}`,
                `${concept.primary_metric} grouped by ${concept.dimension}`,
            ];
            if (concept.time_period) {
                variations.push(`${concept.primary_metric} by ${concept.dimension} ${concept.time_period.toLowerCase()}`);
                variations.push(`${concept.time_period} ${concept.primary_metric.toLowerCase()} analysis by ${concept.dimension.toLowerCase()}`);
            }
            const example = {
                id,
                source_type: 'concept',
                business_concept: concept.business_question,
                natural_language: concept.business_question,
                variations,
                confidence: 0.8,
                created_at: new Date().toISOString(),
            };
            this.addTrainingExample(example);
            return example;
        }
        catch (error) {
            logger.error('Failed to map business concept', error);
            throw error;
        }
    }
    /**
     * Add training example to file
     */
    addTrainingExample(example) {
        try {
            let training = { examples: [] };
            if (fs_1.default.existsSync(this.trainingFile)) {
                const content = fs_1.default.readFileSync(this.trainingFile, 'utf-8');
                training = JSON.parse(content);
            }
            training.examples.push(example);
            fs_1.default.writeFileSync(this.trainingFile, JSON.stringify(training, null, 2));
            logger.info(`Added training example: ${example.id}`);
        }
        catch (error) {
            logger.error('Failed to add training example', error);
        }
    }
    /**
     * Get all training examples
     */
    getTrainingExamples() {
        try {
            if (!fs_1.default.existsSync(this.trainingFile)) {
                return [];
            }
            const content = fs_1.default.readFileSync(this.trainingFile, 'utf-8');
            const data = JSON.parse(content);
            return data.examples || [];
        }
        catch (error) {
            logger.error('Failed to get training examples', error);
            return [];
        }
    }
    /**
     * Delete training example
     */
    deleteTrainingExample(id) {
        try {
            let training = { examples: [] };
            if (fs_1.default.existsSync(this.trainingFile)) {
                const content = fs_1.default.readFileSync(this.trainingFile, 'utf-8');
                training = JSON.parse(content);
            }
            training.examples = (training.examples || []).filter((ex) => ex.id !== id);
            fs_1.default.writeFileSync(this.trainingFile, JSON.stringify(training, null, 2));
            logger.info(`Deleted training example: ${id}`);
        }
        catch (error) {
            logger.error('Failed to delete training example', error);
        }
    }
}
exports.TrainingService = TrainingService;
function createTrainingService(metadataService) {
    return new TrainingService(metadataService);
}
exports.createTrainingService = createTrainingService;
