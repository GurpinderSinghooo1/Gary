# 🚀 Market Signal Dashboard - Deployment Guide

This guide will walk you through setting up the complete Market Signal Dashboard system.

## 📋 Prerequisites

- Google account with access to Google Sheets
- GitHub account for hosting the frontend
- Basic knowledge of Google Apps Script

## 🔧 Step 1: Google Apps Script Setup

### 1.1 Access the Destination Sheet
1. Open your destination Google Sheet: `https://docs.google.com/spreadsheets/d/1Og4-kbIUeDZ8KZMyfIeblt3DfPmipTLz1IjywL4kriE`
2. Make sure you have edit permissions

### 1.2 Open Apps Script Editor
1. In the Google Sheet, go to **Extensions** > **Apps Script**
2. This will open the Apps Script editor in a new tab

### 1.3 Replace Default Code
1. Delete all existing code in the editor
2. Copy the entire contents of `apps-script.gs` from this project
3. Paste it into the Apps Script editor
4. Click **Save** (Ctrl+S or Cmd+S)
5. Give your project a name like "Market Signal Dashboard"

### 1.4 Set Up Daily Trigger
1. In the Apps Script editor, click on **Triggers** (clock icon) in the left sidebar
2. Click **+ Add Trigger** at the bottom right
3. Configure the trigger:
   - **Choose which function to run**: `syncData_web`
   - **Choose which deployment should run**: `Head`
   - **Select event source**: `Time-driven`
   - **Select type of time based trigger**: `Day timer`
   - **Select time of day**: `12:30 PM to 1:30 PM`
4. Click **Save**

### 1.5 Deploy as Web App
1. Click **Deploy** > **New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure the deployment:
   - **Description**: "Market Signal Dashboard API"
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Copy the **Web app URL** - you'll need this for the frontend

## 🌐 Step 2: GitHub Pages Setup

### 2.1 Create GitHub Repository
1. Go to GitHub and create a new repository
2. Name it something like `market-signal-dashboard`
3. Make it public (required for GitHub Pages)
4. Don't initialize with README (we'll upload our files)

### 2.2 Upload Project Files
1. Clone the repository to your local machine
2. Copy all files from this project to the repository folder
3. Commit and push the files:
   ```bash
   git add .
   git commit -m "Initial commit: Market Signal Dashboard"
   git push origin main
   ```

### 2.3 Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/(root)** folder
6. Click **Save**
7. Your site will be available at: `https://[username].github.io/[repo-name]`

## 🔗 Step 3: Connect Frontend to Backend

### 3.1 Update API URL
1. Open `js/data-handler.js`
2. Find this line:
   ```javascript
   const scriptId = '1Og4-kbIUeDZ8KZMyfIeblt3DfPmipTLz1IjywL4kriE';
   ```
3. Replace with your actual Apps Script web app URL (from Step 1.5)
4. The URL should look like: `https://script.google.com/macros/s/[SCRIPT_ID]/exec`

### 3.2 Test the Connection
1. Open your GitHub Pages site
2. Open browser developer tools (F12)
3. Check the Console tab for any errors
4. The dashboard should load and display data

## 🧪 Step 4: Testing

### 4.1 Manual Data Sync Test
1. In the Apps Script editor, go to the **Code** tab
2. Select the `testSync` function from the dropdown
3. Click the **Run** button
4. Check the **Execution log** for any errors
5. Verify data appears in the `SignalArchive_web` tab

### 4.2 Frontend Test
1. Visit your GitHub Pages site
2. Verify the dashboard loads without errors
3. Test the filter functionality
4. Test the copy-to-clipboard feature
5. Test date navigation

## 🔍 Step 5: Monitoring

### 5.1 Check Sync Status
- Monitor the `SyncErrors_web` tab in your Google Sheet
- Check Apps Script execution logs for errors
- Verify daily data appears in `SignalArchive_web`

### 5.2 Monitor Frontend
- Check browser console for JavaScript errors
- Monitor network requests in developer tools
- Verify data freshness indicators

## 🛠️ Troubleshooting

### Common Issues

#### Apps Script Errors
- **Permission denied**: Make sure you have edit access to both sheets
- **Function not found**: Verify all functions are copied correctly
- **Trigger not working**: Check trigger configuration and timezone

#### Frontend Issues
- **CORS errors**: Ensure Apps Script web app is deployed with "Anyone" access
- **No data loading**: Check API URL and network connectivity
- **Styling issues**: Verify CSS files are properly linked

#### Data Issues
- **Missing data**: Check source sheet permissions and column names
- **Sync failures**: Review Apps Script logs and error tab
- **Stale data**: Verify daily trigger is configured correctly

### Debug Steps
1. Check Apps Script execution logs
2. Verify Google Sheet permissions
3. Test API endpoint directly in browser
4. Check browser console for errors
5. Verify all file paths and URLs

## 📊 Performance Optimization

### Apps Script
- Monitor execution time (should be under 6 minutes)
- Consider batching operations for large datasets
- Use efficient data structures and algorithms

### Frontend
- Enable browser caching
- Minimize API calls
- Optimize images and assets
- Use CDN for external resources

## 🔒 Security Considerations

### Data Access
- Apps Script web app is public (required for frontend access)
- Source sheet should have restricted access
- Consider implementing API rate limiting if needed

### Frontend Security
- No sensitive data stored in frontend
- Use HTTPS for all connections
- Validate all user inputs

## 📈 Scaling Considerations

### Current Limits
- Google Apps Script: 6 minutes execution time
- Google Sheets: 10 million cells per sheet
- GitHub Pages: 1GB repository size

### Future Enhancements
- Implement data pagination
- Add caching layer
- Consider alternative hosting solutions
- Add user authentication if needed

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Apps Script execution logs
3. Verify all configuration steps
4. Test with sample data first
5. Check browser compatibility

## 📝 Maintenance

### Regular Tasks
- Monitor sync errors weekly
- Check data freshness daily
- Review performance metrics monthly
- Update dependencies as needed

### Backup Strategy
- Export important data regularly
- Keep backup of Apps Script code
- Version control all changes
- Document any customizations

---

**🎉 Congratulations!** Your Market Signal Dashboard is now deployed and ready to use.

The system will automatically sync data daily at 12:30 PM and provide real-time access to your trading signals through a clean, mobile-friendly interface. 