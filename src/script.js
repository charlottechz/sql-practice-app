// Initialize CodeMirror
let sqlEditor;

// Sample data for demonstration
const sampleData = {
  customers: [
    {id: 1, name: 'John Smith', email: 'john@example.com'},
    {id: 2, name: 'Emma Johnson', email: 'emma@example.com'},
    {id: 3, name: 'Michael Brown', email: 'michael@example.com'},
    {id: 4, name: 'Sarah Davis', email: 'sarah@example.com'},
    {id: 5, name: 'David Wilson', email: 'david@example.com'}
  ],
  orders: [
    {id: 1001, customer_id: 1, total: 129.99},
    {id: 1002, customer_id: 2, total: 249.95},
    {id: 1003, customer_id: 3, total: 89.50},
    {id: 1004, customer_id: 4, total: 199.99},
    {id: 1005, customer_id: 1, total: 67.50},
    {id: 1006, customer_id: 5, total: 334.99},
    {id: 1007, customer_id: 3, total: 156.75},
    {id: 1008, customer_id: 2, total: 78.25}
  ],
  products: [
    {id: 1, name: 'Wireless Headphones', price: 129.99, category: 'Electronics'},
    {id: 2, name: 'Coffee Maker', price: 89.99, category: 'Appliances'},
    {id: 3, name: 'Desk Lamp', price: 49.99, category: 'Office'},
    {id: 4, name: 'Yoga Mat', price: 34.99, category: 'Sports'},
    {id: 5, name: 'Phone Case', price: 24.99, category: 'Accessories'}
  ]
};

document.addEventListener('DOMContentLoaded', function() {
  // Initialize CodeMirror after DOM is loaded
  sqlEditor = CodeMirror.fromTextArea(document.getElementById('sqlEditor'), {
    mode: 'text/x-sql',
    theme: 'monokai',
    lineNumbers: true,
    indentUnit: 2,
    smartIndent: true,
    lineWrapping: true,
    autofocus: true
  });

  // Event listener for generating SQL schema (FIXED: moved inside DOMContentLoaded)
  document.getElementById('generateSchemaBtn').addEventListener('click', function() {
    const prompt = document.getElementById('schemaPrompt').value.trim();
    if (!prompt) {
      showError('Please enter a schema description first.');
      return;
    }
    
    // Show loading state
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Generating...</span>';
    this.disabled = true;
    
    // Simulate API call to Claude for schema generation
    setTimeout(() => {
      generateSQLSchema(prompt);
      this.innerHTML = '<i class="fas fa-database"></i><span>Generate SQL Schema</span>';
      this.disabled = false;
    }, 2000);
  });

  // Event listener for generating dataset
  document.getElementById('generateBtn').addEventListener('click', function() {
    const prompt = document.getElementById('datasetPrompt').value.trim();
    if (!prompt) {
      showError('Please enter a dataset description first.');
      return;
    }
    
    // Show loading state
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Generating...</span>';
    this.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
      generateMockDataset(prompt);
      this.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i><span>Generate Dataset</span>';
      this.disabled = false;
    }, 2000);
  });

  document.getElementById('runQueryBtn').addEventListener('click', function() {
    const query = sqlEditor.getValue().trim();
    if (!query) {
      showError('Please enter a SQL query first.');
      return;
    }
    
    // Show loading state
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Running...</span>';
    this.disabled = true;
    
    // Simulate query execution
    setTimeout(() => {
      executeQuery(query);
      this.innerHTML = '<i class="fas fa-play"></i><span>Run Query</span>';
      this.disabled = false;
    }, 1000);
  });

  document.getElementById('formatBtn').addEventListener('click', function() {
    // Simple SQL formatting (basic implementation)
    const query = sqlEditor.getValue();
    const formatted = query
      .replace(/\bSELECT\b/gi, 'SELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT');
    
    sqlEditor.setValue(formatted);
  });

  document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Clear the SQL editor?')) {
      sqlEditor.setValue('');
    }
  });

  document.getElementById('dismissError').addEventListener('click', function() {
    hideError();
  });

  document.getElementById('toggleSchema').addEventListener('click', function() {
    const panel = document.getElementById('schemaPanel');
    panel.classList.toggle('collapsed');
  });

  document.getElementById('collapseSchema').addEventListener('click', function() {
    const content = document.getElementById('schemaContent');
    const icon = this.querySelector('i');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.className = 'fas fa-chevron-up';
    } else {
      content.style.display = 'none';
      icon.className = 'fas fa-chevron-down';
    }
  });
});

// Function to generate SQL schema and data
function generateSQLSchema(prompt) {
  // Custom Claude prompt for generating SQL schema
  const refinedPrompt = `
    Generate SQL schema based on the following description:
    "${prompt}"
    
    Requirements:
    - Include at least 2 relational tables each containing at least 5 columns and at least 30 rows unless specified otherwise.
    - The data should appear similar to what a real company or organization may collect and use internally.
    - Include appropriate PRIMARY KEY and FOREIGN KEY constraints.
    - Use realistic data types (VARCHAR, INT, DECIMAL, DATETIME, etc.).
    - Insert realistic sample data that makes business sense.
    - Ensure relationships between tables are properly established.
    
    Please provide both CREATE TABLE statements and INSERT INTO statements.
  `;
  
  console.log('Generating SQL schema with prompt:', refinedPrompt);
  
  // Mock response based on the prompt type
  let mockResponse = generateMockSQLSchema(prompt);
  
  // Display the generated SQL in the SQL editor
  sqlEditor.setValue(mockResponse);
  
  // Update schema display
  updateSchemaDisplayFromSQL(mockResponse);
  
  showNotification('SQL schema generated successfully!', 'success');
}

// Generate mock SQL schema based on prompt context
function generateMockSQLSchema(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('retail') || lowerPrompt.includes('store') || lowerPrompt.includes('shop')) {
    return `-- Retail Store Database Schema
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_status ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
);

CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(8,2) NOT NULL,
    cost DECIMAL(8,2),
    stock_quantity INT DEFAULT 0,
    sku VARCHAR(50) UNIQUE,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(8,2) DEFAULT 0.00,
    shipping_cost DECIMAL(8,2) DEFAULT 0.00,
    order_status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    payment_method VARCHAR(50),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Sample Data
INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip_code) VALUES
('John', 'Smith', 'john.smith@email.com', '555-0101', '123 Main St', 'Springfield', 'IL', '62701'),
('Emma', 'Johnson', 'emma.j@email.com', '555-0102', '456 Oak Ave', 'Portland', 'OR', '97201'),
('Michael', 'Brown', 'mbrown@email.com', '555-0103', '789 Pine St', 'Denver', 'CO', '80202'),
('Sarah', 'Davis', 'sarah.davis@email.com', '555-0104', '321 Elm Dr', 'Austin', 'TX', '73301'),
('David', 'Wilson', 'dwilson@email.com', '555-0105', '654 Maple Ln', 'Seattle', 'WA', '98101');

INSERT INTO products (product_name, description, category, price, cost, stock_quantity, sku) VALUES
('Wireless Headphones', 'High-quality Bluetooth headphones', 'Electronics', 129.99, 65.00, 50, 'WH-001'),
('Coffee Maker', 'Programmable 12-cup coffee maker', 'Appliances', 89.99, 45.00, 25, 'CM-002'),
('Desk Lamp', 'LED desk lamp with USB charging', 'Office', 49.99, 25.00, 75, 'DL-003'),
('Yoga Mat', 'Premium non-slip yoga mat', 'Sports', 34.99, 18.00, 100, 'YM-004'),
('Phone Case', 'Protective phone case', 'Accessories', 24.99, 12.00, 200, 'PC-005');

INSERT INTO orders (customer_id, order_number, order_date, total_amount, tax_amount, order_status, payment_method) VALUES
(1, 'ORD-2024-001', '2024-02-20 10:15:00', 129.99, 10.40, 'delivered', 'Credit Card'),
(2, 'ORD-2024-002', '2024-02-21 14:30:00', 89.99, 7.20, 'delivered', 'PayPal'),
(1, 'ORD-2024-003', '2024-02-22 16:45:00', 49.99, 4.00, 'shipped', 'Credit Card'),
(3, 'ORD-2024-004', '2024-02-23 09:20:00', 34.99, 2.80, 'processing', 'Debit Card'),
(4, 'ORD-2024-005', '2024-02-24 11:10:00', 24.99, 2.00, 'pending', 'Credit Card');`;
  }
  
  // Default schema for other prompts
  return `-- Generated Database Schema
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Sample Data
INSERT INTO customers (name, email, phone) VALUES
('John Smith', 'john@example.com', '555-0101'),
('Emma Johnson', 'emma@example.com', '555-0102'),
('Michael Brown', 'michael@example.com', '555-0103');

INSERT INTO orders (customer_id, total_amount, status) VALUES
(1, 129.99, 'completed'),
(2, 249.95, 'shipped'),
(1, 67.50, 'pending');`;
}

// Update schema display from generated SQL
function updateSchemaDisplayFromSQL(sqlText) {
  const schemaContent = document.getElementById('schemaContent');
  
  // Parse table names and structures from SQL (simplified)
  const tables = [];
  const createTableRegex = /CREATE TABLE (\w+) \(([\s\S]*?)\);/gi;
  let match;
  
  while ((match = createTableRegex.exec(sqlText)) !== null) {
    const tableName = match[1];
    const columnsText = match[2];
    
    // Extract column definitions (simplified parsing)
    const columns = columnsText
      .split(',')
      .map(col => col.trim())
      .filter(col => col && !col.includes('FOREIGN KEY'))
      .map(col => {
        const parts = col.split(' ');
        return {
          name: parts[0],
          type: parts[1] || 'VARCHAR'
        };
      });
    
    tables.push({ name: tableName, columns });
  }
  
  // Update the display
  schemaContent.innerHTML = tables.map(table => `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
      <div class="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
        <span class="font-medium text-gray-800 text-sm">${table.name}</span>
        <span class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">${table.columns.length} cols</span>
      </div>
      <div class="p-3 text-xs font-mono space-y-1">
        ${table.columns.map(col => `
          <div class="flex justify-between">
            <span class="text-gray-700">${col.name}</span>
            <span class="text-blue-600">${col.type}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Utility functions
function generateMockDataset(prompt) {
  // This would integrate with your AI dataset generation
  console.log('Generating dataset for:', prompt);
  
  // Update schema display with new mock data based on prompt
  updateSchemaDisplay();
  
  // Show success notification
  showNotification('Dataset generated successfully!', 'success');
}

function executeQuery(query) {
  try {
    // This would integrate with your SQL execution engine
    console.log('Executing query:', query);
    
    // Mock query execution with sample results
    const results = mockQueryExecution(query);
    updateResultsTable(results);
    hideError();
    
    // Update results info
    document.getElementById('rowCount').textContent = `${results.length} rows returned`;
    document.getElementById('queryTime').textContent = '0.02s';
    
  } catch (error) {
    showError(error.message);
  }
}

function mockQueryExecution(query) {
  const lowerQuery = query.toLowerCase();
  
  // Enhanced mock execution based on query content
  if (lowerQuery.includes('customers') && lowerQuery.includes('orders')) {
    return [
      {customer_id: 1, name: 'John Smith', email: 'john@example.com', total: 129.99, order_id: 1001},
      {customer_id: 2, name: 'Emma Johnson', email: 'emma@example.com', total: 249.95, order_id: 1002},
      {customer_id: 1, name: 'John Smith', email: 'john@example.com', total: 67.50, order_id: 1005}
    ];
  } else if (lowerQuery.includes('customers')) {
    return sampleData.customers;
  } else if (lowerQuery.includes('orders')) {
    return sampleData.orders;
  } else if (lowerQuery.includes('products')) {
    return sampleData.products;
  }
  
  // Default return
  return sampleData.customers.slice(0, 3);
}

function updateResultsTable(results) {
  const tbody = document.querySelector('#resultsTable tbody');
  const emptyState = document.getElementById('emptyResults');
  
  if (results.length === 0) {
    document.getElementById('resultsTable').style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  document.getElementById('resultsTable').style.display = 'table';
  emptyState.style.display = 'none';
  
  // Update table headers if needed
  const headers = Object.keys(results[0]);
  const thead = document.querySelector('#resultsTable thead tr');
  thead.innerHTML = headers.map(header => 
    `<th class="px-4 py-3 text-left text-sm font-medium text-gray-900">${header}</th>`
  ).join('');
  
  // Update table body
  tbody.innerHTML = results.map(row => 
    `<tr class="hover:bg-gray-50">
      ${headers.map(header => 
        `<td class="px-4 py-3 text-sm text-gray-900">${row[header]}</td>`
      ).join('')}
    </tr>`
  ).join('');
}

function updateSchemaDisplay() {
  // This would update the schema panel with new table information
  console.log('Schema updated');
}

function showError(message) {
  const errorPanel = document.getElementById('errorPanel');
  const errorMessage = document.getElementById('errorMessage');
  
  errorMessage.textContent = message;
  errorPanel.classList.add('show');
}

function hideError() {
  const errorPanel = document.getElementById('errorPanel');
  errorPanel.classList.remove('show');
}

function showNotification(message, type = 'info') {
  // Simple notification system
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
    type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
    'bg-blue-100 text-blue-800 border border-blue-200'
  }`;
  notification.innerHTML = `
    <div class="flex items-center space-x-2">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}