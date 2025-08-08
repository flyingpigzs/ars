file = "./DEMO.xlsx"
import openpyxl
import csv

# convert xlsx to csv
def xlsx_to_csv(file):
    # convert all pages to csv
    wb = openpyxl.load_workbook(file)
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        with open(f"./csvt/{sheet}.csv", "w", newline="") as f:
            c = csv.writer(f)
            for r in ws.rows:
                c.writerow([cell.value for cell in r])

xlsx_to_csv(file)