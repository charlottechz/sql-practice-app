function generateFallbackSchema(prompt) {
  // Simple fallback schema for when the API is unavailable
  return `-- Fallback SQL Schema for: ${prompt}
-- Note: This is a simplified schema created when the AI service is unavailable

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
            schema: generateFallbackSchema(prompt),
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
                content: `Generate a complete SQL schema based on this description: "${prompt}". 
          
          Please include:
          1. CREATE TABLE statements with appropriate data types (use SQLite syntax - INTEGER, TEXT, REAL, BLOB)
          2. Primary keys using INTEGER PRIMARY KEY AUTOINCREMENT
          3. Foreign keys and constraints where appropriate
          4. Sample INSERT statements with realistic data (5-10 rows per table)
          5. Comments explaining the schema design
          
          Make sure the schema is production-ready with proper normalization and relationships. 
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
          
          const generatedSchema = claudeData.content[0].text;

          return new Response(JSON.stringify({ 
            schema: generatedSchema,
            source: 'claude-api'
          }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });

        } catch (apiError) {
          console.error("Claude API call failed:", apiError);
          
          // Return fallback schema if API fails
          return new Response(JSON.stringify({ 
            schema: generateFallbackSchema(prompt),
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
          schema: generateFallbackSchema("default"),
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
              Generate SQL Schema
            </h3>
            <div class="space-y-3">
              <textarea
                id="schemaPrompt"
                rows="3"
                placeholder="Describe your schema needs (e.g., 'Generate a schema for a retail store with customers and orders')"
                class="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              ></textarea>
              <button
                id="generateSchemaBtn"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                <i class="fas fa-database"></i>
                <span>Generate & Load Schema</span>
              </button>
            </div>
          </div>

          <!-- Schema Overview -->
          <div class="p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900 flex items-center">
                <i class="fas fa-table text-green-600 mr-2"></i>
                Schema Overview
              </h3>
              <button id="collapseSchema" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-chevron-up"></i>
              </button>
            </div>
            
            <div id="schemaContent" class="space-y-3">
              <div class="text-sm text-gray-500 text-center py-4">
                Generate a schema to see tables here
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
            <textarea id="sqlEditor" class="hidden">-- Your generated SQL schema will appear here
-- Try generating a schema first using the panel on the left
-- Then write SELECT queries to test your data

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
              <button
                id="loadSchemaBtn"
                class="bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center space-x-2"
              >
                <i class="fas fa-upload"></i>
                <span>Load Schema to DB</span>
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
    
    // Setup event listeners
    setupEventListeners();
  });

  // Initialize SQL.js database
  async function initializeSQLJS() {
    try {
      addDebugInfo('Initializing SQL.js...');
      updateDatabaseStatus('initializing');
      
      // Load SQL.js WASM
      const SQL = await initSqlJs({
        locateFile: file => \`https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/\${file}\`
      });
      
      // Create a new database
      db = new SQL.Database();
      
      addDebugInfo('SQL.js initialized successfully');
      updateDatabaseStatus('connected');
      updateStatus('SQLite database ready. Generate a schema to get started.');
      
    } catch (error) {
      addDebugInfo(\`Failed to initialize SQL.js: \${error.message}\`);
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
    
    // Generate Schema Button Handler
    document.getElementById('generateSchemaBtn').addEventListener('click', generateAndLoadSchema);

    // SQL Editor buttons
    document.getElementById('runQueryBtn').addEventListener('click', executeQuery);
    document.getElementById('formatBtn').addEventListener('click', formatSQL);
    document.getElementById('clearBtn').addEventListener('click', clearEditor);
    document.getElementById('loadSchemaBtn').addEventListener('click', loadSchemaToDatabase);

    // Error handling
    document.getElementById('dismissError').addEventListener('click', hideError);

    // Schema panel controls
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

    // Mobile toggle
    document.getElementById('toggleSchema').addEventListener('click', function() {
      const panel = document.getElementById('schemaPanel');
      panel.classList.toggle('collapsed');
    });
  }

  // Generate schema and load it into the database
  async function generateAndLoadSchema() {
    const prompt = document.getElementById('schemaPrompt').value.trim();
    if (!prompt) {
      showError('Please enter a schema description first.');
      return;
    }
    
    if (!db) {
      showError('Database not initialized. Please refresh the page.');
      return;
    }
    
    addDebugInfo(\`Starting schema generation for: \${prompt}\`);
    
    // Show loading state
    const btn = document.getElementById('generateSchemaBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Generating...</span>';
    btn.disabled = true;
    
    updateStatus('Generating SQL schema...');
    updateDatabaseStatus('loading');
    
    try {
      // Call API
      addDebugInfo('Making API call to /generate-schema');
      const response = await fetch('/generate-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });
      
      addDebugInfo(\`API response status: \${response.status}\`);
      const data = await response.json();
      addDebugInfo(\`API response received. Source: \${data.source}\`);
      
      if (data.error) {
        addDebugInfo(\`API Error: \${data.error}\`);
      }
      
      if (data.schema) {
  
        
        // Load the schema into the database
        await loadSchemaIntoDatabase(data.schema);
        
        // Update schema display
        updateSchemaDisplayFromSQL(data.schema);
        
        // Update status based on source
        if (data.source === 'claude-api') {
          updateStatus('SQL schema generated and loaded successfully using Claude AI');
          addDebugInfo('Successfully used Claude API and loaded schema into database');
        } else {
          updateStatus('Using mock schema and loaded into database (Claude API unavailable)');
          addDebugInfo('Used fallback schema and loaded into database');
        }
        
        updateDatabaseStatus('connected');
        
        if (data.error) {
          addDebugInfo(\`Warning: \${data.error}\`);
        }
      } else {
        throw new Error(data.error || 'Failed to generate schema');
      }
    } catch (error) {
      console.error('Error:', error);
      addDebugInfo(\`Error occurred: \${error.message}\`);
      showError('Failed to generate schema: ' + error.message);
      updateStatus('Schema generation failed');
      updateDatabaseStatus('error');
    } finally {
      // Reset button
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      addDebugInfo('Schema generation process completed');
    }
  }

  // Load schema into SQL.js database
  async function loadSchemaIntoDatabase(schemaSQL) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      addDebugInfo('Loading schema into database...');
      updateDatabaseStatus('loading');
      
      // Clear existing data first
      try {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (tables.length > 0) {
          for (const table of tables[0].values) {
            db.run(\`DROP TABLE IF EXISTS \${table[0]}\`);
            addDebugInfo(\`Dropped table: \${table[0]}\`);
          }
        }
      } catch (e) {
        addDebugInfo(\`Error clearing existing tables: \${e.message}\`);
      }
      
      // Split the schema into individual statements and execute them
      const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < statements.length; i++) {
        const trimmedStmt = statements[i].trim();
        if (trimmedStmt) {
          try {
            addDebugInfo(\`Executing statement \${i+1}/\${statements.length}: \${trimmedStmt.substring(0, 50)}...\`);
            db.run(trimmedStmt);
            successCount++;
          } catch (error) {
            errorCount++;
            addDebugInfo(\`Error executing statement: \${error.message}\`);
            // Continue with other statements
          }
        }
      }
      
      addDebugInfo(\`Schema loading completed: \${successCount} statements succeeded, \${errorCount} failed\`);
      
      // Verify tables were created
      const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      if (result.length > 0) {
        const tableCount = result[0].values.length;
        addDebugInfo(\`Verified \${tableCount} tables in database\`);
        updateStatus(\`Database loaded with \${tableCount} tables. Ready for queries!\`);
        updateDatabaseStatus('connected');
      } else {
        addDebugInfo("No tables were created in the database!");
        updateDatabaseStatus('error');
        throw new Error("Failed to create any tables. Check your SQL syntax.");
      }
      
    } catch (error) {
      addDebugInfo(\`Error loading schema: \${error.message}\`);
      console.error("Schema loading error:", error);
      updateDatabaseStatus('error');
      throw error;
    }
  }

  // Load current editor content into database
  async function loadSchemaToDatabase() {
    const schemaSQL = sqlEditor.getValue().trim();
    if (!schemaSQL) {
      showError('No SQL content to load. Generate a schema first.');
      return;
    }

    if (!db) {
      showError('Database not initialized. Please refresh the page.');
      return;
    }

    const btn = document.getElementById('loadSchemaBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading...</span>';
    btn.disabled = true;

    try {
      await loadSchemaIntoDatabase(schemaSQL);
      updateSchemaDisplayFromSQL(schemaSQL);
      showNotification('Schema loaded into database successfully!', 'success');
    } catch (error) {
      showError('Failed to load schema: ' + error.message);
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  // Execute SQL query
  async function executeQuery() {
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
      addDebugInfo(\`Executing query: \${query.substring(0, 100)}...\`);
      
      const results = db.exec(query);
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      addDebugInfo(\`Query executed in \${executionTime}ms\`);
      
      if (results.length === 0) {
        // Query executed but returned no results (e.g., INSERT, UPDATE, DELETE)
        displayEmptyResults(executionTime);
        updateStatus(\`Query executed successfully in \${executionTime}ms (no results returned)\`);
        addDebugInfo('Query executed successfully but returned no rows');
      } else {
        // Display results
        displayQueryResults(results[0], executionTime);
        addDebugInfo(\`Query returned \${results[0].values.length} rows\`);
      }

    } catch (error) {
      console.error("SQL Query Error:", error);
      addDebugInfo(\`Query error: \${error.message}\`);
      showError('SQL Error: ' + error.message);
      updateStatus('Query execution failed');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  // Display query results in the table
  function displayQueryResults(result, executionTime) {
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsTable = document.getElementById('resultsTable');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsBody = document.getElementById('resultsBody');
    const emptyResults = document.getElementById('emptyResults');
    const rowCount = document.getElementById('rowCount');
    const queryTime = document.getElementById('queryTime');

    // Show results panel
    resultsPanel.classList.add('show');
    
    // Hide empty results message and show table
    emptyResults.style.display = 'none';
    resultsTable.style.display = 'table';

    // Clear previous results
    resultsHeader.innerHTML = '';
    resultsBody.innerHTML = '';

    // Create header row
    result.columns.forEach(column => {
      const th = document.createElement('th');
      th.className = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
      th.textContent = column;
      resultsHeader.appendChild(th);
    });

    // Create data rows
    result.values.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
      
      row.forEach(cell => {
        const td = document.createElement('td');
        td.className = 'px-4 py-3 text-sm text-gray-900 max-w-xs truncate';
        
        // Handle different data types
        if (cell === null) {
          td.textContent = 'NULL';
          td.className += ' text-gray-400 italic';
        } else if (typeof cell === 'object') {
          td.textContent = JSON.stringify(cell);
        } else {
          td.textContent = String(cell);
        }
        
        // Add tooltip for long content
        if (String(cell).length > 50) {
          td.title = String(cell);
        }
        
        tr.appendChild(td);
      });
      
      resultsBody.appendChild(tr);
    });

    // Update statistics
    rowCount.textContent = \`\${result.values.length} rows\`;
    queryTime.textContent = \`\${executionTime}ms\`;
    
    updateStatus(\`Query executed successfully. \${result.values.length} rows returned in \${executionTime}ms.\`);
  }

  // Display empty results
  function displayEmptyResults(executionTime) {
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsTable = document.getElementById('resultsTable');
    const emptyResults = document.getElementById('emptyResults');
    const rowCount = document.getElementById('rowCount');
    const queryTime = document.getElementById('queryTime');

    // Show results panel
    resultsPanel.classList.add('show');
    
    // Show empty results message and hide table
    resultsTable.style.display = 'none';
    emptyResults.style.display = 'block';

    // Update statistics
    rowCount.textContent = '0 rows';
    queryTime.textContent = \`\${executionTime}ms\`;
  }

  // Format SQL code
  function formatSQL() {
    let sql = sqlEditor.getValue();
    if (!sql.trim()) return;

    // Basic SQL formatting
    sql = sql
      .replace(/\\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\\s*,\\s*/g, ',\\n  ') // Add line breaks after commas
      .replace(/\\s*(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ORDER BY|GROUP BY|HAVING|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\\s+/gi, '\\n$1 ')
      .replace(/\\s*;\\s*/g, ';\\n\\n') // Add line breaks after semicolons
      .trim();

    sqlEditor.setValue(sql);
    showNotification('SQL formatted!', 'success');
  }

  // Clear editor
  function clearEditor() {
    if (confirm('Clear the SQL editor?')) {
      sqlEditor.setValue('');
      hideError();
      document.getElementById('resultsPanel').classList.remove('show');
      updateStatus('Editor cleared. Ready for new queries.');
    }
  }

  // Update schema display from SQL
  function updateSchemaDisplayFromSQL(sql) {
    const schemaContent = document.getElementById('schemaContent');
    
    try {
      // Extract table information from SQL
      const tables = extractTablesFromSQL(sql);
      
      if (tables.length === 0) {
        schemaContent.innerHTML = \`
          <div class="text-sm text-gray-500 text-center py-4">
            <i class="fas fa-exclamation-triangle text-yellow-500 mb-2"></i>
            <p>No tables found in schema</p>
          </div>
        \`;
        return;
      }

      let html = '';
      tables.forEach(table => {
        html += \`
          <div class="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center">
                <i class="fas fa-table text-blue-600 mr-2"></i>
                <span class="font-semibold text-gray-900">\${table.name}</span>
              </div>
              <span class="text-xs text-gray-500">\${table.columns.length} columns</span>
            </div>
            <div class="space-y-1">
        \`;
        
        table.columns.forEach(column => {
          const isPrimary = column.toLowerCase().includes('primary key');
          const isForeign = column.toLowerCase().includes('foreign key') || column.toLowerCase().includes('references');
          
          html += \`
            <div class="text-xs flex items-center justify-between p-1 rounded \${isPrimary ? 'bg-yellow-100' : isForeign ? 'bg-blue-100' : 'bg-gray-100'}">
              <span class="font-mono text-gray-700 truncate">\${column}</span>
              \${isPrimary ? '<i class="fas fa-key text-yellow-600 ml-1" title="Primary Key"></i>' : ''}
              \${isForeign ? '<i class="fas fa-link text-blue-600 ml-1" title="Foreign Key"></i>' : ''}
            </div>
          \`;
        });
        
        html += \`
            </div>
          </div>
        \`;
      });

      schemaContent.innerHTML = html;
      
    } catch (error) {
      addDebugInfo(\`Error parsing schema: \${error.message}\`);
      schemaContent.innerHTML = \`
        <div class="text-sm text-gray-500 text-center py-4">
          <i class="fas fa-exclamation-triangle text-orange-500 mb-2"></i>
          <p>Schema loaded (parsing error)</p>
        </div>
      \`;
    }
  }

  // Extract table information from SQL
  function extractTablesFromSQL(sql) {
    const tables = [];
    const createTableRegex = /CREATE\\s+TABLE\\s+(\\w+)\\s*\\(([\\s\\S]*?)\\);/gi;
    let match;

    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const tableDefinition = match[2];
      
      // Extract columns - improved parsing
      const columns = tableDefinition
        .split(',')
        .map(col => col.trim().replace(/\\s+/g, ' '))
        .filter(col => col && !col.toLowerCase().startsWith('foreign key') && !col.toLowerCase().startsWith('constraint'));

      tables.push({
        name: tableName,
        columns: columns
      });
    }

    return tables;
  }

  // Show error message
  function showError(message) {
    const errorPanel = document.getElementById('errorPanel');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorPanel.classList.add('show');
    
    addDebugInfo(\`Error shown: \${message}\`);
  }

  // Hide error message
  function hideError() {
    document.getElementById('errorPanel').classList.remove('show');
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = \`fixed top-4 right-4 max-w-sm p-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300\`;
    
    // Set colors based on type
    switch (type) {
      case 'success':
        notification.className += ' bg-green-100 border border-green-200 text-green-800';
        break;
      case 'error':
        notification.className += ' bg-red-100 border border-red-200 text-red-800';
        break;
      default:
        notification.className += ' bg-blue-100 border border-blue-200 text-blue-800';
    }
    
    notification.innerHTML = \`
      <div class="flex items-center space-x-2">
        <i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span class="text-sm font-medium">\${message}</span>
      </div>
    \`;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Update status message
  function updateStatus(message) {
    const statusContent = document.getElementById('statusContent');
    statusContent.textContent = message;
    addDebugInfo(\`Status: \${message}\`);
  }

  // Add debug information
  function addDebugInfo(message) {
    const timestamp = new Date().toLocaleTimeString();
    debugInfo.push(\`[\${timestamp}] \${message}\`);
    
    // Keep only last 50 entries
    if (debugInfo.length > 50) {
      debugInfo.shift();
    }
    
    // Update debug panel if visible
    const debugContent = document.getElementById('debugContent');
    if (debugContent) {
      debugContent.innerHTML = debugInfo.join('\\n');
      debugContent.scrollTop = debugContent.scrollHeight;
    }
  }

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