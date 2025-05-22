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

  // Event listeners
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
  // Simple mock execution - in reality this would be handled by your backend
  if (query.toLowerCase().includes('customers') && query.toLowerCase().includes('orders')) {
    return [
      {id: 2, name: 'Emma Johnson', email: 'emma@example.com', total: '$249.95', order_id: 1002},
      {id: 1, name: 'John Smith', email: 'john@example.com', total: '$129.99', order_id: 1001},
      {id: 1, name: 'John Smith', email: 'john@example.com', total: '$67.50', order_id: 1005}
    ];
  }
  return [];
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