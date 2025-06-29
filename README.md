# 📊 Market Signal Dashboard

A real-time stock signal dashboard system that processes and displays AI-generated trading signals with comprehensive technical and fundamental analysis.

## 🏗️ System Architecture

- **Backend**: Google Apps Script (embedded in destination sheet)
- **Frontend**: Vanilla HTML/CSS/JavaScript (hosted on GitHub Pages)
- **Data Source**: Google Sheets (Project 1 - Live Data Generator)
- **Data Storage**: Google Sheets (Project 2 - Dashboard & Archive)

## 📁 Project Structure

```
Website_Market Scanner/
├── index.html                 # Main dashboard page
├── css/
│   └── styles.css            # Main stylesheet
├── js/
│   ├── app.js               # Main application logic
│   ├── data-handler.js      # Data fetching and processing
│   ├── ui-components.js     # UI components and interactions
│   └── utils.js             # Utility functions
├── assets/
│   └── icons/               # SVG icons and assets
└── README.md                # This file
```

## 🔧 Setup Instructions

### 1. Google Apps Script Setup
1. Open the destination Google Sheet: `1Og4-kbIUeDZ8KZMyfIeblt3DfPmipTLz1IjywL4kriE`
2. Go to Extensions > Apps Script
3. Replace the default code with the provided `apps-script.gs` file
4. Set up a daily trigger at 12:30 PM for the `syncData_web()` function

### 2. Frontend Deployment
1. Push this code to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Set source to main branch
4. The site will be available at `https://[username].github.io/[repo-name]`

## 📦 Local Development

Install dependencies with `npm install` then use:

- `npm run dev` – launch a local server on http://localhost:3000
- `npm test` – run unit tests with Jest
- `npm run lint` – check code style with ESLint

The API URL used by the dashboard is defined in `js/data-handler.js` as the
`BASE_API_URL` constant. Update this value if your backend endpoint changes.

## 📊 Data Flow

1. **Daily Sync (12:30 PM)**: Apps Script fetches data from Project 1 sheets
2. **Data Processing**: Merges signals with technical/fundamental data
3. **Archive Storage**: Saves enriched data to `SignalArchive_web` tab
4. **Frontend Display**: Website reads from archive and displays signals

## 🎯 Features

- **Real-time Signal Display**: Shows today's trading signals
- **Historical Archive**: 30-day signal history with date navigation
- **Mobile-First Design**: Responsive layout optimized for mobile devices
- **Advanced Filtering**: Filter by confidence, risk level, and sector
- **Copy-to-Clipboard**: Generate comprehensive review packets for GPT analysis
- **Market Sentiment**: Daily macro sentiment display

## 🔍 Data Sources

- `FinalSignals_Archive`: Main buy signals
- `TechnicalAnalysis`: Market indicators and technical data
- `Fundamentals`: Company valuation and financial metrics
- `MarketSentiment`: Macro market conditions
- `BuySignals_Working`: Company name mappings

## 🛠️ Technical Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Google Apps Script
- **Data Storage**: Google Sheets
- **Hosting**: GitHub Pages
- **Styling**: Custom CSS with mobile-first approach

## 📱 Mobile Features

- Responsive card layout
- Touch-friendly interactions
- Floating filter controls
- Expandable signal details
- Optimized for one-handed use

## 🔄 Daily Operations

- **12:30 PM**: Automatic data sync from Project 1
- **Data Processing**: Merge and enrich signal data
- **Archive Management**: Maintain 30-day rolling window
- **Error Handling**: Log sync errors for monitoring

## 📈 Signal Information

Each signal includes:
- Company ticker and name
- Buy decision with reasoning
- Price targets and upside potential
- Technical indicators (RSI, MACD, Volume)
- Fundamental metrics (P/E, Growth, Margins)
- Risk assessment and confidence scores
- Macro market context

## 🎨 Design Philosophy

- Clean, minimal interface (inspired by Notion, Apple, Stripe)
- Trustworthy and professional appearance
- No flashy graphics or distracting elements
- Focus on data clarity and usability
- Mobile-first responsive design

## 🔧 Maintenance

- Monitor sync errors in `SyncErrors_web` tab
- Review daily signal quality and processing
- Update filters and sorting as needed
- Maintain archive cleanup (30-day limit)

---

**Built with ❤️ for professional trading signal analysis** 