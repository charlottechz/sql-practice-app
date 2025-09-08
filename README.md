# AI SQL Playground

A professional-grade browser-based SQL learning platform that generates custom databases with AI and provides intelligent query coaching. Perfect for students, developers, and data analysts looking to practice SQL with realistic datasets.

## 🚀 Features

### Core Functionality
- **AI-Generated Databases**: Create custom, realistic databases from natural language descriptions
- **Real-time Query Execution**: Run SQL queries instantly using SQLite in the browser
- **Smart Error Coaching**: Get intelligent feedback and suggestions when queries fail
- **Interactive Schema Explorer**: Browse tables, columns, and data with an intuitive interface

### User Experience
- **No Setup Required**: Everything runs in your browser - no installations needed
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Syntax Highlighting**: Advanced SQL editor with code completion and formatting
- **Sample Queries**: Quick-start templates for common SQL operations

### AI-Powered Features
- **Natural Language to SQL**: Describe what you want, get a working database
- **Error Diagnosis**: Contextual explanations of SQL errors with fix suggestions
- **Query Optimization**: Hints for improving query performance and structure
- **Learning Path**: Progressive difficulty with guided practice scenarios

## 🛠 Technology Stack

### Frontend
- **JavaScript** - Lightweight and fast
- **CodeMirror** - Professional code editor with SQL syntax highlighting
- **Tailwind CSS** - Modern, responsive UI framework
- **SQL.js** - Full SQLite database engine running in WebAssembly

### Backend & AI
- **Cloudflare Workers** - Serverless API endpoints
- **Claude AI API** - Advanced natural language processing
- **Cloudflare Pages** - Static site hosting with global CDN

### Browser Compatibility
- Chrome 
- Firefox
- Safari 
- Edge 

## 🎯 Use Cases

### Educational
- **SQL Learning**: Interactive tutorials with instant feedback
- **Database Design**: Practice schema creation and normalization
- **Query Writing**: Master SELECT, JOIN, aggregate functions, and more

### Professional Development
- **Interview Preparation**: Practice common SQL interview questions
- **Skill Assessment**: Test your SQL knowledge with realistic scenarios
- **Team Training**: Share custom datasets for consistent learning experiences

### Data Analysis
- **Prototype Queries**: Test analysis approaches before running on production data
- **Schema Exploration**: Understand database structures through hands-on practice
- **Performance Testing**: Learn query optimization techniques

## 🚦 Getting Started

### Quick Start
1. **Visit** [SQL Playground](https://sql-practice-app-worker.charlotteachaze.workers.dev/)
2. **Describe** your ideal database in plain English
3. **Generate** a custom database with sample data
4. **Practice** writing and executing SQL queries
5. **Learn** from AI-powered feedback and coaching

### Example Database Prompts
```
"Create a database for a small retail store with customers, products, and orders"
"Generate a university database with students, courses, and enrollments"
"Build a social media platform database with users, posts, and comments"
"Design a library management system with books, authors, and borrowers"
```

### Sample Queries to Try
```sql
-- Basic data exploration
SELECT * FROM customers LIMIT 10;

-- Aggregation and grouping
SELECT category, COUNT(*) as product_count, AVG(price) as avg_price
FROM products 
GROUP BY category;

-- Joins and relationships
SELECT c.name, COUNT(o.id) as order_count, SUM(o.total) as total_spent
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name
ORDER BY total_spent DESC;
```

## 🏗 Architecture

### Client-Side Components
```
Browser
├── SQL.js (SQLite WASM)
├── CodeMirror (Editor)
├── UI Components
└── API Communication
```

### Server-Side Services
```
Cloudflare Workers
├── Schema Generation API
├── Error Coaching API
├── CORS Handling
└── Rate Limiting
```

### Data Flow
1. User describes desired database
2. Natural language prompt sent to Claude AI
3. AI generates complete SQL schema with sample data
4. Database loaded into browser SQLite instance
5. User queries executed locally with instant results
6. Errors sent to coaching API for intelligent feedback

## 🔧 API Endpoints

### `/generate-schema`
- **Method**: POST
- **Purpose**: Generate SQL database from natural language
- **Payload**: `{ prompt: string }`
- **Response**: `{ database: string, source: 'claude-api' | 'fallback' }`

### `/explain-sql-error`
- **Method**: POST  
- **Purpose**: Get coaching for SQL errors
- **Payload**: `{ schema: string, query: string, error: string }`
- **Response**: `{ coaching: { explanation, suggested_fix, hints } }`

## 🎓 Learning Features

### Practice Scenarios
- **E-commerce Analytics**: Customer behavior and sales analysis
- **Financial Reporting**: Revenue, costs, and profitability metrics
- **User Engagement**: Social media and app usage patterns
- **Inventory Management**: Stock levels and supply chain optimization

## 🔒 Privacy & Security

### Data Handling
- **Local Processing**: All queries run in your browser
- **No Data Storage**: Generated databases exist only in your session
- **Minimal API Calls**: Only schema generation and error coaching use external services

## 🐛 Troubleshooting

### Common Issues
- **Database Not Loading**: Check browser console, try refreshing
- **Queries Not Running**: Verify SQLite is supported in your browser
- **Coaching Unavailable**: AI service may be temporarily down, basic error info still shown
- **Schema Generation Fails**: Fallback database will be provided

### Browser Support
- Enable JavaScript and WebAssembly
- Allow third-party requests for AI features
- Minimum 2GB RAM recommended for large datasets

## 🤝 Contributing

### Development Setup
1. Clone the repository
2. Install Cloudflare Wrangler CLI
3. Set up environment variables
4. Deploy Workers for API endpoints
5. Deploy static site to Pages


## 📊 Performance

### Benchmarks
- **Database Generation**: 60 secs
- **Query Execution**: <100ms for typical operations
- **Error Coaching**: 1-3 seconds for analysis
- **Page Load**: <2 seconds on 3G connections

### Optimization Features
- **Lazy Loading**: Components load as needed
- **Caching**: Static assets served from global CDN
- **Compression**: Gzipped responses for faster transfers
- **Minification**: Optimized JavaScript and CSS

## 📈 Roadmap

### Upcoming Features
- **Export Functionality**: Download schemas and results
- **Collaboration Mode**: Share databases with team members
- **Advanced Analytics**: Query performance metrics
- **Mobile App**: Native iOS and Android versions

### Long-term Vision
- **Multi-database Support**: PostgreSQL, MySQL, SQL Server
- **Advanced AI Features**: Query generation from natural language
- **Learning Paths**: Structured SQL curriculum
- **Certification**: Skill verification and badges

📄 **License Notice**  
This project is not open source. It is provided for personal and educational use only.  
Commercial use is prohibited. See [LICENSE.txt](./LICENSE.txt) for details.

### Contributor

- **Himanshi Sheth** – SQL Playground Dev
- [HS Portfolio](https://himanshiiportfolio.netlify.app/)
- [HS LinkedIn](https://www.linkedin.com/in/himanshi-sheth/)
---

*Built with ❤️ for the SQL learning community*

**Status**: 🚧 Active Development | **Timeline**: Summer 2025 Release
