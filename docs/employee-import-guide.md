# Employee Import Guide

The INAN Awards platform supports bulk employee import via CSV and Excel files to streamline the process of adding multiple employees to your organization's directory.

## Supported File Formats

- **CSV (.csv)**: Comma-separated values
- **Excel (.xlsx, .xls)**: Microsoft Excel workbook files

## Required Columns

Your import file must contain at least these two columns with exact names:

- **Employee**: The full name of the employee (e.g., "John Smith")
- **Email**: The employee's email address (e.g., "john.smith@company.com")

## Optional Columns

You can include any of these additional columns to provide more detailed employee information:

- **Employee ID**: Unique identifier for the employee (if not provided, auto-generated)
- **Role**: Job title or position (defaults to "Staff")
- **Status**: Employment status - "Active" or "Inactive" (defaults to "Active")
- **Reporting To**: Name of the employee's manager
- **Joining Date**: Date when employee joined (YYYY-MM-DD format preferred)
- **Employment Type**: "Full-time", "Part-time", "Contract", or "Internship" (defaults to "Full-time")

## File Format Requirements

### CSV Files
- First row must contain column headers
- Use commas to separate values
- Wrap text containing commas in quotes
- UTF-8 encoding recommended

### Excel Files
- First row must contain column headers
- Data can be in the first worksheet
- Empty rows will be skipped
- Data should start from row 1 (headers) and row 2 (first employee)

## Sample File Structure

| Employee ID | Employee | Email | Role | Reporting To | Joining Date | Status | Employment Type |
|-------------|----------|-------|------|--------------|--------------|--------|-----------------|
| EMP001 | John Smith | john.smith@company.com | Software Engineer | Jane Doe | 2024-01-15 | Active | Full-time |
| EMP002 | Sarah Johnson | sarah.johnson@company.com | Product Manager | Mike Wilson | 2024-02-01 | Active | Full-time |

## Import Process

1. **Prepare Your File**: Ensure your CSV or Excel file has the required columns and proper formatting
2. **Access Employee Directory**: Navigate to Dashboard → Settings → Employees tab
3. **Select File**: Click "Select File" and choose your CSV or Excel file
4. **Review**: The system will show format requirements when a file is selected
5. **Import**: Click "Import" to process the file
6. **Confirmation**: You'll see a success message with the number of employees imported

## Important Notes

- **Duplicate Employee IDs**: If an Employee ID already exists, the import will show an error for that specific record
- **Email Validation**: Email addresses must be valid format
- **Data Validation**: Invalid or missing required data will be skipped with appropriate error messages
- **Batch Processing**: Large files are processed in batches for optimal performance
- **Tenant Isolation**: Imported employees are automatically associated with your organization

## Troubleshooting

### Common Issues

1. **"CSV/Excel must contain Employee and Email columns"**
   - Ensure your file has columns named exactly "Employee" and "Email"
   - Check that headers are in the first row

2. **"No valid employee records found"**
   - Check that data rows have values in both Employee and Email columns
   - Ensure data starts from row 2 (after headers)

3. **"Error parsing file"**
   - Verify file format is supported (.csv, .xlsx, .xls)
   - Check for corrupted file or encoding issues
   - Try saving the file again or converting format

### Tips for Success

- Test with a small sample file first
- Remove any empty rows at the end of your data
- Ensure email addresses are unique
- Use consistent date formats (YYYY-MM-DD preferred)
- Check column names for exact spelling and capitalization

## Example Files

Sample template files are available in the `public` folder:
- `sample-employees-template.csv`
- `sample-employees-template.xlsx`

These files demonstrate the proper format and can be used as starting points for your employee import.