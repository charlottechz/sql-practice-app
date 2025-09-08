function generateFallbackSchema(prompt) {
  // Simple fallback database for when the API is unavailable
  return `-- Fallback SQL Database for: ${prompt} --
Note: This is a simplified database created when the AI service is unavailable
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

function fallbackCoach({ schema, query, error }) {
  return {
    explanation: `Could not analyze your query: "${query}". Error: "${error}". Please check your table names and syntax.`,
    suggested_fix: `Review if all referenced columns and tables exist in your schema.`,
    hints: [
      "Refer to your schema for correct table/column names.",
      "Consult SQL syntax documentation if needed."
    ]
  };
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Endpoint: /generate-schema
    if (request.method === "POST" && url.pathname === "/generate-schema") {
      let data;
      try {
        data = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const { prompt } = data;
      if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      if (!env["claude-sql-api-2"]) {
        return new Response(JSON.stringify({
          error: "Claude API key not configured",
          database: generateFallbackSchema(prompt),
          source: 'fallback'
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const schemaPrompt = `Generate a complete SQL database based on this description: "${prompt}".
Please include:
1. CREATE TABLE statements with appropriate data types (use SQLite syntax - INTEGER, TEXT, REAL, BLOB)
2. Primary keys using INTEGER PRIMARY KEY AUTOINCREMENT
3. Foreign keys and constraints where appropriate
4. Sample INSERT statements with realistic data (MINIMUM 20 rows per table - this is required!)
5. Comments explaining the database design
IMPORTANT: Each table MUST have at least 20 rows of sample data. This is critical for meaningful SQL practice.
Use varied, realistic data that represents different scenarios and edge cases.
Make sure the database is production-ready with proper normalization and relationships.
Format output as clean, executable SQLite SQL compatible with sql.js.`;

      try {
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env["claude-sql-api-2"],
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 5000,
            messages: [{ role: 'user', content: schemaPrompt }]
          })
        });

        if (!claudeResponse.ok) {
          throw new Error(`Claude API error: ${claudeResponse.status}`);
        }
        const claudeData = await claudeResponse.json();

        if (!claudeData.content || !claudeData.content[0] || !claudeData.content[0].text) {
          throw new Error("Invalid response structure from Claude API");
        }
        const generatedDatabase = claudeData.content[0].text;

        return new Response(JSON.stringify({
          database: generatedDatabase,
          source: 'claude-api'
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (apiError) {
        return new Response(JSON.stringify({
          database: generateFallbackSchema(prompt),
          source: 'fallback',
          error: `API call failed: ${apiError.message}`
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Endpoint: /explain-sql-error
    if (request.method === "POST" && url.pathname === "/explain-sql-error") {
      let data;
      try {
        data = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const { schema, query, error } = data;
      if (!schema || !query || !error) {
        return new Response(JSON.stringify({ error: "Missing required fields: schema, query, error" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      if (!env["claude-sql-api-2"]) {
        return new Response(JSON.stringify({
          error: "Claude API key not configured",
          coaching: fallbackCoach({ schema, query, error }),
          source: 'fallback'
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const coachPrompt = `You are an expert SQL tutor.
Given:
1. The database schema:
${schema}
2. The user's SQL query:
${query}
3. The error message:
${error}
Please:
- Explain the root cause in plain English.
- Suggest specific fixes and/or beginner-friendly hints.
Format your answer as JSON with fields:
{
  "explanation": "...",
  "suggested_fix": "...",
  "hints": ["...", "..."]
}`;

      try {
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env["claude-sql-api-2"],
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            messages: [{ role: 'user', content: coachPrompt }]
          })
        });

        if (!claudeResponse.ok) {
          throw new Error(`Claude API error: ${claudeResponse.status}`);
        }
        const claudeData = await claudeResponse.json();

        const rawResponse = claudeData.content[0]?.text || "";

        let coaching;
        try {
          if (rawResponse.trim().startsWith("{")) {
            coaching = JSON.parse(rawResponse);
          } else {
            coaching = {
              explanation: rawResponse,
              suggested_fix: "",
              hints: []
            };
          }
        } catch (parseError) {
          coaching = {
            explanation: rawResponse,
            suggested_fix: "",
            hints: []
          };
        }

        return new Response(JSON.stringify({ coaching, source: 'claude-api' }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          error: err.message,
          coaching: fallbackCoach({ schema, query, error }),
          source: 'fallback'
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
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
    .loading-popup {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .loading-popup.show {
      display: flex;
    }
    .loading-content {
      background: white;
      padding: 2rem;
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      text-align: center;
      max-width: 400px;
      margin: 1rem;
    }
    .loading-spinner {
      width: 3rem;
      height: 3rem;
      border: 3px solid #e5e7eb;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
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

        <!-- Coaching Panel -->
        <div id="coachingPanel" class="error-panel bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg overflow-hidden">
          <div class="p-4">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center space-x-2">
                <i class="fas fa-graduation-cap text-blue-600"></i>
                <h4 class="font-medium text-blue-800">SQL Coaching Assistant</h4>
              </div>
              <button id="dismissCoaching" class="text-blue-600 hover:text-blue-800">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div id="coachingContent" class="text-sm">
              <!-- Coaching content will be inserted here -->
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
  <!-- Footer with Attribution -->
    <footer class="bg-white border-t border-gray-200 mt-12">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="text-center text-sm text-gray-500">
          <p>Built by <a href="https://himanshiiportfolio.netlify.app/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline transition-colors">Himanshi Sheth</a></p>
          <p class="mt-1">AI SQL Playground - Generate custom databases and practice SQL queries</p>
        </div>
      </div>
    </footer>
    
    <!-- Loading Popup -->
    <div id="loadingPopup" class="loading-popup">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Generating Database</h3>
        <p class="text-gray-600" id="loadingMessage">One moment while I generate your custom SQL database...</p>
        <div id="progressContainer" class="mt-4" style="display: none;">
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div id="progressBar" class="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
          </div>
          <p class="text-sm text-gray-600 mt-2 text-center font-medium" id="progressText">0%</p>
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

  // Function to get coaching response for SQL errors
  async function getCoachingResponse(errorDetails) {
    try {
      addDebugInfo('Requesting coaching response for error: ' + errorDetails.errorMessage);
      
      // Show that we're getting help
      updateStatus('Getting help for your SQL error...');
      
      const response = await fetch('/api/coaching-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorDetails)
      });

      if (!response.ok) {
        throw new Error('Coaching service unavailable (HTTP ' + response.status + ')');
      }

      const coachingData = await response.json();
      addDebugInfo('Coaching response received: ' + coachingData.explanation?.substring(0, 100) + '...');
      
      if (coachingData.explanation) {
        showCoachingResponse(coachingData, errorDetails);
        updateStatus('Error analysis complete - check the coaching panel for help!');
      } else {
        addDebugInfo('No explanation provided in coaching response');
        updateStatus('Query execution failed - coaching unavailable');
      }
      
    } catch (coachingError) {
      addDebugInfo('Error getting coaching response: ' + coachingError.message);
      console.error('Coaching error:', coachingError);
    }
  }

  // Function to display coaching response in UI
  function showCoachingResponse(coachingData, errorDetails) {
    const coachingPanel = document.getElementById('coachingPanel');
    const coachingContent = document.getElementById('coachingContent');
    
    if (!coachingPanel || !coachingContent) {
      addDebugInfo('Coaching panel elements not found in DOM');
      return;
    }
    
    // Build coaching content
    let content = '<div class="space-y-4">';
    
    // Error summary
    content += '<div class="bg-red-50 border border-red-200 rounded-lg p-3">';
    content += '<h4 class="font-medium text-red-800 mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>Error Details</h4>';
    content += '<p class="text-sm text-red-700"><strong>Query:</strong> <code class="bg-red-100 px-1 rounded">' + escapeHtml(errorDetails.query) + '</code></p>';
    content += '<p class="text-sm text-red-700 mt-1"><strong>Error:</strong> ' + escapeHtml(errorDetails.errorMessage) + '</p>';
    
    // Add location information if available
    if (errorDetails.location && (errorDetails.location.line || errorDetails.location.column)) {
      content += '<div class="mt-2 p-2 bg-red-100 rounded">';
      content += '<p class="text-xs font-medium text-red-800"><i class="fas fa-map-marker-alt mr-1"></i>Error Location:</p>';
      if (errorDetails.location.line) {
        content += '<p class="text-xs text-red-700">Line: ' + errorDetails.location.line + '</p>';
      }
      if (errorDetails.location.column) {
        content += '<p class="text-xs text-red-700">Column: ' + errorDetails.location.column + '</p>';
      }
      if (errorDetails.location.context) {
        content += '<p class="text-xs text-red-700">Context: <code class="bg-red-200 px-1 rounded">' + escapeHtml(errorDetails.location.context) + '</code></p>';
      }
      content += '</div>';
    }
    
    // Add query analysis if available
    if (errorDetails.queryAnalysis) {
      content += '<div class="mt-2 text-xs text-red-600">';
      content += '<p>Query has ' + errorDetails.queryAnalysis.totalLines + ' lines, ' + errorDetails.queryAnalysis.totalCharacters + ' characters</p>';
      if (errorDetails.queryAnalysis.keywords.length > 0) {
        content += '<p>Keywords found: ' + errorDetails.queryAnalysis.keywords.join(', ') + '</p>';
      }
      if (errorDetails.queryAnalysis.tables.length > 0) {
        content += '<p>Tables referenced: ' + errorDetails.queryAnalysis.tables.join(', ') + '</p>';
      }
      content += '</div>';
    }
    
    content += '</div>';
    
    // Coaching explanation
    content += '<div class="bg-blue-50 border border-blue-200 rounded-lg p-3">';
    content += '<h4 class="font-medium text-blue-800 mb-2"><i class="fas fa-graduation-cap mr-2"></i>Explanation & Help</h4>';
    content += '<div class="text-sm text-blue-700 whitespace-pre-wrap">' + escapeHtml(coachingData.explanation) + '</div>';
    content += '</div>';
    
    // Suggested fix if provided
    if (coachingData.suggestedFix) {
      content += '<div class="bg-green-50 border border-green-200 rounded-lg p-3">';
      content += '<h4 class="font-medium text-green-800 mb-2"><i class="fas fa-lightbulb mr-2"></i>Suggested Fix</h4>';
      content += '<pre class="text-sm text-green-700 bg-green-100 p-2 rounded overflow-x-auto"><code>' + escapeHtml(coachingData.suggestedFix) + '</code></pre>';
      
      // Add button to apply suggested fix
      content += '<button id="applySuggestedFix" class="mt-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">';
      content += '<i class="fas fa-magic mr-1"></i>Apply This Fix';
      content += '</button>';
      content += '</div>';
    }
    
    // Additional tips if provided
    if (coachingData.tips && coachingData.tips.length > 0) {
      content += '<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">';
      content += '<h4 class="font-medium text-yellow-800 mb-2"><i class="fas fa-star mr-2"></i>Tips for Next Time</h4>';
      content += '<ul class="text-sm text-yellow-700 list-disc list-inside space-y-1">';
      coachingData.tips.forEach(tip => {
        content += '<li>' + escapeHtml(tip) + '</li>';
      });
      content += '</ul>';
      content += '</div>';
    }
    
    content += '</div>';
    
    coachingContent.innerHTML = content;
    
    // Add event listener for suggested fix button
    if (coachingData.suggestedFix) {
      const applyButton = document.getElementById('applySuggestedFix');
      if (applyButton) {
        applyButton.addEventListener('click', function() {
          sqlEditor.setValue(coachingData.suggestedFix);
          updateStatus('Suggested fix applied to editor - you can now run the corrected query!');
          addDebugInfo('Applied suggested fix from coaching response');
          
          // Change button to show it was applied
          this.innerHTML = '<i class="fas fa-check mr-1"></i>Fix Applied!';
          this.className = 'mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm cursor-default';
          this.disabled = true;
        });
      }
    }
    
    // Show the coaching panel
    coachingPanel.classList.add('show');
    addDebugInfo('Coaching response displayed in UI');
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  function showLoadingPopup(message = 'One moment while I generate your custom SQL database...', showProgress = false) {
    const loadingPopup = document.getElementById('loadingPopup');
    const loadingMessage = document.getElementById('loadingMessage');
    const progressContainer = document.getElementById('progressContainer');
    
    if (loadingMessage) {
      loadingMessage.textContent = message;
    }
    
    if (progressContainer) {
      progressContainer.style.display = showProgress ? 'block' : 'none';
    }
    
    if (loadingPopup) {
      loadingPopup.classList.add('show');
    }
  }

  function updateLoadingProgress(percentage, text = '') {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) {
      progressBar.style.width = percentage + '%';
    }
    
    if (progressText) {
      progressText.textContent = text || percentage + '%';
    }
  }

  function hideLoadingPopup() {
    const loadingPopup = document.getElementById('loadingPopup');
    if (loadingPopup) {
      loadingPopup.classList.remove('show');
    }
  }

  function hideLoading() {
    hideLoadingPopup();
  }

  // Function to parse SQL error for line/column information
  function parseErrorLocation(errorMessage, query) {
    const errorInfo = {
      line: null,
      column: null,
      context: null,
      parsedMessage: errorMessage
    };
    
    // Common SQL.js error patterns
    const patterns = [
      // "near "something": syntax error" pattern
      /near "([^"]+)": (.+)/i,
      // "no such table: tablename" pattern
      /no such table: (\w+)/i,
      // "no such column: columnname" pattern  
      /no such column: (\w+)/i,
      // Generic "syntax error" pattern
      /syntax error/i
    ];
    
    let matchedPattern = null;
    let matchedText = null;
    
    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match) {
        matchedPattern = pattern;
        matchedText = match[1] || match[0];
        break;
      }
    }
    
    if (matchedText && query) {
      // Try to find the problematic text in the query
      const lines = query.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const index = line.toLowerCase().indexOf(matchedText.toLowerCase());
        if (index !== -1) {
          errorInfo.line = i + 1;
          errorInfo.column = index + 1;
          errorInfo.context = line.trim();
          break;
        }
      }
    }
    
    return errorInfo;
  }

  // Enhanced error capture for coaching
  function captureEnhancedErrorDetails(error, query) {
    const errorLocation = parseErrorLocation(error.message, query);
    
    const errorDetails = {
      query: query,
      errorMessage: error.message,
      errorType: error.name || 'SQLError',
      timestamp: new Date().toISOString(),
      location: {
        line: errorLocation.line,
        column: errorLocation.column,
        context: errorLocation.context
      }
    };
    
    // Add query analysis
    const queryLines = query.split('\\n');
    errorDetails.queryAnalysis = {
      totalLines: queryLines.length,
      totalCharacters: query.length,
      keywords: extractSQLKeywords(query),
      tables: extractTableNames(query)
    };
    
    return errorDetails;
  }
  
  // Helper function to extract SQL keywords
  function extractSQLKeywords(query) {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'ORDER BY', 'GROUP BY', 'HAVING'];
    const foundKeywords = [];
    const upperQuery = query.toUpperCase();
    
    keywords.forEach(keyword => {
      if (upperQuery.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    });
    
    return foundKeywords;
  }
  
  // Helper function to extract table names from query
  function extractTableNames(query) {
    const tablePattern = /(?:FROM|JOIN|UPDATE|INTO)\\s+([\\w]+)/gi;
    const tables = [];
    let match;
    
    while ((match = tablePattern.exec(query)) !== null) {
      if (!tables.includes(match[1])) {
        tables.push(match[1]);
      }
    }
    
    return tables;
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
        // Handle multiple query results
        if (results.length === 1) {
          addDebugInfo('Query returned ' + results[0].values.length + ' rows with columns: ' + results[0].columns.join(', '));
          displayQueryResults(results[0], executionTime);
        } else {
          // Multiple queries executed - show ALL results with data
          addDebugInfo('Multiple queries executed (' + results.length + ' statements)');
          let resultsWithData = [];
          let totalRows = 0;
          
          for (let i = 0; i < results.length; i++) {
            if (results[i].values && results[i].values.length > 0) {
              resultsWithData.push({
                result: results[i],
                queryIndex: i + 1
              });
              totalRows += results[i].values.length;
              addDebugInfo('Query ' + (i + 1) + ' returned ' + results[i].values.length + ' rows with columns: ' + results[i].columns.join(', '));
            } else {
              addDebugInfo('Query ' + (i + 1) + ' executed successfully but returned no rows');
            }
          }
          
          if (resultsWithData.length > 0) {
            displayMultipleQueryResults(resultsWithData, executionTime);
            updateStatus('Executed ' + results.length + ' queries in ' + executionTime + 'ms. Showing results from ' + resultsWithData.length + ' queries with data (total: ' + totalRows + ' rows)');
          } else {
            displayEmptyResults(executionTime);
            updateStatus('Executed ' + results.length + ' queries in ' + executionTime + 'ms (no results returned)');
          }
        }
      }

    } catch (error) {
      console.error("SQL Query Error:", error);
      addDebugInfo('Query error: ' + error.message);
      
      // Enhanced error capture for coaching
      const errorDetails = captureEnhancedErrorDetails(error, query);
      
      // Get current database schema for context
      let schemaInfo = null;
      try {
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
        if (tablesResult.length > 0) {
          schemaInfo = {};
          for (const tableRow of tablesResult[0].values) {
            const tableName = tableRow[0];
            try {
              const schemaResult = db.exec("PRAGMA table_info(" + tableName + ");");
              if (schemaResult.length > 0) {
                schemaInfo[tableName] = schemaResult[0].values.map(col => ({
                  name: col[1],
                  type: col[2],
                  notNull: col[3],
                  defaultValue: col[4],
                  primaryKey: col[5]
                }));
              }
            } catch (schemaError) {
              addDebugInfo('Error getting schema for table ' + tableName + ': ' + schemaError.message);
            }
          }
        }
      } catch (schemaError) {
        addDebugInfo('Error getting database schema: ' + schemaError.message);
      }
      
      errorDetails.schema = schemaInfo;
      
      // Create enhanced error message with location info
      let enhancedErrorMessage = error.message;
      if (errorDetails.location.line && errorDetails.location.column) {
        enhancedErrorMessage += ' (Line ' + errorDetails.location.line + ', Column ' + errorDetails.location.column + ')';
      }
      if (errorDetails.location.context) {
        enhancedErrorMessage += '\\nProblem near: ' + errorDetails.location.context;
      }
      
      // Show enhanced error first
      showError('SQL Error: ' + enhancedErrorMessage);
      
      // Try to get coaching response
      getCoachingResponse(errorDetails);
      
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

    addDebugInfo('displayQueryResults called with ' + result.values.length + ' rows and columns: ' + result.columns.join(', '));

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

    addDebugInfo('Creating headers for columns: ' + result.columns.join(', '));

    // Create headers
    result.columns.forEach((column, index) => {
      const th = document.createElement('th');
      th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
      th.textContent = column;
      resultsHeader.appendChild(th);
      addDebugInfo('Added header ' + (index + 1) + ': ' + column);
    });

    addDebugInfo('Headers created, now creating ' + result.values.length + ' data rows');

    // Create rows
    result.values.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      row.forEach((cell, cellIndex) => {
        const td = document.createElement('td');
        td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
        td.textContent = cell !== null ? cell : 'NULL';
        tr.appendChild(td);
      });
      resultsBody.appendChild(tr);
    });
    
    addDebugInfo('Results table displayed with ' + result.values.length + ' rows and ' + result.columns.length + ' columns');
  }

  function displayMultipleQueryResults(resultsWithData, executionTime) {
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsBody = document.getElementById('resultsBody');
    const rowCount = document.getElementById('rowCount');
    const queryTime = document.getElementById('queryTime');
    const emptyResults = document.getElementById('emptyResults');
    const resultsTable = document.getElementById('resultsTable');

    addDebugInfo('displayMultipleQueryResults called with ' + resultsWithData.length + ' query results');

    // Clear previous results
    resultsHeader.innerHTML = '';
    resultsBody.innerHTML = '';
    emptyResults.style.display = 'none';
    
    // Make sure the table is visible
    resultsTable.style.display = 'table';

    // Show panel
    resultsPanel.classList.add('show');

    // Calculate total rows
    const totalRows = resultsWithData.reduce((sum, item) => sum + item.result.values.length, 0);
    
    // Update stats
    rowCount.textContent = totalRows + ' rows (' + resultsWithData.length + ' queries)';
    queryTime.textContent = executionTime + 'ms';

    addDebugInfo('Creating separate headers and data for each query...');

    // Create results for each query separately
    resultsWithData.forEach((item, resultIndex) => {
      const result = item.result;
      const queryIndex = item.queryIndex;
      
      addDebugInfo('Processing query ' + queryIndex + ' with ' + result.values.length + ' rows and columns: ' + result.columns.join(', '));
      
      // Add a query separator header row
      const separatorTr = document.createElement('tr');
      separatorTr.className = 'bg-gradient-to-r from-blue-100 to-blue-50';
      
      const separatorTd = document.createElement('td');
      separatorTd.className = 'px-6 py-3 text-center text-sm font-bold text-blue-800 border-b-2 border-blue-200';
      separatorTd.colSpan = result.columns.length;
      separatorTd.innerHTML = '<i class="fas fa-database mr-2"></i>Query ' + queryIndex + ' Results (' + result.values.length + ' rows)';
      separatorTr.appendChild(separatorTd);
      resultsBody.appendChild(separatorTr);
      
      // Create header row for this specific query
      const headerTr = document.createElement('tr');
      headerTr.className = 'bg-gray-50';
      
      result.columns.forEach((column) => {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200';
        th.textContent = column;
        headerTr.appendChild(th);
        addDebugInfo('Added header for query ' + queryIndex + ': ' + column);
      });
      
      resultsBody.appendChild(headerTr);

      // Create data rows for this query
      result.values.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.className = rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        
        row.forEach((cell, cellIndex) => {
          const td = document.createElement('td');
          td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-100';
          td.textContent = cell !== null ? cell : 'NULL';
          tr.appendChild(td);
        });
        resultsBody.appendChild(tr);
      });
      
      // Add spacing between query results (except for the last one)
      if (resultIndex < resultsWithData.length - 1) {
        const spacerTr = document.createElement('tr');
        const spacerTd = document.createElement('td');
        spacerTd.className = 'py-2';
        spacerTd.colSpan = result.columns.length;
        spacerTd.innerHTML = '&nbsp;';
        spacerTr.appendChild(spacerTd);
        resultsBody.appendChild(spacerTr);
      }
    });
    
    addDebugInfo('Multiple query results displayed: ' + resultsWithData.length + ' queries with individual headers and total ' + totalRows + ' rows');
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

  // Function to refresh database overview from actual database state
  function refreshDatabaseOverview() {
    const databaseContent = document.getElementById('databaseContent');
    const copyBtn = document.getElementById('copyDatabaseBtn');
    const loadBtn = document.getElementById('loadToEditorBtn');
    
    if (!db) {
      databaseContent.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">Database not initialized</div>';
      return;
    }
    
    try {
      // Get tables directly from the database
      const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
      
      if (result.length === 0 || result[0].values.length === 0) {
        databaseContent.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">No tables found in database</div>';
        copyBtn.style.display = 'none';
        loadBtn.style.display = 'none';
        return;
      }
      
      // Show action buttons
      copyBtn.style.display = 'inline-block';
      loadBtn.style.display = 'inline-block';
      
      // Get detailed information for each table
      const tables = [];
      for (const tableRow of result[0].values) {
        const tableName = tableRow[0];
        
        try {
          // Get column information
          const schemaResult = db.exec("PRAGMA table_info(" + tableName + ");");
          const columns = [];
          
          if (schemaResult.length > 0) {
            schemaResult[0].values.forEach(col => {
              const columnName = col[1]; // column name
              const columnType = col[2]; // column type
              columns.push(columnName + ' (' + columnType + ')');
            });
          }
          
          // Get row count
          let rowCount = 0;
          try {
            const countResult = db.exec("SELECT COUNT(*) as count FROM " + tableName);
            if (countResult.length > 0) {
              rowCount = countResult[0].values[0][0];
            }
          } catch (e) {
            addDebugInfo('Could not get row count for table ' + tableName + ': ' + e.message);
          }
          
          tables.push({
            name: tableName,
            columns: columns,
            rowCount: rowCount
          });
          
        } catch (e) {
          addDebugInfo('Error getting info for table ' + tableName + ': ' + e.message);
          tables.push({
            name: tableName,
            columns: ['Error loading columns'],
            rowCount: 0
          });
        }
      }
      
      // Display table information
      let html = '';
      tables.forEach(table => {
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
              \${table.rowCount} rows
            </div>
          </div>
        \`;
      });
      
      // Add refresh button and schema button
      html += \`
        <div class="mt-4 pt-4 border-t border-gray-200 space-y-2">
          <button id="refreshOverviewBtn" class="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2">
            <i class="fas fa-sync-alt"></i>
            <span>Refresh Database Overview</span>
          </button>
          <button id="showSchemaBtn" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2">
            <i class="fas fa-code"></i>
            <span>Show Schema Creation SQL</span>
          </button>
          <button id="diagnoseSchemaBtn" class="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center space-x-2">
            <i class="fas fa-search"></i>
            <span>Diagnose Schema Issues</span>
          </button>
        </div>
      \`;
      
      databaseContent.innerHTML = html;
      
      // Add event listeners
      document.getElementById('refreshOverviewBtn').addEventListener('click', function() {
        addDebugInfo('Manually refreshing database overview...');
        refreshDatabaseOverview();
        updateStatus('Database overview refreshed!');
        
        // Temporarily change button to show action was performed
        const originalHTML = this.innerHTML;
        this.innerHTML = '<i class="fas fa-check"></i><span>Overview Refreshed!</span>';
        this.classList.remove('bg-blue-100', 'hover:bg-blue-200', 'text-blue-700');
        this.classList.add('bg-green-100', 'text-green-700');
        
        // Reset button back to original state after 2 seconds
        setTimeout(() => {
          this.innerHTML = originalHTML;
          this.classList.remove('bg-green-100', 'text-green-700');
          this.classList.add('bg-blue-100', 'hover:bg-blue-200', 'text-blue-700');
        }, 2000);
      });
      
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
        } else {
          // Fallback: Generate schema from current database state
          try {
            addDebugInfo('No stored schema SQL found, generating from current database state...');
            const generatedSQL = generateSchemaFromDatabase();
            if (generatedSQL) {
              sqlEditor.setValue(generatedSQL);
              updateStatus('Current database schema generated and loaded to editor!');
              
              // Temporarily change button text to show action was performed
              const originalHTML = this.innerHTML;
              this.innerHTML = '<i class="fas fa-check"></i><span>Current Schema Generated</span>';
              this.classList.remove('bg-gray-100', 'hover:bg-gray-200');
              this.classList.add('bg-green-100', 'text-green-700');
              
              // Reset button back to original state after 2 seconds
              setTimeout(() => {
                this.innerHTML = originalHTML;
                this.classList.remove('bg-green-100', 'text-green-700');
                this.classList.add('bg-gray-100', 'hover:bg-gray-200');
              }, 2000);
            } else {
              showError('No database tables found to generate schema from.');
            }
          } catch (error) {
            addDebugInfo('Error generating schema from database: ' + error.message);
            showError('Could not generate schema: ' + error.message);
          }
        }
      });
      
      document.getElementById('diagnoseSchemaBtn').addEventListener('click', function() {
        addDebugInfo('Manual schema diagnosis requested...');
        diagnoseSchemaIssues();
        updateStatus('Schema diagnosis completed! Check the debug panel for details.');
        
        // Show the debug panel automatically
        document.getElementById('debugPanel').classList.add('show');
        
        // Temporarily change button text to show action was performed
        const originalHTML = this.innerHTML;
        this.innerHTML = '<i class="fas fa-check"></i><span>Diagnosis Complete - Check Debug Panel</span>';
        this.classList.remove('bg-yellow-100', 'hover:bg-yellow-200', 'text-yellow-700');
        this.classList.add('bg-green-100', 'text-green-700');
        
        // Reset button back to original state after 3 seconds
        setTimeout(() => {
          this.innerHTML = originalHTML;
          this.classList.remove('bg-green-100', 'text-green-700');
          this.classList.add('bg-yellow-100', 'hover:bg-yellow-200', 'text-yellow-700');
        }, 3000);
      });
      
      addDebugInfo('Database overview refreshed with ' + tables.length + ' tables');
      
    } catch (error) {
      addDebugInfo('Error refreshing database overview: ' + error.message);
      databaseContent.innerHTML = '<div class="text-sm text-red-500 text-center py-4">Error loading database overview: ' + error.message + '</div>';
    }
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
    const showDebugBtn = document.getElementById('showDebugBtn');
    if (showDebugBtn) {
      showDebugBtn.addEventListener('click', function() {
        document.getElementById('debugPanel').classList.add('show');
      });
    }
    
    const hideDebugBtn = document.getElementById('hideDebugBtn');
    if (hideDebugBtn) {
      hideDebugBtn.addEventListener('click', function() {
        document.getElementById('debugPanel').classList.remove('show');
      });
    }

    // Hide results panel
    const hideResultsBtn = document.getElementById('hideResultsBtn');
    if (hideResultsBtn) {
      hideResultsBtn.addEventListener('click', function() {
        document.getElementById('resultsPanel').classList.remove('show');
      });
    }
    
    // Generate Database Button Handler
    const generateDatabaseBtn = document.getElementById('generateDatabaseBtn');
    if (generateDatabaseBtn) {
      generateDatabaseBtn.addEventListener('click', generateAndLoadDatabase);
    }

    // SQL Editor buttons
    const runQueryBtn = document.getElementById('runQueryBtn');
    if (runQueryBtn) {
      runQueryBtn.addEventListener('click', executeQuery);
    }
    
    const formatBtn = document.getElementById('formatBtn');
    if (formatBtn) {
      formatBtn.addEventListener('click', formatSQL);
    }
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearEditor);
    }

    // Database panel buttons
    const copyDatabaseBtn = document.getElementById('copyDatabaseBtn');
    if (copyDatabaseBtn) {
      copyDatabaseBtn.addEventListener('click', copyDatabaseToClipboard);
    }
    
    const loadToEditorBtn = document.getElementById('loadToEditorBtn');
    if (loadToEditorBtn) {
      loadToEditorBtn.addEventListener('click', loadDatabaseToEditor);
    }

    // Error handling
    const dismissError = document.getElementById('dismissError');
    if (dismissError) {
      dismissError.addEventListener('click', hideError);
    }
    
    // Coaching panel handling
    const dismissCoaching = document.getElementById('dismissCoaching');
    if (dismissCoaching) {
      dismissCoaching.addEventListener('click', function() {
        const coachingPanel = document.getElementById('coachingPanel');
        if (coachingPanel) {
          coachingPanel.classList.remove('show');
        }
      });
    }

    // Database panel controls

    const collapseDatabase = document.getElementById('collapseDatabase');
    if (collapseDatabase) {
      collapseDatabase.addEventListener('click', function() {
        const content = document.getElementById('databaseContent');
        const icon = this.querySelector('i');
        
        if (content && icon) {
          if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
          } else {
            content.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
          }
        }
      });
    }

    // Mobile toggle
    const toggleSchema = document.getElementById('toggleSchema');
    if (toggleSchema) {
      toggleSchema.addEventListener('click', function() {
        const panel = document.getElementById('schemaPanel');
        if (panel) {
          panel.classList.toggle('collapsed');
        }
      });
    }
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

      showLoadingPopup('One moment while I generate your custom SQL database...', true);
      updateLoadingProgress(5, 'Initializing database generation...');
      updateStatus('Generating your custom SQL database...');
      updateDatabaseStatus('loading');

      // Add small delay to show first stage
      await new Promise(resolve => setTimeout(resolve, 300));
      updateLoadingProgress(10, 'Connecting to AI service...');

      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        updateLoadingProgress(15, 'Preparing your request...');
        
        const response = await fetch('/generate-schema', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt })
        });

        updateLoadingProgress(25, 'Request sent - waiting for AI response...');
        await new Promise(resolve => setTimeout(resolve, 300));
        updateLoadingProgress(35, 'AI is analyzing your requirements...');

        if (!response.ok) {
          throw new Error("HTTP error! status: " + response.status);
        }

        updateLoadingProgress(45, 'Receiving database schema...');
        const data = await response.json();
        addDebugInfo("API response received. Source: " + data.source);

        await new Promise(resolve => setTimeout(resolve, 200));
        updateLoadingProgress(55, 'Database schema received successfully!');

        if (data.error) {
          addDebugInfo("API Error: " + data.error);
        }

        if (data.database) {
          // Store the original database for comparison
          addDebugInfo("Raw database received from API:");
          addDebugInfo("Source: " + data.source);
          addDebugInfo("Database preview: " + data.database.substring(0, 500) + "...");
          
          await new Promise(resolve => setTimeout(resolve, 200));
          updateLoadingProgress(65, 'Validating database structure...');
          
          // Clean the database before processing
          const cleanedDatabase = cleanGeneratedDatabase(data.database);
          addDebugInfo('Database cleaned and ready for loading');
          addDebugInfo('Cleaned database preview: ' + cleanedDatabase.substring(0, 500) + "...");
          
          await new Promise(resolve => setTimeout(resolve, 200));
          updateLoadingProgress(75, 'Creating database tables...');
          
          // Store the original database globally BEFORE cleaning
          currentDatabase = data.database;
          
          await new Promise(resolve => setTimeout(resolve, 300));
          updateLoadingProgress(85, 'Loading data into tables...');
          await loadDatabaseIntoDatabase(cleanedDatabase);
          
          await new Promise(resolve => setTimeout(resolve, 200));
          updateLoadingProgress(92, 'Building database overview...');
          
          // Refresh database overview with current state
          refreshDatabaseOverview();
          
          await new Promise(resolve => setTimeout(resolve, 200));
          updateLoadingProgress(96, 'Setting up SQL editor...');
          
          // Set a clean query editor with helpful comments instead of showing the schema SQL
          sqlEditor.setValue(\`-- Write your SQL queries here
-- Example: SELECT * FROM customers LIMIT 5;
-- Try these common queries:
--   SELECT COUNT(*) FROM table_name;
--   SELECT * FROM table_name WHERE condition;
--   SELECT column1, column2 FROM table_name ORDER BY column1;

\`);

          await new Promise(resolve => setTimeout(resolve, 300));
          updateLoadingProgress(100, 'Database ready! You can now run SQL queries.');

          if (data.source === 'claude-api') {
            updateStatus('Custom SQL database generated and loaded successfully using Claude AI');
            addDebugInfo('Successfully used Claude API and loaded database into database');
          } else {
            updateStatus('Custom database created and loaded (Claude AI unavailable - using fallback)');
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
        // Add a small delay to let users see the completion
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reset button
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        hideLoadingPopup();
        addDebugInfo('Database generation process completed');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      showError('An unexpected error occurred: ' + error.message);
    }
  }
async function generateDatabase() {
    const prompt = document.getElementById('databasePrompt').value.trim();
    
    if (!prompt) {
        showError('Please enter a database description');
        return;
    }

    showLoading('One moment while I generate your custom SQL database...');
    addDebugInfo('Starting database generation for prompt: ' + prompt);

    try {
        const response = await fetch('/generate-schema', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }

        const data = await response.json();
        
        if (data.error && !data.database) {
            throw new Error(data.error);
        }

        // Store the current database for loading to editor
        currentDatabase = data.database;
        
        addDebugInfo('Database generated successfully from: ' + data.source);
        
        if (data.source === 'fallback') {
            updateStatus('Using fallback database (AI service unavailable)');
        } else {
            updateStatus('Database generated successfully with AI');
        }

        // Clean and load the database - FIXED: use the correct function name
        const cleanedDatabase = cleanGeneratedDatabase(data.database);
        await loadDatabaseIntoDatabase(cleanedDatabase);
        
        // Refresh database overview with current state
        refreshDatabaseOverview();
        
        // Show the copy and load to editor buttons
        document.getElementById('copyDatabaseBtn').style.display = 'inline-block';
        document.getElementById('loadToEditorBtn').style.display = 'inline-block';
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        addDebugInfo('Database generation failed: ' + error.message);
        showError('Failed to generate database: ' + error.message);
    }
}

// Update the copy database function to use consistent quotes
document.getElementById('copyDatabaseBtn').addEventListener('click', async function() {
    if (currentDatabase) {
        try {
            await navigator.clipboard.writeText(currentDatabase);
            updateStatus('Database copied to clipboard');
            addDebugInfo('Database copied to clipboard successfully');
        } catch (err) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = currentDatabase;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                updateStatus('Database copied to clipboard');
                addDebugInfo('Database copied to clipboard (fallback method)');
            } catch (fallbackErr) {
                showError('Failed to copy to clipboard');
            }
            document.body.removeChild(textArea);
        }
    } else {
        showError('No database available to copy');
    }
});

// Add this helper function to show loading state
function showLoading(message) {
    const loadingPopup = document.getElementById('loadingPopup');
    const loadingMessage = document.getElementById('loadingMessage');
    const progressContainer = document.getElementById('progressContainer');
    
    if (loadingMessage) {
        loadingMessage.textContent = message || 'One moment while I generate your custom SQL database...';
    }
    
    // Hide progress bar for simple loading
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    if (loadingPopup) {
        loadingPopup.classList.add('show');
    }
}



// Make sure to initialize the generateDatabase event listener
document.getElementById('generateDatabaseBtn').addEventListener('click', generateDatabase);

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
    if (currentDatabase && sqlEditor) {
      // Load the database creation code into the editor
      sqlEditor.setValue(currentDatabase);
      
      // Show success message
      updateStatus('Database creation code loaded into editor');
      addDebugInfo('Database loaded to editor successfully');
      
      // Optional: Focus the editor
      sqlEditor.focus();
      
      // Optional: Scroll to top of editor
      sqlEditor.setCursor(0, 0);
    } else {
      showError('No database available to load or editor not initialized');
    }
  }

  function selectTableForQuery(tableName) {
    const sampleQuery = \`-- Querying the \${tableName} table
SELECT * FROM \${tableName} LIMIT 20;\`;
    sqlEditor.setValue(sampleQuery);
    updateStatus(\`Sample query for \${tableName} loaded. You can modify and run it!\`);
  }

  // Add a new function to reload the generated database (not editor content)
  function reloadDatabaseFromEditor() {
    if (!currentDatabase) {
      showError('No generated database to reload. Please generate a database first.');
      return;
    }

    if (!db) {
      showError('Database not initialized. Please refresh the page.');
      return;
    }

    try {
      addDebugInfo('Reloading generated database...');
      showLoadingPopup('Reloading database schema...');
      updateDatabaseStatus('loading');
      
      // Reload the stored generated database
      loadDatabaseIntoDatabase(currentDatabase).then(() => {
        // Refresh the database panel with current state
        refreshDatabaseOverview();
        
        // Reset editor to clean query state
        sqlEditor.setValue(\`-- Write your SQL queries here
-- Example: SELECT * FROM customers LIMIT 5;
-- Try these common queries:
--   SELECT COUNT(*) FROM table_name;
--   SELECT * FROM table_name WHERE condition;
--   SELECT column1, column2 FROM table_name ORDER BY column1;

\`);
        
        updateStatus('Generated database reloaded successfully!');
        updateDatabaseStatus('connected');
        hideLoadingPopup();
        addDebugInfo('Generated database successfully reloaded');
      }).catch(error => {
        showError('Failed to reload database: ' + error.message);
        updateDatabaseStatus('error');
        hideLoadingPopup();
        addDebugInfo('Failed to reload database: ' + error.message);
      });
      
    } catch (error) {
      showError('Error reloading database: ' + error.message);
      hideLoadingPopup();
      addDebugInfo('Error reloading database: ' + error.message);
    }
  }

  // Add this new function to clean generated database
  function cleanGeneratedDatabase(database) {
    addDebugInfo("Starting database cleaning process...");
    addDebugInfo("Original database preview: " + database.substring(0, 200) + "...");
    
    // Remove markdown code blocks and clean up the database
    let cleaned = database
      // Remove markdown code block markers
      .replace(/\`\`\`sql\\s*/gi, '')
      .replace(/\`\`\`\\s*/g, '')
      // Remove any leading/trailing whitespace
      .trim();
    
    addDebugInfo("After markdown removal: " + cleaned.substring(0, 200) + "...");
    
    // Additional cleaning - remove explanatory text that's not SQL
    const lines = cleaned.split('\\n');
    const sqlLines = [];
    let inSQLBlock = false;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    
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
    addDebugInfo("Final cleaned database preview: " + result.substring(0, 300) + "...");
    
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
        
        // Run schema diagnosis to check for mismatches
        diagnoseSchemaIssues();
        
        // Auto-refresh the database overview to show current state
        setTimeout(() => refreshDatabaseOverview(), 100);
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
    addDebugInfo("Parsing SQL statements from: " + sql.substring(0, 200) + "...");
    
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
    
    const filteredStatements = statements.filter(stmt => {
      const cleaned = stmt.trim();
      return cleaned.length > 0 && 
             !cleaned.match(/^\\s*$/) && 
             !cleaned.match(/^-+\\s*$/) &&
             cleaned.match(/^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER)/i);
    });
    
    addDebugInfo("Parsed " + filteredStatements.length + " SQL statements:");
    filteredStatements.forEach((stmt, index) => {
      addDebugInfo("Statement " + (index + 1) + ": " + stmt.substring(0, 100) + "...");
    });
    
    return filteredStatements;
  }

  // Add function to diagnose schema differences
  function diagnoseSchemaIssues() {
    if (!db || !currentDatabase) {
      addDebugInfo("Cannot diagnose: database or original schema not available");
      return;
    }
    
    addDebugInfo("=== SCHEMA DIAGNOSIS ===");
    
    try {
      // Get actual table structure from database
      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
      
      if (tablesResult.length === 0) {
        addDebugInfo("No tables found in actual database");
        return;
      }
      
      addDebugInfo("Tables in actual database: " + tablesResult[0].values.map(row => row[0]).join(', '));
      
      // Analyze each table
      tablesResult[0].values.forEach(tableRow => {
        const tableName = tableRow[0];
        addDebugInfo("--- Analyzing table: " + tableName + " ---");
        
        try {
          const schemaResult = db.exec("PRAGMA table_info(" + tableName + ");");
          if (schemaResult.length > 0) {
            addDebugInfo("Actual columns in " + tableName + ":");
            schemaResult[0].values.forEach(col => {
              const columnName = col[1];
              const columnType = col[2];
              addDebugInfo("  " + columnName + " (" + columnType + ")");
            });
          }
        } catch (e) {
          addDebugInfo("Error getting schema for " + tableName + ": " + e.message);
        }
      });
      
      // Check what the original schema intended
      addDebugInfo("--- Original Schema Analysis ---");
      const createStatements = currentDatabase.match(/CREATE TABLE[^;]+;/gi);
      if (createStatements) {
        createStatements.forEach(stmt => {
          addDebugInfo("Original CREATE: " + stmt.substring(0, 150) + "...");
        });
      }
      
    } catch (error) {
      addDebugInfo("Error during schema diagnosis: " + error.message);
    }
    
    addDebugInfo("=== END SCHEMA DIAGNOSIS ===");
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