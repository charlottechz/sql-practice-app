function generateFallbackSchema(prompt) {
  // Simple fallback database for when the API is unavailable
  return `-- Fallback SQL Database for: ${prompt}
-- Note: This is a simplified database created when the AI service is unavailable

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Sample data
INSERT INTO customers (id, name, email) VALUES
(1, 'John Smith', 'john@example.com'),
(2, 'Emma Johnson', 'emma@example.com'),
(3, 'Michael Brown', 'michael@example.com');

INSERT INTO orders (id, customer_id, total, status) VALUES
(1001, 1, 129.99, 'completed'),
(1002, 1, 249.95, 'completed'),
(1003, 2, 67.50, 'processing'),
(1004, 3, 89.99, 'processing'),
(1005, 2, 67.50, 'completed');`;
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    const url = new URL(request.url);

    // Handle API endpoint
    if (request.method === "POST" && url.pathname === "/generate-schema") {
      try {
        console.log("Processing generate-schema request");
        
        // request body
        let data;
        try {
          data = await request.json();
        } catch (e) {
          console.error("Failed to parse request body:", e);
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
        const { prompt } = data;
        
        if (!prompt) {
          return new Response(JSON.stringify({ error: "Prompt is required" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }

        // Check if Claude API key is available
        if (!env["claude-sql-api-2"]) {
          console.error("Claude API key not found in environment variables");
          return new Response(JSON.stringify({ 
            error: "Claude API key not configured",
            database: generateFallbackSchema(prompt),
            source: 'fallback'
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }

        // Debug: Log that we have an API key 
        console.log("Claude API key found, attempting API call...");

        // Call Claude API with updated model and better error handling
        try {
          console.log("Calling Claude API...");
          
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': env["claude-sql-api-2"],  
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',  
              max_tokens: 2000,
              messages: [{
                role: 'user',
                content: `Generate a complete SQL database based on this description: "${prompt}". 
          
          Please include:
          1. CREATE TABLE statements with appropriate data types (use SQLite syntax - INTEGER, TEXT, REAL, BLOB)
          2. Primary keys using INTEGER PRIMARY KEY AUTOINCREMENT
          3. Foreign keys and constraints where appropriate
          4. Sample INSERT statements with realistic data (5-10 rows per table)
          5. Comments explaining the database design
          
          Make sure the database is production-ready with proper normalization and relationships. 
          Format the output as clean, executable SQLite SQL that can be run in sql.js.
          Use SQLite-compatible syntax only.`
              }]
            })
          });
          
          console.log("Claude API response status:", claudeResponse.status);
          
          if (!claudeResponse.ok) {
            const errorText = await claudeResponse.text();
            console.error("Claude API error details:", {
              status: claudeResponse.status,
              statusText: claudeResponse.statusText,
              body: errorText
            });
            
            let errorMessage;
            switch (claudeResponse.status) {
              case 401:
                errorMessage = "Authentication failed - API key may be invalid";
                break;
              case 429:
                errorMessage = "Rate limit exceeded - please try again later";
                break;
              case 500:
                errorMessage = "Claude API service error";
                break;
              default:
                errorMessage = `API error (${claudeResponse.status}): ${errorText}`;
            }
            
            throw new Error(errorMessage);
          }
          
          const claudeData = await claudeResponse.json();
          console.log("Claude API response received successfully");
          
          // Check if response has expected structure
          if (!claudeData.content || !claudeData.content[0] || !claudeData.content[0].text) {
            console.error("Unexpected Claude API response structure:", claudeData);
            throw new Error("Invalid response structure from Claude API");
          }
          
          const generatedDatabase = claudeData.content[0].text;

          return new Response(JSON.stringify({ 
            database: generatedDatabase,
            source: 'claude-api'
          }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });

        } catch (apiError) {
          console.error("Claude API call failed:", apiError);
          
          // Return fallback database if API fails
          return new Response(JSON.stringify({ 
            database: generateFallbackSchema(prompt),
            source: 'fallback',
            error: `API call failed: ${apiError.message}`
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        
      } catch (error) {
        console.error("Error handling request:", error);
        return new Response(JSON.stringify({ 
          error: error.message,
          database: generateFallbackSchema("default"),
          source: 'fallback'
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
    }

    // Serve index.html for root path
    if (url.pathname === "/" || url.pathname === "") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI SQL Playground</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/monokai.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/sql/sql.min.js"></script>
  <!-- SQL.js Library for in-browser SQLite -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"></script>
  <style>
    .schema-panel {
      transition: all 0.3s ease;
    }
    .schema-panel.collapsed {
      transform: translateX(-100%);
      opacity: 0;
    }
    .CodeMirror {
      height: 300px;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 14px;
    }
    .schema-display {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      padding: 1rem;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .schema-display .sql-keyword {
      color: #1e40af;
      font-weight: bold;
    }
    .schema-display .sql-comment {
      color: #6b7280;
      font-style: italic;
    }
    .schema-display .sql-string {
      color: #059669;
    }
    .table-container {
      max-height: 400px;
      overflow-y: auto;
    }
    .error-panel {
      transition: all 0.3s ease;
      max-height: 0;
      overflow: hidden;
    }
    .error-panel.show {
      max-height: 200px;
    }
    .debug-panel {
      transition: all 0.3s ease;
      max-height: 0;
      overflow: hidden;
    }
    .debug-panel.show {
      max-height: 300px;
    }
    .results-panel {
      transition: all 0.3s ease;
      max-height: 0;
      overflow: hidden;
    }
    .results-panel.show {
      max-height: 600px;
    }
    .db-status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .db-status.connected {
      background-color: #dcfce7;
      color: #166534;
    }
    .db-status.disconnected {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .table-info {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 0.375rem;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .table-info:hover {
      background: #e0f2fe;
      border-color: #0284c7;
    }
    .table-info h4 {
      color: #0c4a6e;
      font-weight: 600;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: between;
    }
    .column-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }
    .column-tag {
      background: #e0f2fe;
      color: #0c4a6e;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-family: monospace;
    }
    .row-count {
      font-size: 0.75rem;
      color: #6b7280;
      font-style: italic;
    }
    .query-btn {
      background: #3b82f6;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      border: none;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .query-btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen font-sans">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="bg-blue-600 text-white rounded-lg p-2">
            <i class="fas fa-database text-xl"></i>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">AI SQL Playground</h1>
            <p class="text-sm text-gray-600">Generate schemas with AI and test SQL queries</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <div id="dbStatus" class="db-status disconnected">
            <i class="fas fa-circle"></i>
            <span>Database: Initializing...</span>
          </div>
          <button id="showDebugBtn" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md transition-colors text-sm">
            <i class="fas fa-bug"></i> Debug
          </button>
          <button id="toggleSchema" class="lg:hidden bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md transition-colors">
            <i class="fas fa-bars"></i>
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 py-6">
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Schema Panel -->
      <div id="schemaPanel" class="lg:col-span-1 schema-panel">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <!-- Schema Generation -->
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
              <i class="fas fa-magic text-blue-600 mr-2"></i>
              Generate SQL Database
            </h3>
            <div class="space-y-3">
              <textarea
                id="databasePrompt"
                rows="3"
                placeholder="Describe your database needs (e.g., 'Generate a database for a retail store with customers and orders')"
                class="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              ></textarea>
              <button
                id="generateDatabaseBtn"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                <i class="fas fa-database"></i>
                <span>Generate & Load Database</span>
              </button>
            </div>
          </div>

          <!-- Schema Overview -->
          <div class="p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900 flex items-center">
                <i class="fas fa-table text-green-600 mr-2"></i>
                Database Overview
              </h3>
              <div class="flex items-center space-x-2">
                <button id="copyDatabaseBtn" class="text-gray-500 hover:text-gray-700 text-sm" title="Copy database to clipboard" style="display: none;">
                  <i class="fas fa-copy"></i>
                </button>
                <button id="loadToEditorBtn" class="text-gray-500 hover:text-gray-700 text-sm" title="Load database to editor" style="display: none;">
                  <i class="fas fa-edit"></i>
                </button>
                <button id="collapseDatabase" class="text-gray-500 hover:text-gray-700">
                  <i class="fas fa-chevron-up"></i>
                </button>
              </div>
            </div>
            
            <div id="databaseContent" class="space-y-3">
              <div class="text-sm text-gray-500 text-center py-4">
                Generate a database to see tables here
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Debug Panel -->
        <div id="debugPanel" class="debug-panel bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
          <div class="p-4">
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center space-x-2">
                <i class="fas fa-bug text-yellow-600"></i>
                <h4 class="font-medium text-yellow-800">Debug Information</h4>
              </div>
              <button id="hideDebugBtn" class="text-yellow-600 hover:text-yellow-800">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div id="debugContent" class="text-sm text-yellow-700 font-mono bg-yellow-100 p-3 rounded border overflow-auto max-h-48">
              <div>Debug info will appear here...</div>
            </div>
          </div>
        </div>

        <!-- SQL Query Editor -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <h3 class="font-semibold text-gray-900 flex items-center">
              <i class="fas fa-code text-green-600 mr-2"></i>
              SQL Query Editor
            </h3>
          </div>
          <div class="p-4">
            <textarea id="sqlEditor" class="hidden">-- Write your SQL queries here
-- Example: SELECT * FROM customers LIMIT 5;

SELECT * FROM customers LIMIT 5;</textarea>
            
            <div class="flex flex-wrap gap-3 mt-4">
              <button
                id="runQueryBtn"
                class="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded-md transition-colors flex items-center space-x-2"
              >
                <i class="fas fa-play"></i>
                <span>Run Query</span>
              </button>
              <button
                id="formatBtn"
                class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center space-x-2"
              >
                <i class="fas fa-indent"></i>
                <span>Format SQL</span>
              </button>
              <button
                id="clearBtn"
                class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center space-x-2"
              >
                <i class="fas fa-trash"></i>
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Query Results Panel -->
        <div id="resultsPanel" class="results-panel bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-gray-900 flex items-center">
                <i class="fas fa-chart-bar text-purple-600 mr-2"></i>
                Query Results
              </h3>
              <div class="flex items-center space-x-4 text-sm text-gray-600">
                <span id="rowCount">0 rows</span>
                <span id="queryTime">0ms</span>
                <button id="hideResultsBtn" class="text-gray-500 hover:text-gray-700">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="p-4">
            <div class="table-container">
              <table id="resultsTable" class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50">
                  <tr id="resultsHeader">
                    <!-- Headers will be populated dynamically -->
                  </tr>
                </thead>
                <tbody id="resultsBody" class="bg-white divide-y divide-gray-200">
                  <!-- Results will be populated dynamically -->
                </tbody>
              </table>
              <div id="emptyResults" class="text-center py-8 text-gray-500" style="display: none;">
                <i class="fas fa-inbox text-3xl mb-2"></i>
                <p>No results to display</p>
                <p class="text-sm text-gray-400">Query executed successfully but returned no rows</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Panel -->
        <div id="errorPanel" class="error-panel bg-red-50 border border-red-200 rounded-lg overflow-hidden">
          <div class="p-4">
            <div class="flex items-start space-x-3">
              <i class="fas fa-exclamation-triangle text-red-600 mt-1"></i>
              <div class="flex-1">
                <h4 class="font-medium text-red-800">Error</h4>
                <p class="text-sm text-red-700 mt-1" id="errorMessage">
                  <!-- Error message will be inserted here -->
                </p>
                <div class="mt-2">
                  <button id="dismissError" class="text-sm text-red-600 hover:text-red-800 underline">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status/Info Panel -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <h3 class="font-semibold text-gray-900 flex items-center">
              <i class="fas fa-info-circle text-purple-600 mr-2"></i>
              Status
            </h3>
          </div>
          <div class="p-4">
            <div id="statusContent" class="text-sm text-gray-600">
              Initializing SQL.js database... Please wait.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
  // Global variables
  let sqlEditor;
  let db = null; // SQLite database instance
  let debugInfo = [];
  let currentDatabase = null; // Store the current database

  // Add missing functions
  function addDebugInfo(message) {
    const timestamp = new Date().toLocaleTimeString();
    debugInfo.push('[' + timestamp + '] ' + message);
    
    const debugContent = document.getElementById('debugContent');
    if (debugContent) {
      debugContent.innerHTML = debugInfo.slice(-20).join('\\n'); // Show last 20 messages
      debugContent.scrollTop = debugContent.scrollHeight;
    }
  }

  function updateStatus(message) {
    const statusContent = document.getElementById('statusContent');
    if (statusContent) {
      statusContent.textContent = message;
    }
  }

  function showError(message) {
    const errorPanel = document.getElementById('errorPanel');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    if (errorPanel) {
      errorPanel.classList.add('show');
    }
  }

  function hideError() {
    const errorPanel = document.getElementById('errorPanel');
    if (errorPanel) {
      errorPanel.classList.remove('show');
    }
  }

  function executeQuery() {
    const query = sqlEditor.getValue().trim();
    if (!query) {
      showError('Please enter a SQL query first.');
      return;
    }

    if (!db) {
      showError('Database not initialized. Please refresh the page.');
      return;
    }

    const btn = document.getElementById('runQueryBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Running...</span>';
    btn.disabled = true;

    hideError();
    const startTime = performance.now();

    try {
      addDebugInfo('Executing query: ' + query);
      
      const results = db.exec(query);
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      addDebugInfo('Query executed in ' + executionTime + 'ms');
      
      if (results.length === 0) {
        displayEmptyResults(executionTime);
        updateStatus('Query executed successfully in ' + executionTime + 'ms (no results returned)');
        addDebugInfo('Query executed successfully but returned no rows');
      } else {
        addDebugInfo('Query returned ' + results[0].values.length + ' rows with columns: ' + results[0].columns.join(', '));
        displayQueryResults(results[0], executionTime);
      }

    } catch (error) {
      console.error("SQL Query Error:", error);
      addDebugInfo('Query error: ' + error.message);
      showError('SQL Error: ' + error.message);
      updateStatus('Query execution failed');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  function displayQueryResults(result, executionTime) {
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsBody = document.getElementById('resultsBody');
    const rowCount = document.getElementById('rowCount');
    const queryTime = document.getElementById('queryTime');
    const emptyResults = document.getElementById('emptyResults');
    const resultsTable = document.getElementById('resultsTable');

    // Clear previous results
    resultsHeader.innerHTML = '';
    resultsBody.innerHTML = '';
    emptyResults.style.display = 'none';
    
    // Make sure the table is visible (fix the main issue)
    resultsTable.style.display = 'table';

    // Show panel
    resultsPanel.classList.add('show');

    // Update stats
    rowCount.textContent = result.values.length + ' rows';
    queryTime.textContent = executionTime + 'ms';

    // Create headers
    result.columns.forEach(column => {
      const th = document.createElement('th');
      th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
      th.textContent = column;
      resultsHeader.appendChild(th);
    });

    // Create rows
    result.values.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
        td.textContent = cell !== null ? cell : 'NULL';
        tr.appendChild(td);
      });
      resultsBody.appendChild(tr);
    });
    
    addDebugInfo('Results table displayed with ' + result.values.length + ' rows');
  }

  function displayEmptyResults(executionTime) {
    const resultsPanel = document.getElementById('resultsPanel');
    const emptyResults = document.getElementById('emptyResults');
    const rowCount = document.getElementById('rowCount');
    const queryTime = document.getElementById('queryTime');
    const resultsTable = document.getElementById('resultsTable');

    // Show panel
    resultsPanel.classList.add('show');
    emptyResults.style.display = 'block';

    // Update stats
    rowCount.textContent = '0 rows';
    queryTime.textContent = executionTime + 'ms';

    // Hide table when no results
    resultsTable.style.display = 'none';
    
    addDebugInfo('Empty results displayed');
  }

  function formatSQL() {
    // Simple SQL formatting
    const value = sqlEditor.getValue();
    const formatted = value
      .replace(/\\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ORDER BY|GROUP BY|HAVING|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\\b/gi, '\\n$1')
      .replace(/,/g, ',\\n  ')
      .replace(/\\s+/g, ' ')
      .trim();
    sqlEditor.setValue(formatted);
  }

  function clearEditor() {
    sqlEditor.setValue('');
  }

  // Function to extract table information from schema
  function extractTableInfo(database) {
    const tables = [];
    const lines = database.split('\\n');
    let currentTable = null;
    let inTableDefinition = false;
    
    for (let line of lines) {
      const trimmedLine = line.trim();
      
      // Check for CREATE TABLE statement
      const createTableMatch = trimmedLine.match(/CREATE TABLE\\s+(\\w+)/i);
      if (createTableMatch) {
        if (currentTable) {
          tables.push(currentTable);
        }
        currentTable = {
          name: createTableMatch[1],
          columns: []
        };
        inTableDefinition = true;
        continue;
      }
      
      // Check for end of table definition
      if (inTableDefinition && trimmedLine.includes(');')) {
        inTableDefinition = false;
        if (currentTable) {
          tables.push(currentTable);
          currentTable = null;
        }
        continue;
      }
      
      // Parse column definitions
      if (inTableDefinition && currentTable && trimmedLine && !trimmedLine.startsWith('--')) {
        // Skip FOREIGN KEY constraints and other non-column lines
        if (trimmedLine.toUpperCase().startsWith('FOREIGN KEY') || 
            trimmedLine.toUpperCase().startsWith('CONSTRAINT') ||
            trimmedLine.toUpperCase().startsWith('PRIMARY KEY') ||
            trimmedLine.toUpperCase().startsWith('UNIQUE') ||
            trimmedLine.toUpperCase().startsWith('CHECK')) {
          continue;
        }
        
        // Parse column definition
        const columnMatch = trimmedLine.match(/(\\w+)\\s+([\\w\\s\\(\\),]+?)(?:,|$)/i);
        if (columnMatch) {
          let columnName = columnMatch[1];
          let columnType = columnMatch[2].replace(/,$/, '').trim();
          
          // Clean up the type (remove constraints like NOT NULL, PRIMARY KEY, etc.)
          columnType = columnType.split(/\\s+/)[0];
          
          currentTable.columns.push(columnName + ' (' + columnType + ')');
        }
      }
    }
    
    // Don't forget the last table
    if (currentTable) {
      tables.push(currentTable);
    }
    
    return tables;
  }

  // Function to display database in the left panel
  function displayDatabaseInPanel(database) {
    const databaseContent = document.getElementById('databaseContent');
    const copyBtn = document.getElementById('copyDatabaseBtn');
    const loadBtn = document.getElementById('loadToEditorBtn');
    
    // Store the database globally
    currentDatabase = database;
    
    // Show action buttons
    copyBtn.style.display = 'inline-block';
    loadBtn.style.display = 'inline-block';
    
    // Extract table information from database
    const tables = extractTableInfo(database);
    
    if (tables.length === 0) {
      databaseContent.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">No tables found in database</div>';
      return;
    }
    
    // Display table information with row counts
    let html = '';
    tables.forEach(table => {
      // Get row count from database if available
      let rowCount = 'Unknown';
      if (db) {
        try {
          const result = db.exec('SELECT COUNT(*) as count FROM ' + table.name);
          if (result.length > 0) {
            rowCount = result[0].values[0][0];
          }
        } catch (e) {
          rowCount = '0';
        }
      }
      
      html += \`
        <div class="table-info" onclick="selectTableForQuery('\${table.name}')">
          <h4>
            <i class="fas fa-table mr-2"></i>
            \${table.name}
            <button class="query-btn ml-auto" onclick="event.stopPropagation(); selectTableForQuery('\${table.name}')">
              <i class="fas fa-arrow-right mr-1"></i>Query
            </button>
          </h4>
          <div class="column-list">
            \${table.columns.map(col => \`<span class="column-tag">\${col}</span>\`).join('')}
          </div>
          <div class="row-count">
            <i class="fas fa-database mr-1"></i>
            \${rowCount} rows
          </div>
        </div>
      \`;
    });
    
    // Add a button to show the schema creation SQL (stretch goal implementation)
    html += \`
      <div class="mt-4 pt-4 border-t border-gray-200">
        <button id="showSchemaBtn" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2">
          <i class="fas fa-code"></i>
          <span>Show me how this schema was created using SQL</span>
        </button>
      </div>
    \`;
    
    databaseContent.innerHTML = html;
    
    // Add event listener for the new button
    document.getElementById('showSchemaBtn').addEventListener('click', function() {
      if (currentDatabase) {
        sqlEditor.setValue(currentDatabase);
        updateStatus('Schema creation SQL loaded to editor. You can see how the database was built!');
        
        // Temporarily change button text to show action was performed
        const originalHTML = this.innerHTML;
        this.innerHTML = '<i class="fas fa-check"></i><span>Schema SQL loaded to editor</span>';
        this.classList.remove('bg-gray-100', 'hover:bg-gray-200');
        this.classList.add('bg-green-100', 'text-green-700');
        
        // Reset button back to original state after 2 seconds
        setTimeout(() => {
          this.innerHTML = originalHTML;
          this.classList.remove('bg-green-100', 'text-green-700');
          this.classList.add('bg-gray-100', 'hover:bg-gray-200');
        }, 2000);
      }
    });
  }

  // Initialize SQL.js first
  async function initializeSQLJS() {
    try {
      addDebugInfo('Initializing SQL.js...');
      updateDatabaseStatus('initializing');
      
      // Load SQL.js WASM
      const SQL = await initSqlJs({
        locateFile: file => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + file
      });
      
      // Create a new database
      db = new SQL.Database();
      
      addDebugInfo('SQL.js initialized successfully');
      updateDatabaseStatus('connected');
      updateStatus('SQLite database ready. Generate a database to get started.');
      
    } catch (error) {
      addDebugInfo('Failed to initialize SQL.js: ' + error.message);
      console.error('SQL.js initialization error:', error);
      showError('Failed to initialize database: ' + error.message);
      updateDatabaseStatus('error');
    }
  }

  // Update database status indicator
  function updateDatabaseStatus(status) {
    const statusEl = document.getElementById('dbStatus');
    
    switch (status) {
      case 'connected':
        statusEl.className = 'db-status connected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Database: Ready</span>';
        break;
      case 'initializing':
        statusEl.className = 'db-status disconnected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Database: Initializing...</span>';
        break;
      case 'error':
        statusEl.className = 'db-status disconnected';
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Database: Error</span>';
        break;
      case 'loading':
        statusEl.className = 'db-status disconnected';
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Database: Loading Schema...</span>';
        break;
    }
  }

  // Setup all event listeners
  function setupEventListeners() {
    // Debug functionality
    document.getElementById('showDebugBtn').addEventListener('click', function() {
      document.getElementById('debugPanel').classList.add('show');
    });
    
    document.getElementById('hideDebugBtn').addEventListener('click', function() {
      document.getElementById('debugPanel').classList.remove('show');
    });

    // Hide results panel
    document.getElementById('hideResultsBtn').addEventListener('click', function() {
      document.getElementById('resultsPanel').classList.remove('show');
    });
    
    // Generate Database Button Handler
    document.getElementById('generateDatabaseBtn').addEventListener('click', generateAndLoadDatabase);

    // SQL Editor buttons
    document.getElementById('runQueryBtn').addEventListener('click', executeQuery);
    document.getElementById('formatBtn').addEventListener('click', formatSQL);
    document.getElementById('clearBtn').addEventListener('click', clearEditor);

    // Database panel buttons
    document.getElementById('copyDatabaseBtn').addEventListener('click', copyDatabaseToClipboard);
    document.getElementById('loadToEditorBtn').addEventListener('click', loadDatabaseToEditor);

    // Error handling
    document.getElementById('dismissError').addEventListener('click', hideError);

    // Database panel controls
    document.getElementById('collapseDatabase').addEventListener('click', function() {
      const content = document.getElementById('databaseContent');
      const icon = this.querySelector('i');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.className = 'fas fa-chevron-up';
      } else {
        content.style.display = 'none';
        icon.className = 'fas fa-chevron-down';
      }
    });

    // Mobile toggle
    document.getElementById('toggleSchema').addEventListener('click', function() {
      const panel = document.getElementById('schemaPanel');
      panel.classList.toggle('collapsed');
    });
  }

  // Generate database and load it into the database
  async function generateAndLoadDatabase() {
    try {
      const prompt = document.getElementById('databasePrompt').value.trim();
      if (!prompt) {
        showError('Please enter a database description first.');
        return;
      }

      if (!db) {
        showError('Database not initialized. Please refresh the page.');
        return;
      }

      addDebugInfo("Starting database generation for: " + prompt);

      // Show loading state
      const btn = document.getElementById('generateDatabaseBtn');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Generating...</span>';
      btn.disabled = true;

      updateStatus('Generating SQL database...');
      updateDatabaseStatus('loading');

      try {
        const response = await fetch('/generate-schema', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
          throw new Error("HTTP error! status: " + response.status);
        }

        const data = await response.json();
        addDebugInfo("API response received. Source: " + data.source);

        if (data.error) {
          addDebugInfo("API Error: " + data.error);
        }

        if (data.database) {
          // Clean the database before processing
          const cleanedDatabase = cleanGeneratedDatabase(data.database);
          addDebugInfo('Database cleaned and ready for loading');
          
          await loadDatabaseIntoDatabase(cleanedDatabase);
          
          // Display database in the left panel
          displayDatabaseInPanel(cleanedDatabase);
          
          // Set a clean query editor with helpful comments instead of showing the schema SQL
          sqlEditor.setValue(\`-- Write your SQL queries here
-- Example: SELECT * FROM customers LIMIT 5;
-- Try these common queries:
--   SELECT COUNT(*) FROM table_name;
--   SELECT * FROM table_name WHERE condition;
--   SELECT column1, column2 FROM table_name ORDER BY column1;

\`);

          if (data.source === 'claude-api') {
            updateStatus('SQL database generated and loaded successfully using Claude AI');
            addDebugInfo('Successfully used Claude API and loaded database into database');
          } else {
            updateStatus('Using mock database and loaded into database (Claude API unavailable)');
            addDebugInfo('Used fallback database and loaded into database');
          }

          updateDatabaseStatus('connected');
        } else {
          throw new Error(data.error || 'Failed to generate database');
        }
      } catch (error) {
        console.error('Error:', error);
        addDebugInfo("Error occurred: " + error.message);
        showError('Failed to generate database: ' + error.message);
        updateStatus('Database generation failed');
        updateDatabaseStatus('error');
      } finally {
        // Reset button
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        addDebugInfo('Database generation process completed');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      showError('An unexpected error occurred: ' + error.message);
    }
  }

  // Add missing helper functions
  function copyDatabaseToClipboard() {
    if (currentDatabase) {
      navigator.clipboard.writeText(currentDatabase).then(() => {
        updateStatus('Database SQL copied to clipboard!');
      }).catch(err => {
        showError('Failed to copy to clipboard: ' + err.message);
      });
    }
  }

  function loadDatabaseToEditor() {
    if (currentDatabase) {
      sqlEditor.setValue(currentDatabase);
      updateStatus('Database SQL loaded to editor');
    }
  }

  function selectTableForQuery(tableName) {
    const sampleQuery = \`-- Querying the \${tableName} table
SELECT * FROM \${tableName} LIMIT 10;\`;
    sqlEditor.setValue(sampleQuery);
    updateStatus(\`Sample query for \${tableName} loaded. You can modify and run it!\`);
  }

  // Add this new function to clean generated database
  function cleanGeneratedDatabase(database) {
    // Remove markdown code blocks and clean up the database
    let cleaned = database
      // Remove markdown code block markers
      .replace(/\`\`\`sql\\s*/gi, '')
      .replace(/\`\`\`\\s*/g, '')
      // Remove any leading/trailing whitespace
      .trim();
    
    // Additional cleaning - remove explanatory text that's not SQL
    const lines = cleaned.split('\\n');
    const sqlLines = [];
    let inSQLBlock = false;
    
    for (let line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines at the start
      if (!inSQLBlock && !trimmedLine) {
        continue;
      }
      
      // Check if this is a SQL statement
      if (trimmedLine.match(/^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER)/i) || 
          trimmedLine.startsWith('--') || 
          inSQLBlock) {
        inSQLBlock = true;
        sqlLines.push(line);
      } else if (inSQLBlock && (trimmedLine.includes(';') || trimmedLine === '')) {
        // Continue collecting if we're in a SQL block
        sqlLines.push(line);
      } else if (!trimmedLine.match(/^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|--)/i) && 
                 !inSQLBlock) {
        // Skip explanatory text before SQL starts
        addDebugInfo("Skipping non-SQL line: " + trimmedLine.substring(0, 50) + "...");
        continue;
      }
    }
    
    const result = sqlLines.join('\\n').trim();
    addDebugInfo("Original database length: " + database.length + ", Cleaned length: " + result.length);
    
    return result;
  }

  // Update the loadDatabaseIntoDatabase function with better SQL parsing
  async function loadDatabaseIntoDatabase(databaseSQL) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      addDebugInfo('Loading database into database...');
      updateDatabaseStatus('loading');
      
      // Clear existing data first
      try {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (tables.length > 0) {
          for (const table of tables[0].values) {
            db.run("DROP TABLE IF EXISTS " + table[0]);
            addDebugInfo("Dropped table: " + table[0]);
          }
        }
      } catch (e) {
        addDebugInfo("Error clearing existing tables: " + e.message);
      }
      
      // Improved SQL statement parsing
      const statements = parseSQL(databaseSQL);
      addDebugInfo("Parsed " + statements.length + " SQL statements from database");
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (stmt) {
          try {
            addDebugInfo("Executing statement " + (i+1) + "/" + statements.length + ": " + stmt.substring(0, 50) + "...");
            db.run(stmt);
            successCount++;
            addDebugInfo("✓ Statement " + (i+1) + " executed successfully");
          } catch (error) {
            errorCount++;
            addDebugInfo("✗ Error executing statement " + (i+1) + ": " + error.message);
            addDebugInfo("Failed statement: " + stmt);
            console.error("SQL execution error for statement " + (i+1) + ":", error);
          }
        }
      }
      
      addDebugInfo("Database loading completed: " + successCount + " statements succeeded, " + errorCount + " failed");
      
      // Verify tables were created
      const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      if (result.length > 0) {
        const tableCount = result[0].values.length;
        addDebugInfo("Verified " + tableCount + " tables in database:");
        
        // Log each table that was created
        result[0].values.forEach((row, index) => {
          const tableName = row[0];
          addDebugInfo("  Table " + (index + 1) + ": " + tableName);
          
          // Test if we can query the table
          try {
            const testResult = db.exec("SELECT COUNT(*) as count FROM " + tableName);
            const rowCount = testResult[0].values[0][0];
            addDebugInfo("    ✓ Table " + tableName + " is queryable with " + rowCount + " rows");
          } catch (testError) {
            addDebugInfo("    ✗ Table " + tableName + " query test failed: " + testError.message);
          }
        });
        
        updateStatus("Database loaded with " + tableCount + " tables. Ready for queries!");
        updateDatabaseStatus('connected');
      } else {
        addDebugInfo("No tables were created in the database!");
        updateDatabaseStatus('error');
        throw new Error("Failed to create any tables. Check your SQL syntax.");
      }
      
    } catch (error) {
      addDebugInfo("Error loading database: " + error.message);
      console.error("Database loading error:", error);
      updateDatabaseStatus('error');
      throw error;
    }
  }

  // Add improved SQL parsing function
  function parseSQL(sql) {
    // Remove comments and normalize
    let cleanSQL = sql
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '') // Remove block comments
      .trim();

    const statements = [];
    let currentStatement = '';
    let parenthesesCount = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    
    for (let i = 0; i < cleanSQL.length; i++) {
      const char = cleanSQL[i];
      const prevChar = i > 0 ? cleanSQL[i - 1] : '';
      
      // Handle quotes
      if (char === "'" && prevChar !== '\\\\' && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && prevChar !== '\\\\' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
      
      // Handle parentheses (only if not in quotes)
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          parenthesesCount++;
        } else if (char === ')') {
          parenthesesCount--;
        }
      }
      
      currentStatement += char;
      
      // Check for statement end (semicolon outside quotes and balanced parentheses)
      if (char === ';' && !inSingleQuote && !inDoubleQuote && parenthesesCount === 0) {
        const trimmed = currentStatement.trim();
        if (trimmed && !trimmed.match(/^\\s*$/)) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }
    
    // Add remaining statement if it doesn't end with semicolon
    const trimmed = currentStatement.trim();
    if (trimmed && !trimmed.match(/^\\s*$/)) {
      statements.push(trimmed + (trimmed.endsWith(';') ? '' : ';'));
    }
    
    return statements.filter(stmt => {
      const cleaned = stmt.trim();
      return cleaned.length > 0 && 
             !cleaned.match(/^\\s*$/) && 
             !cleaned.match(/^-+\\s*$/) &&
             cleaned.match(/^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER)/i);
    });
  }

  // Initialize everything when the page loads
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize SQL.js first
    initializeSQLJS();
    
    // Initialize CodeMirror
    sqlEditor = CodeMirror.fromTextArea(document.getElementById('sqlEditor'), {
      mode: 'text/x-sql',
      theme: 'monokai',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      smartIndent: true
    });
    
    // Set initial helpful content
    sqlEditor.setValue(\`-- Write your SQL queries here
-- Example: SELECT * FROM customers LIMIT 5;
-- Try these common queries:
--   SELECT COUNT(*) FROM table_name;
--   SELECT * FROM table_name WHERE condition;
--   SELECT column1, column2 FROM table_name ORDER BY column1;

\`);
    
    // Setup event listeners
    setupEventListeners();
  });
  </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 
          "Content-Type": "text/html",
          ...corsHeaders
        }
      });
    }

    // Default response for other paths
    return new Response("AI SQL Schema Generator API", {
      headers: {
        "Content-Type": "text/plain",
        ...corsHeaders
      }
    });
  }
};